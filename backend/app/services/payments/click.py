"""Click SHOP API: two calls per payment, Prepare (action=0) and Complete (action=1), form-encoded.
Every call is signed with MD5 over the fields and our secret key; an unsigned or mis-signed call is refused."""

import hashlib
import time
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.tokens import tokens_equal
from app.models import Payment, ProviderTransaction
from app.services.booking import BookingError, apply_payment, can_take_payment, extend_hold, lock_booking, now

OK = 0
SIGN_FAILED = -1
BAD_AMOUNT = -2
ACTION_NOT_FOUND = -3
ALREADY_PAID = -4
ORDER_NOT_FOUND = -5
TXN_NOT_FOUND = -6
BAD_REQUEST = -8
TXN_CANCELLED = -9

_NOTES = {
    OK: "Success",
    SIGN_FAILED: "SIGN CHECK FAILED!",
    BAD_AMOUNT: "Incorrect parameter amount",
    ACTION_NOT_FOUND: "Action not found",
    ALREADY_PAID: "Already paid",
    ORDER_NOT_FOUND: "Order not found",
    TXN_NOT_FOUND: "Transaction does not exist",
    BAD_REQUEST: "Error in request from click",
    TXN_CANCELLED: "Transaction cancelled",
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def expected_sign(f: dict[str, str], secret: str) -> str:
    parts = [f.get("click_trans_id", ""), f.get("service_id", ""), secret, f.get("merchant_trans_id", "")]
    if f.get("action") == "1":
        parts.append(f.get("merchant_prepare_id", ""))
    parts += [f.get("amount", ""), f.get("action", ""), f.get("sign_time", "")]
    return hashlib.md5("".join(parts).encode(), usedforsecurity=False).hexdigest()


def _tiyin(amount: str) -> int | None:
    try:
        value = Decimal(amount)
    except (InvalidOperation, TypeError):
        return None
    if value <= 0 or value != value.quantize(Decimal("0.01")):
        return None
    return int(value * 100)


class ClickHandler:
    def __init__(self, session: AsyncSession):
        self.s = session

    def _reply(self, f: dict[str, str], error: int, **extra: Any) -> dict[str, Any]:
        out: dict[str, Any] = {
            "click_trans_id": f.get("click_trans_id"),
            "merchant_trans_id": f.get("merchant_trans_id"),
            "error": error,
            "error_note": _NOTES[error],
        }
        out.update(extra)
        return out

    async def handle(self, f: dict[str, str]) -> dict[str, Any]:
        s = get_settings()
        required = ("click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string")
        if any(not f.get(k) for k in required):
            return self._reply(f, BAD_REQUEST)
        secret = s.click_secret_key.get_secret_value()
        if not secret or f["service_id"] != s.click_service_id:
            return self._reply(f, SIGN_FAILED)
        if not tokens_equal(expected_sign(f, secret), f["sign_string"].lower()):
            return self._reply(f, SIGN_FAILED)
        if f["action"] == "0":
            return await self.prepare(f)
        if f["action"] == "1":
            return await self.complete(f)
        return self._reply(f, ACTION_NOT_FOUND)

    async def _payment(self, f: dict[str, str]) -> Payment | None:
        try:
            order_no = int(f["merchant_trans_id"])
        except ValueError:
            return None
        return await self.s.scalar(
            select(Payment).where(Payment.order_no == order_no, Payment.provider == "click").with_for_update()
        )

    async def prepare(self, f: dict[str, str]) -> dict[str, Any]:
        payment = await self._payment(f)
        if payment is None:
            return self._reply(f, ORDER_NOT_FOUND)
        if payment.status == "succeeded":
            return self._reply(f, ALREADY_PAID)
        if payment.status != "pending":
            return self._reply(f, TXN_CANCELLED)
        amount = _tiyin(f["amount"])
        if amount is None or amount != payment.amount_minor:
            return self._reply(f, BAD_AMOUNT)

        existing = await self.s.scalar(
            select(ProviderTransaction).where(ProviderTransaction.provider == "click",
                                              ProviderTransaction.external_id == f["click_trans_id"])
        )
        if existing is not None:  # Click retried Prepare: answer the same way
            if existing.state == -1:
                return self._reply(f, TXN_CANCELLED)
            return self._reply(f, OK, merchant_prepare_id=existing.id)

        booking = await lock_booking(self.s, payment.booking_id)
        if not can_take_payment(booking) or booking.amount_due_minor < payment.booking_amount_minor:
            return self._reply(f, ORDER_NOT_FOUND)

        txn = ProviderTransaction(payment_id=payment.id, provider="click", external_id=f["click_trans_id"],
                                  amount_minor=amount, state=1, provider_time=_now_ms(), create_time=_now_ms())
        self.s.add(txn)
        await extend_hold(booking, minutes=get_settings().booking_hold_minutes)
        await self.s.flush()
        return self._reply(f, OK, merchant_prepare_id=txn.id)

    async def complete(self, f: dict[str, str]) -> dict[str, Any]:
        try:
            prepare_id = int(f.get("merchant_prepare_id", ""))
        except ValueError:
            return self._reply(f, TXN_NOT_FOUND)
        txn = await self.s.scalar(
            select(ProviderTransaction)
            .where(ProviderTransaction.id == prepare_id, ProviderTransaction.provider == "click",
                   ProviderTransaction.external_id == f["click_trans_id"])
            .with_for_update()
        )
        if txn is None:
            return self._reply(f, TXN_NOT_FOUND)
        if txn.state == 2:
            return self._reply(f, ALREADY_PAID, merchant_confirm_id=txn.id)
        if txn.state == -1:
            return self._reply(f, TXN_CANCELLED)
        payment = await self.s.scalar(select(Payment).where(Payment.id == txn.payment_id).with_for_update())
        if payment is None or str(payment.order_no) != f["merchant_trans_id"]:
            return self._reply(f, ORDER_NOT_FOUND)
        if _tiyin(f["amount"]) != txn.amount_minor:
            return self._reply(f, BAD_AMOUNT)

        # Click reports its own failure (e.g. insufficient funds) with a negative error: cancel our side.
        try:
            click_error = int(f.get("error", "0"))
        except ValueError:
            click_error = 0
        if click_error < 0:
            txn.state = -1
            txn.cancel_time = _now_ms()
            txn.reason = click_error
            return self._reply(f, TXN_CANCELLED)

        booking = await lock_booking(self.s, payment.booking_id)
        try:
            await apply_payment(self.s, booking, payment.booking_amount_minor, actor="click")
        except BookingError:
            txn.state = -1
            txn.cancel_time = _now_ms()
            return self._reply(f, TXN_CANCELLED)
        txn.state = 2
        txn.perform_time = _now_ms()
        payment.status = "succeeded"
        payment.paid_at = now()
        return self._reply(f, OK, merchant_confirm_id=txn.id)
