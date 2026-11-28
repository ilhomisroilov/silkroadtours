import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Sequence,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, utcnow, uuid_pk

PAYMENT_STATUSES = ("pending", "succeeded", "refunded", "cancelled")
PROVIDERS = ("payme", "click", "manual")
MANUAL_METHODS = ("cash", "bank_transfer", "card_terminal", "refund")
ORDER_NO_SEQ = Sequence("payment_order_no_seq", start=100001)


class Payment(Timestamps, Base):
    """One attempt to pay a fixed amount for a booking through one provider.

    The amount is frozen in the provider's currency when the attempt is created, so a provider callback
    is always checked against an exact number, never recomputed from a moving exchange rate.
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = uuid_pk()
    order_no: Mapped[int] = mapped_column(
        BigInteger, ORDER_NO_SEQ, server_default=ORDER_NO_SEQ.next_value(), unique=True
    )  # short numeric id shown to providers
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"), index=True)
    provider: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="pending")

    # Amount credited to the booking, in the booking currency
    booking_amount_minor: Mapped[int] = mapped_column(Integer)
    # Amount the provider charges (UZS tiyin for Payme and Click) and the rate used
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="UZS")
    fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))

    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Manual entries by staff (cash at the office, bank transfer, terminal, refunds paid out)
    method: Mapped[str | None] = mapped_column(String(16))
    external_reference: Mapped[str | None] = mapped_column(String(120))
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    transactions: Mapped[list["ProviderTransaction"]] = relationship(back_populates="payment")

    __table_args__ = (
        CheckConstraint(f"provider IN {PROVIDERS}", name="provider"),
        CheckConstraint(f"status IN {PAYMENT_STATUSES}", name="status"),
        CheckConstraint("amount_minor > 0 AND booking_amount_minor > 0", name="amounts"),
    )


class ProviderTransaction(Base):
    """A transaction as the provider sees it. One payment can have several (a cancelled try, then a new one).

    state: 1 = created/prepared, 2 = performed (money taken), -1 = cancelled before perform,
    -2 = cancelled after perform (refund). Times are kept in milliseconds exactly as the protocols use them.
    """

    __tablename__ = "provider_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payments.id", ondelete="RESTRICT"), index=True)
    provider: Mapped[str] = mapped_column(String(16))
    external_id: Mapped[str] = mapped_column(String(64))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    state: Mapped[int] = mapped_column(Integer, default=1)
    provider_time: Mapped[int] = mapped_column(BigInteger)  # when the provider created it (ms)
    create_time: Mapped[int] = mapped_column(BigInteger)  # when we registered it (ms)
    perform_time: Mapped[int] = mapped_column(BigInteger, default=0)
    cancel_time: Mapped[int] = mapped_column(BigInteger, default=0)
    reason: Mapped[int | None] = mapped_column(Integer)

    payment: Mapped[Payment] = relationship(back_populates="transactions")

    __table_args__ = (
        UniqueConstraint("provider", "external_id", name="uq_provider_transactions_external"),
        CheckConstraint("state IN (1, 2, -1, -2)", name="state"),
        Index("ix_provider_transactions_time", "provider", "provider_time"),
    )


class PaymentEvent(Base):
    """Append-only log of every provider call: what came in, what we answered. Card data never reaches us."""

    __tablename__ = "payment_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(16))
    method: Mapped[str] = mapped_column(String(64))
    payment_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    request: Mapped[dict] = mapped_column(JSONB)
    response: Mapped[dict] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FxRate(Base):
    """UZS per one unit of a currency (e.g. 12 650.50 per USD), refreshed from the Central Bank daily."""

    __tablename__ = "fx_rates"

    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    uzs_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

