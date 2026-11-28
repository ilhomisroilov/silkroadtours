import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, utcnow, uuid_pk

REQUEST_KINDS = ("hotel", "transport", "guide", "custom_tour", "visa", "other")
REQUEST_STATUSES = ("new", "in_progress", "quoted", "won", "lost", "cancelled")


class ServiceRequest(Timestamps, Base):
    """A request that a manager prices by hand: hotel, transfer or train, private guide, tailor-made trip.
    When the traveller accepts the offer it becomes a payable booking (booking_id)."""

    __tablename__ = "service_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    reference: Mapped[str] = mapped_column(String(16), unique=True)
    kind: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="new")
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"))

    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), index=True)
    phone: Mapped[str] = mapped_column(String(32))
    contact_channel: Mapped[str] = mapped_column(String(16), default="email")  # email | phone | telegram | whatsapp
    locale: Mapped[str] = mapped_column(String(2), default="en")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    adults: Mapped[int] = mapped_column(Integer, default=1)
    children: Mapped[int] = mapped_column(Integer, default=0)
    budget_minor: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    details: Mapped[dict] = mapped_column(JSONB, default=dict)  # kind-specific fields, validated by the API
    message: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(64))  # utm source, "ai_assistant", ...
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"kind IN {REQUEST_KINDS}", name="kind"),
        CheckConstraint(f"status IN {REQUEST_STATUSES}", name="status"),
        CheckConstraint("adults >= 1 AND children >= 0", name="pax"),
        Index("ix_service_requests_status", "status", "created_at"),
    )


class Note(Base):
    """Internal staff note on a booking or a request. Never shown to the traveller."""

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = uuid_pk()
    entity: Mapped[str] = mapped_column(String(16))  # booking | request
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserMfa(Base):
    """Time-based one-time passwords (authenticator app). The secret is encrypted with the server key."""

    __tablename__ = "user_mfa"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    secret_encrypted: Mapped[str] = mapped_column(String(400))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_step: Mapped[int] = mapped_column(Integer, default=0)  # stops a code being used twice
    recovery_hashes: Mapped[list] = mapped_column(JSONB, default=list)


class MfaChallenge(Base):
    """Password was right; waiting for the 6-digit code. Five minutes, five tries."""

    __tablename__ = "mfa_challenges"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
