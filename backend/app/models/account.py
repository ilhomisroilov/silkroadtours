import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, utcnow, uuid_pk

IDENTITY_PROVIDERS = ("password", "google", "facebook", "telegram")
ROLES = ("tourist", "manager", "editor", "finance", "admin", "owner")


class User(Timestamps, Base):
    """Travellers and staff share one table; the role decides what they may do."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str | None] = mapped_column(String(254))  # Telegram sign-ups may have none yet
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_hash: Mapped[str | None] = mapped_column(String(200))
    full_name: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str | None] = mapped_column(String(32))
    locale: Mapped[str] = mapped_column(String(2), default="en")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[str] = mapped_column(String(16), default="tourist")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    identities: Mapped[list["UserIdentity"]] = relationship(back_populates="user")

    __table_args__ = (
        CheckConstraint(f"role IN {ROLES}", name="role"),
        Index("uq_users_email", "email", unique=True, postgresql_where="email IS NOT NULL"),
    )


class UserIdentity(Base):
    """How a user signs in: a password, or an account at Google, Facebook or Telegram (one row each)."""

    __tablename__ = "user_identities"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(16))
    subject: Mapped[str] = mapped_column(String(128))  # the provider's stable user id
    email: Mapped[str | None] = mapped_column(String(254))
    profile: Mapped[dict] = mapped_column(JSONB, default=dict)  # name and picture only, no tokens
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="identities")

    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_user_identities_provider_subject"),
        CheckConstraint(f"provider IN {IDENTITY_PROVIDERS}", name="provider"),
    )


class Session(Base):
    """A signed-in browser. The cookie carries a random token; only its SHA-256 is stored here."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    method: Mapped[str] = mapped_column(String(16))  # how they signed in
    mfa_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # staff passed the second factor


class OAuthState(Base):
    """One pending Google or Facebook sign-in: binds the callback to the browser that started it (CSRF)
    and carries the PKCE verifier. Single use, expires after 10 minutes."""

    __tablename__ = "oauth_states"

    state_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(16))
    code_verifier: Mapped[str] = mapped_column(String(128))
    return_path: Mapped[str] = mapped_column(String(300), default="/")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EmailToken(Base):
    """Single-use links sent by email: address verification and password reset."""

    __tablename__ = "email_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(16))  # verify | reset
    email: Mapped[str] = mapped_column(String(254))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("purpose IN ('verify','reset')", name="purpose"),)


class OutboxMessage(Base):
    """Messages to send (email now; Telegram, WhatsApp later). Written in the same transaction as the change
    that caused them, sent by the worker, so a crash never loses or duplicates a message."""

    __tablename__ = "outbox"

    id: Mapped[uuid.UUID] = uuid_pk()
    channel: Mapped[str] = mapped_column(String(16))
    to: Mapped[str] = mapped_column(String(254))
    template: Mapped[str] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
