import hashlib
import json

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import BookingCreated, BookingIn, BookingOut, Money, PaymentIn, PaymentOut
from app.config import get_settings
from app.core.ratelimit import limit
from app.core.tokens import hash_token, tokens_equal
from app.db import get_session
from app.models import Booking, Departure, IdempotencyKey
from app.services.booking import NewBooking, create_booking, lock_booking
from app.services.payments.intents import checkout_url, create_payment

router = APIRouter(prefix="/v1/bookings", tags=["bookings"])
IDEMPOTENCY_SCOPE = "booking.create"


async def booking_out(session: AsyncSession, b: Booking) -> dict:
    dep = await session.get(Departure, b.departure_id) if b.departure_id else None
    m = lambda v: Money(currency=b.currency, amount_minor=v)  # noqa: E731
    return BookingOut(
        reference=b.reference, status=b.status, payment_state=b.payment_state, tour_title=b.tour_title_snapshot,
        start_date=dep.start_date if dep else None, adults=b.adults, children=b.children,
        total=m(b.total_minor), deposit=m(b.deposit_minor), paid=m(b.paid_minor), amount_due=m(b.amount_due_minor),
        hold_expires_at=b.hold_expires_at,
    ).model_dump(mode="json")


@router.post("", status_code=201, response_model=BookingCreated,
             dependencies=[Depends(limit("booking.create", times=10, seconds=600))])
async def create(
    body: BookingIn,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=16, max_length=80),
    session: AsyncSession = Depends(get_session),
):
    req_hash = hashlib.sha256(json.dumps(body.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()

    async def replay() -> dict | None:
        row = await session.get(IdempotencyKey, (idempotency_key, IDEMPOTENCY_SCOPE))
        if row is None:
            return None
        if row.request_hash != req_hash:
            raise HTTPException(422, {"code": "idempotency_key_reused"})
        return row.response

    if (cached := await replay()) is not None:
        return cached

    booking, token = await create_booking(session, NewBooking(**body.model_dump()))
    out = await booking_out(session, booking) | {"access_token": token}
    session.add(IdempotencyKey(key=idempotency_key, scope=IDEMPOTENCY_SCOPE, request_hash=req_hash,
                               response=out, status_code=201))
    try:
        await session.commit()
    except IntegrityError:
        # The same request arrived twice at the same moment: the other one won, return its result.
        await session.rollback()
        if (cached := await replay()) is not None:
            return cached
        raise
    return out


async def _authorised(session: AsyncSession, reference: str, token: str | None, lock: bool = False) -> Booking:
    b = await session.scalar(select(Booking).where(Booking.reference == reference.upper()))
    # Same answer for "no such booking" and "wrong token", so references cannot be probed.
    if b is None or not token or not tokens_equal(b.access_token_hash, hash_token(token)):
        raise HTTPException(404, {"code": "booking_not_found"})
    return await lock_booking(session, b.id) if lock else b


@router.get("/{reference}", response_model=BookingOut,
            dependencies=[Depends(limit("booking.read", times=60, seconds=60))])
async def read(reference: str, x_booking_token: str | None = Header(None),
               session: AsyncSession = Depends(get_session)):
    return await booking_out(session, await _authorised(session, reference, x_booking_token))


@router.post("/{reference}/payments", response_model=PaymentOut,
             dependencies=[Depends(limit("payment.create", times=20, seconds=600))])
async def pay(reference: str, body: PaymentIn, x_booking_token: str | None = Header(None),
              session: AsyncSession = Depends(get_session)):
    b = await _authorised(session, reference, x_booking_token, lock=True)
    payment = await create_payment(session, b, body.provider)
    # The return address is always our own site, never taken from the request (no open redirect).
    url = checkout_url(payment, b.locale, f"{get_settings().site_url}/{b.locale}/booking/{b.reference}")
    out = PaymentOut(order_no=payment.order_no, provider=payment.provider, amount_uzs_tiyin=payment.amount_minor,
                     checkout_url=url)
    await session.commit()
    return out
