"""Creating a payment attempt for a booking and the checkout link the traveller is sent to."""

import base64
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.money import to_uzs_tiyin
from app.models import Booking, FxRate, Payment
from app.services.booking import BookingError, can_take_payment, now

FX_MAX_AGE_HOURS = 36


async def uzs_rate(session: AsyncSession, currency: str) -> Decimal:
    rate = await session.get(FxRate, currency)
    if rate is None or rate.fetched_at < now() - timedelta(hours=FX_MAX_AGE_HOURS):
        raise BookingError("fx_unavailable", "Exchange rate is not available right now", 503)
    return rate.uzs_per_unit


async def create_payment(session: AsyncSession, booking: Booking, provider: str) -> Payment:
    """Freeze the amount due now (deposit or balance) in UZS and open a payment for it.
    The booking must be locked by the caller. An open payment for the same provider and amount is reused."""
    if provider not in ("payme", "click"):
        raise BookingError("bad_provider", "Unknown payment method", 422)
    if not can_take_payment(booking):
        raise BookingError("not_payable", "This booking cannot be paid now")

    due = booking.amount_due_minor
    if booking.currency == "UZS":
        rate, amount = None, due
    else:
        rate = await uzs_rate(session, booking.currency)
        amount = to_uzs_tiyin(due, rate)

    existing = await session.scalar(
        select(Payment).where(Payment.booking_id == booking.id, Payment.provider == provider,
                              Payment.status == "pending", Payment.booking_amount_minor == due)
    )
    if existing is not None and existing.amount_minor == amount:
        return existing
    if existing is not None:
        existing.status = "cancelled"

    payment = Payment(booking_id=booking.id, provider=provider, status="pending", booking_amount_minor=due,
                      amount_minor=amount, currency="UZS", fx_rate=rate)
    session.add(payment)
    await session.flush()
    await session.refresh(payment, ["order_no"])
    return payment


def checkout_url(payment: Payment, locale: str, return_url: str) -> str:
    s = get_settings()
    if payment.provider == "payme":
        lang = locale if locale in ("uz", "ru", "en") else "en"
        params = f"m={s.payme_merchant_id};ac.order_id={payment.order_no};a={payment.amount_minor};l={lang};c={return_url}"
        host = "checkout.paycom.uz" if s.is_production else "checkout.test.paycom.uz"
        return f"https://{host}/{base64.b64encode(params.encode()).decode()}"
    sums = Decimal(payment.amount_minor) / 100
    query = urlencode({
        "service_id": s.click_service_id,
        "merchant_id": s.click_merchant_id,
        "amount": f"{sums:.2f}",
        "transaction_param": str(payment.order_no),
        "return_url": return_url,
    })
    return f"https://my.click.uz/services/pay?{query}"
