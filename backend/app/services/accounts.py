"""Accounts: passwords, sessions, sign-in through Google, Facebook or Telegram, and linking guest bookings.

Linking rule (prevents account takeover): a social sign-in joins an existing account by email only when the
provider vouches that it verified that email (Google with email_verified). Otherwise the person must sign in
the way they did before and connect the new method from their profile.
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.tokens import hash_token, new_access_token
from app.models import Booking, EmailToken, OutboxMessage, Session, User, UserIdentity

_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=2)
# Verifying against this when the user does not exist keeps response time the same (no account probing).
_DUMMY_HASH = _hasher.hash("not-a-real-password-0000")


class AuthError(Exception):
    def __init__(self, code: str, status: int = 400):
        super().__init__(code)
        self.code = code
        self.status = status


def now() -> datetime:
    return datetime.now(UTC)


def normalise_email(email: str | None) -> str | None:
    return email.strip().lower() if email else None


# ── passwords ───────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(user: User | None, password: str) -> bool:
    if user is None or not user.password_hash:
        try:
            _hasher.verify(_DUMMY_HASH, password)
        except VerificationError:
            pass
        return False
    try:
        return _hasher.verify(user.password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


async def register_with_password(session: AsyncSession, email: str, password: str, full_name: str,
                                 locale: str, marketing_opt_in: bool) -> User:
    email = normalise_email(email)
    if await session.scalar(select(User.id).where(User.email == email)):
        raise AuthError("email_in_use", 409)
    user = User(email=email, password_hash=hash_password(password), full_name=full_name.strip(), locale=locale,
                marketing_opt_in=marketing_opt_in)
    session.add(user)
    await session.flush()
    session.add(UserIdentity(user_id=user.id, provider="password", subject=str(user.id), email=email))
    await queue_email_token(session, user, "verify")
    return user


async def login_with_password(session: AsyncSession, email: str, password: str) -> User:
    user = await session.scalar(select(User).where(User.email == normalise_email(email)))
    if not verify_password(user, password) or not user.is_active:
        raise AuthError("invalid_credentials", 401)
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    return user


# ── email tokens ────────────────────────────────────────────────────────────

async def queue_email_token(session: AsyncSession, user: User, purpose: str) -> str:
    token = new_access_token()
    hours = 48 if purpose == "verify" else 1
    session.add(EmailToken(token_hash=hash_token(token), user_id=user.id, purpose=purpose, email=user.email,
                           expires_at=now() + timedelta(hours=hours)))
    path = "verify-email" if purpose == "verify" else "reset-password"
    link = f"{get_settings().site_url}/{user.locale}/account/{path}?token={token}"
    session.add(OutboxMessage(channel="email", to=user.email, template=f"account.{purpose}",
                              data={"name": user.full_name, "link": link, "locale": user.locale}))
    return token


async def use_email_token(session: AsyncSession, token: str, purpose: str) -> User:
    row = await session.scalar(
        select(EmailToken).where(EmailToken.token_hash == hash_token(token), EmailToken.purpose == purpose)
        .with_for_update()
    )
    if row is None or row.used_at is not None or row.expires_at < now():
        raise AuthError("invalid_token", 400)
    user = await session.get(User, row.user_id)
    if user is None or user.email != row.email:  # the address changed since the link was sent
        raise AuthError("invalid_token", 400)
    row.used_at = now()
    return user


async def verify_email(session: AsyncSession, token: str) -> User:
    user = await use_email_token(session, token, "verify")
    user.email_verified_at = user.email_verified_at or now()
    await link_guest_bookings(session, user)
    return user


async def reset_password(session: AsyncSession, token: str, new_password: str) -> User:
    user = await use_email_token(session, token, "reset")
    user.password_hash = hash_password(new_password)
    user.email_verified_at = user.email_verified_at or now()  # they proved they own the mailbox
    if not await session.scalar(select(UserIdentity.id).where(UserIdentity.user_id == user.id,
                                                               UserIdentity.provider == "password")):
        session.add(UserIdentity(user_id=user.id, provider="password", subject=str(user.id), email=user.email))
    await revoke_all_sessions(session, user.id)
    return user


# ── social sign-in ──────────────────────────────────────────────────────────

@dataclass
class ExternalProfile:
    provider: str
    subject: str
    email: str | None
    email_verified: bool
    full_name: str
    avatar_url: str | None = None
    extra: dict = field(default_factory=dict)


async def sign_in_external(session: AsyncSession, p: ExternalProfile, locale: str = "en") -> User:
    """Find the user for a Google/Facebook/Telegram account, or create one."""
    email = normalise_email(p.email)
    identity = await session.scalar(
        select(UserIdentity).where(UserIdentity.provider == p.provider, UserIdentity.subject == p.subject)
    )
    if identity is not None:
        user = await session.get(User, identity.user_id)
        if user is None or not user.is_active:
            raise AuthError("account_disabled", 403)
        identity.last_used_at = now()
        if p.email_verified and email and user.email == email and user.email_verified_at is None:
            user.email_verified_at = now()
            await link_guest_bookings(session, user)
        return user

    user = await session.scalar(select(User).where(User.email == email)) if email else None
    if user is not None and not p.email_verified:
        # Someone else could have put this address on their Facebook account; never join on it.
        raise AuthError("email_in_use_sign_in_first", 409)
    if user is not None and not user.is_active:
        raise AuthError("account_disabled", 403)
    if user is None:
        user = User(email=email, email_verified_at=now() if (email and p.email_verified) else None,
                    full_name=p.full_name or "", avatar_url=p.avatar_url, locale=locale)
        session.add(user)
        await session.flush()
    elif p.email_verified and user.email_verified_at is None:
        # The address was never proven by whoever set the password: that may have been someone squatting on it.
        # The real owner just proved it, so the unproven password and any open sessions are removed.
        user.email_verified_at = now()
        user.password_hash = None
        await session.execute(
            delete(UserIdentity).where(UserIdentity.user_id == user.id, UserIdentity.provider == "password")
        )
        await revoke_all_sessions(session, user.id)

    session.add(UserIdentity(user_id=user.id, provider=p.provider, subject=p.subject, email=email,
                             profile={"name": p.full_name, "picture": p.avatar_url, **p.extra}))
    if user.email_verified_at is not None:
        await link_guest_bookings(session, user)
    return user


async def link_guest_bookings(session: AsyncSession, user: User) -> int:
    """Attach bookings made as a guest with this (verified) email to the account."""
    if not user.email or user.email_verified_at is None:
        return 0
    result = await session.execute(
        update(Booking).where(Booking.email == user.email, Booking.user_id.is_(None)).values(user_id=user.id)
    )
    return result.rowcount or 0


# ── sessions ────────────────────────────────────────────────────────────────

async def start_session(session: AsyncSession, user: User, method: str, ip: str | None, user_agent: str | None,
                        mfa_verified: bool = False) -> str:
    token = new_access_token()
    days = get_settings().session_days if user.role == "tourist" else 1  # staff sign in again every day
    session.add(Session(user_id=user.id, token_hash=hash_token(token), method=method, ip=ip, mfa_verified=mfa_verified,
                        user_agent=(user_agent or "")[:300],
                        expires_at=now() + timedelta(days=days)))
    user.last_login_at = now()
    return token


async def session_user(session: AsyncSession, token: str | None) -> tuple[Session, User] | None:
    if not token:
        return None
    s = await session.scalar(select(Session).where(Session.token_hash == hash_token(token)))
    if s is None or s.revoked_at is not None or s.expires_at < now():
        return None
    user = await session.get(User, s.user_id)
    if user is None or not user.is_active:
        return None
    if now() - s.last_seen_at > timedelta(minutes=5):
        s.last_seen_at = now()
    return s, user


async def revoke_all_sessions(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None)).values(revoked_at=now())
    )
