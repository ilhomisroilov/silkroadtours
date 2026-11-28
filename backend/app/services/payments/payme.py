"""Payme Merchant API (JSON-RPC 2.0). Payme calls us; we answer every call with HTTP 200 and either a
result or an error object, exactly as the protocol prescribes.

Methods: CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction,
CheckTransaction, GetStatement. Amounts are in tiyin. Times are milliseconds since the epoch.
"""

import base64
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.tokens import tokens_equal
from app.models import Payment, ProviderTransaction
from app.services.booking import (
    BookingError,
    apply_payment,
    can_take_payment,
    extend_hold,
    lock_booking,
    now,
    reverse_payment,
)

# Error codes from the Payme Merchant API specification
AUTH = -32504
PARSE = -32700
METHOD = -32601
INVALID_AMOUNT = -31001
TXN_NOT_FOUND = -31003
CANNOT_CANCEL = -31007
CANNOT_PERFORM = -31008
ORDER_NOT_FOUND = -31050
ORDER_NOT_PAYABLE = -31051
ORDER_BUSY = -31052

REASON_TIMEOUT = 4

_MESSAGES = {
    AUTH: ("Avtorizatsiya xatosi", "Ошибка авторизации", "Authorization failed"),
    PARSE: ("So'rov noto'g'ri", "Неверный запрос", "Invalid request"),
    METHOD: ("Metod topilmadi", "Метод не найден", "Method not found"),
    INVALID_AMOUNT: ("Summa noto'g'ri", "Неверная сумма", "Invalid amount"),
    TXN_NOT_FOUND: ("Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"),
    CANNOT_CANCEL: ("Bekor qilib bo'lmaydi", "Невозможно отменить транзакцию", "Transaction cannot be cancelled"),
    CANNOT_PERFORM: ("Bajarib bo'lmaydi", "Невозможно выполнить операцию", "Operation cannot be performed"),
    ORDER_NOT_FOUND: ("Buyurtma topilmadi", "Заказ не найден", "Order not found"),
    ORDER_NOT_PAYABLE: ("Buyurtmani to'lab bo'lmaydi", "Заказ нельзя оплатить", "Order cannot be paid"),
    ORDER_BUSY: ("Buyurtma boshqa to'lovda", "Заказ уже в процессе оплаты", "Order is being paid already"),
}


class PaymeError(Exception):
    def __init__(self, code: int, data: str | None = None):
        super().__init__(code)
        self.code = code
        self.data = data

    def as_dict(self) -> dict[str, Any]:
        uz, ru, en = _MESSAGES.get(self.code, ("Xato", "Ошибка", "Error"))
        err: dict[str, Any] = {"code": self.code, "message": {"uz": uz, "ru": ru, "en": en}}
        if self.data:
            err["data"] = self.data
        return err


def now_ms() -> int:
    return int(time.time() * 1000)


def check_auth(header: str | None) -> bool:
    """Payme sends Basic auth with login "Paycom" and the cashbox key as the password."""
    key = get_settings().payme_key.get_secret_value()
    if not key or not header or not header.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(header[6:], validate=True).decode()
    except (ValueError, UnicodeDecodeError):
        return False
    login, _, password = decoded.partition(":")
    return login == "Paycom" and tokens_equal(password, key)


class PaymeHandler:
    def __init__(self, session: AsyncSession):
        self.s = session
        self.timeout_ms = get_settings().payme_timeout_ms

    async def dispatch(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        handlers = {
            "CheckPerformTransaction": self.check_perform,
            "CreateTransaction": self.create,
            "PerformTransaction": self.perform,
            "CancelTransaction": self.cancel,
            "CheckTransaction": self.check,
            "GetStatement": self.statement,
        }
        fn = handlers.get(method)
        if fn is None:
            raise PaymeError(METHOD, method)
        if not isinstance(params, dict):
            raise PaymeError(PARSE, "params")
        return await fn(params)

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _payment_for_account(self, params: dict[str, Any], lock: bool = False) -> Payment:
        account = params.get("account") or {}
        raw = account.get("order_id")
        try:
            order_no = int(str(raw))
        except (TypeError, ValueError):
            raise PaymeError(ORDER_NOT_FOUND, "order_id") from None
        q = select(Payment).where(Payment.order_no == order_no, Payment.provider == "payme")
        if lock:
            q = q.with_for_update()
        payment = await self.s.scalar(q)
        if payment is None:
            raise PaymeError(ORDER_NOT_FOUND, "order_id")
        return payment

    @staticmethod
    def _amount(params: dict[str, Any]) -> int:
        amount = params.get("amount")
        if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
            raise PaymeError(INVALID_AMOUNT, "amount")
        return amount

    async def _validate_order(self, payment: Payment, amount: int) -> None:
        if amount != payment.amount_minor:
            raise PaymeError(INVALID_AMOUNT, "amount")
        if payment.status != "pending":
            raise PaymeError(ORDER_NOT_PAYABLE, "order_id")
        booking = await lock_booking(self.s, payment.booking_id)
        if not can_take_payment(booking) or booking.amount_due_minor < payment.booking_amount_minor:
            raise PaymeError(ORDER_NOT_PAYABLE, "order_id")

    async def _txn(self, params: dict[str, Any]) -> ProviderTransaction:
        txn_id = params.get("id")
        if not isinstance(txn_id, str) or not txn_id:
            raise PaymeError(TXN_NOT_FOUND, "id")
        txn = await self.s.scalar(
            select(ProviderTransaction)
            .where(ProviderTransaction.provider == "payme", ProviderTransaction.external_id == txn_id)
            .with_for_update()
        )
        if txn is None:
            raise PaymeError(TXN_NOT_FOUND, "id")
        return txn

    def _expired(self, txn: ProviderTransaction) -> bool:
        return now_ms() - txn.create_time > self.timeout_ms

    async def _cancel_txn(self, txn: ProviderTransaction, reason: int) -> None:
        txn.state = -1
        txn.cancel_time = now_ms()
        txn.reason = reason

    # ── methods ──────────────────────────────────────────────────────────────

    async def check_perform(self, params: dict[str, Any]) -> dict[str, Any]:
        amount = self._amount(params)
        payment = await self._payment_for_account(params)
        await self._validate_order(payment, amount)
        return {"allow": True}

    async def create(self, params: dict[str, Any]) -> dict[str, Any]:
        txn_id = params.get("id")
        if not isinstance(txn_id, str) or not txn_id:
            raise PaymeError(PARSE, "id")
        provider_time = params.get("time")
        if not isinstance(provider_time, int):
            raise PaymeError(PARSE, "time")

        existing = await self.s.scalar(
            select(ProviderTransaction)
            .where(ProviderTransaction.provider == "payme", ProviderTransaction.external_id == txn_id)
            .with_for_update()
        )
        if existing is not None:
            if existing.state != 1:
                raise PaymeError(CANNOT_PERFORM, "state")
            if self._expired(existing):
                await self._cancel_txn(existing, REASON_TIMEOUT)
                await self.s.commit()
                raise PaymeError(CANNOT_PERFORM, "timeout")
            return {"create_time": existing.create_time, "transaction": str(existing.id), "state": existing.state}

        amount = self._amount(params)
        payment = await self._payment_for_account(params, lock=True)
        await self._validate_order(payment, amount)
        busy = await self.s.scalar(
            select(ProviderTransaction.id).where(ProviderTransaction.payment_id == payment.id,
                                                 ProviderTransaction.state == 1)
        )
        if busy is not None:
            raise PaymeError(ORDER_BUSY, "order_id")

        txn = ProviderTransaction(payment_id=payment.id, provider="payme", external_id=txn_id,
                                  amount_minor=amount, state=1, provider_time=provider_time,
                                  create_time=now_ms())
        self.s.add(txn)
        booking = await lock_booking(self.s, payment.booking_id)
        await extend_hold(booking, minutes=get_settings().booking_hold_minutes)
        await self.s.flush()
        return {"create_time": txn.create_time, "transaction": str(txn.id), "state": txn.state}

    async def perform(self, params: dict[str, Any]) -> dict[str, Any]:
        txn = await self._txn(params)
        if txn.state == 2:
            return {"transaction": str(txn.id), "perform_time": txn.perform_time, "state": 2}
        if txn.state != 1:
            raise PaymeError(CANNOT_PERFORM, "state")
        if self._expired(txn):
            await self._cancel_txn(txn, REASON_TIMEOUT)
            await self.s.commit()
            raise PaymeError(CANNOT_PERFORM, "timeout")

        payment = await self.s.scalar(select(Payment).where(Payment.id == txn.payment_id).with_for_update())
        booking = await lock_booking(self.s, payment.booking_id)
        try:
            await apply_payment(self.s, booking, payment.booking_amount_minor, actor="payme")
        except BookingError:
            raise PaymeError(CANNOT_PERFORM, "order_id") from None
        txn.state = 2
        txn.perform_time = now_ms()
        payment.status = "succeeded"
        payment.paid_at = now()
        return {"transaction": str(txn.id), "perform_time": txn.perform_time, "state": 2}

    async def cancel(self, params: dict[str, Any]) -> dict[str, Any]:
        txn = await self._txn(params)
        reason = params.get("reason")
        reason = reason if isinstance(reason, int) else None
        if txn.state == 1:
            await self._cancel_txn(txn, reason or 0)
        elif txn.state == 2:
            payment = await self.s.scalar(select(Payment).where(Payment.id == txn.payment_id).with_for_update())
            booking = await lock_booking(self.s, payment.booking_id)
            try:
                await reverse_payment(self.s, booking, payment.booking_amount_minor, actor="payme")
            except BookingError:
                raise PaymeError(CANNOT_CANCEL, "id") from None
            txn.state = -2
            txn.cancel_time = now_ms()
            txn.reason = reason
            payment.status = "refunded"
        return {"transaction": str(txn.id), "cancel_time": txn.cancel_time, "state": txn.state}

    async def check(self, params: dict[str, Any]) -> dict[str, Any]:
        txn = await self._txn(params)
        return {
            "create_time": txn.create_time,
            "perform_time": txn.perform_time,
            "cancel_time": txn.cancel_time,
            "transaction": str(txn.id),
            "state": txn.state,
            "reason": txn.reason,
        }

    async def statement(self, params: dict[str, Any]) -> dict[str, Any]:
        frm, to = params.get("from"), params.get("to")
        if not isinstance(frm, int) or not isinstance(to, int):
            raise PaymeError(PARSE, "from")
        rows = (
            await self.s.execute(
                select(ProviderTransaction, Payment.order_no)
                .join(Payment, Payment.id == ProviderTransaction.payment_id)
                .where(ProviderTransaction.provider == "payme", ProviderTransaction.provider_time >= frm,
                       ProviderTransaction.provider_time <= to)
                .order_by(ProviderTransaction.provider_time)
            )
        ).all()
        return {
            "transactions": [
                {
                    "id": t.external_id,
                    "time": t.provider_time,
                    "amount": t.amount_minor,
                    "account": {"order_id": str(order_no)},
                    "create_time": t.create_time,
                    "perform_time": t.perform_time,
                    "cancel_time": t.cancel_time,
                    "transaction": str(t.id),
                    "state": t.state,
                    "reason": t.reason,
                }
                for t, order_no in rows
            ]
        }
