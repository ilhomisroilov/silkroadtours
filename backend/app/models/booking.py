import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, utcnow, uuid_pk

BOOKING_STATUSES = ("awaiting_payment", "confirmed", "completed", "cancelled", "expired")
PAYMENT_STATES = ("unpaid", "deposit_paid", "paid", "refunded")


class Booking(Timestamps, Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = uuid_pk()
    reference: Mapped[str] = mapped_column(String(16), unique=True)
    access_token_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[uuid.UUID | None] = mapped_column(index=True)  # linked once accounts land

    status: Mapped[str] = mapped_column(String(20), default="awaiting_payment")
    payment_state: Mapped[str] = mapped_column(String(16), default="unpaid")
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tour_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tours.id", ondelete="SET NULL"))
    departure_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departures.id", ondelete="SET NULL"))
    tour_title_snapshot: Mapped[str] = mapped_column(String(300))
    adults: Mapped[int] = mapped_column(Integer)
    children: Mapped[int] = mapped_column(Integer, default=0)
    seats: Mapped[int] = mapped_column(Integer)

    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), index=True)
    phone: Mapped[str] = mapped_column(String(32))
    locale: Mapped[str] = mapped_column(String(2), default="en")
    special_requests: Mapped[str | None] = mapped_column(Text)

    currency: Mapped[str] = mapped_column(String(3))
    total_minor: Mapped[int] = mapped_column(Integer)
    deposit_minor: Mapped[int] = mapped_column(Integer)
    paid_minor: Mapped[int] = mapped_column(Integer, default=0)

    history: Mapped[list["BookingStatusChange"]] = relationship(
        back_populates="booking", order_by="BookingStatusChange.created_at"
    )

    __table_args__ = (
        CheckConstraint("adults >= 1 AND children >= 0 AND seats = adults + children", name="pax"),
        CheckConstraint(f"status IN {BOOKING_STATUSES}", name="status"),
        CheckConstraint(f"payment_state IN {PAYMENT_STATES}", name="payment_state"),
        CheckConstraint(
            "total_minor >= 0 AND deposit_minor >= 0 AND deposit_minor <= total_minor", name="amounts"
        ),
        CheckConstraint("paid_minor >= 0", name="paid"),
        Index("ix_bookings_status_hold", "status", "hold_expires_at"),
    )

    @property
    def amount_due_minor(self) -> int:
        """What the traveller must pay next: the deposit first, then the balance."""
        if self.paid_minor >= self.total_minor:
            return 0
        if self.paid_minor < self.deposit_minor:
            return self.deposit_minor - self.paid_minor
        return self.total_minor - self.paid_minor


class BookingStatusChange(Base):
    """Append-only history of every status change, with who made it and why."""

    __tablename__ = "booking_status_changes"

    id: Mapped[uuid.UUID] = uuid_pk()
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    actor: Mapped[str] = mapped_column(String(64))  # "system", "payme", "click", "traveller", "admin:<id>"
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    booking: Mapped[Booking] = relationship(back_populates="history")


class IdempotencyKey(Base):
    """A retried POST (double click, flaky network) returns the first result, never a second booking."""

    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    scope: Mapped[str] = mapped_column(String(40), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSONB)
    status_code: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

