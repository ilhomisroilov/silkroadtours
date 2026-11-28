"""Second factor for staff: TOTP (RFC 6238, 30-second steps, 6 digits, SHA-1 as authenticator apps expect),
plus ten single-use recovery codes. A code is accepted for the current step and one step either side, and a
step that was already used is refused, so a code read over someone's shoulder cannot be replayed."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import timedelta
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.tokens import hash_token, new_access_token, tokens_equal
from app.models import MfaChallenge, User, UserMfa
from app.services.accounts import AuthError, now

STEP = 30
MAX_ATTEMPTS = 5


def _fernet() -> Fernet:
    key = get_settings().secret_key.get_secret_value()
    if not key:
        raise AuthError("mfa_unavailable", 503)
    return Fernet(key.encode())


def totp(secret_b32: str, step: int) -> str:
    key = base64.b32decode(secret_b32)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def current_step(at: float | None = None) -> int:
    return int((at if at is not None else time.time()) // STEP)


async def begin_setup(session: AsyncSession, user: User) -> dict:
    existing = await session.get(UserMfa, user.id)
    if existing is not None and existing.confirmed_at is not None:
        raise AuthError("mfa_already_enabled", 409)
    secret = base64.b32encode(secrets.token_bytes(20)).decode()
    enc = _fernet().encrypt(secret.encode()).decode()
    if existing is None:
        session.add(UserMfa(user_id=user.id, secret_encrypted=enc))
    else:
        existing.secret_encrypted = enc
    issuer = get_settings().brand_name
    label = quote(f"{issuer}:{user.email}")
    uri = f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period={STEP}"
    return {"secret": secret, "otpauth_uri": uri}


def _check_code(mfa: UserMfa, code: str) -> bool:
    try:
        secret = _fernet().decrypt(mfa.secret_encrypted.encode()).decode()
    except InvalidToken:
        return False
    code = code.strip().replace(" ", "")
    if len(code) != 6 or not code.isdigit():
        return False
    now_step = current_step()
    for step in (now_step - 1, now_step, now_step + 1):
        if step > mfa.last_step and tokens_equal(totp(secret, step), code):
            mfa.last_step = step
            return True
    return False


async def confirm_setup(session: AsyncSession, user: User, code: str) -> list[str]:
    mfa = await session.get(UserMfa, user.id, with_for_update=True)
    if mfa is None or mfa.confirmed_at is not None:
        raise AuthError("mfa_not_started", 409)
    if not _check_code(mfa, code):
        raise AuthError("invalid_code", 400)
    codes = [f"{secrets.randbelow(10**10):010d}" for _ in range(10)]
    mfa.recovery_hashes = [hash_token(c) for c in codes]
    mfa.confirmed_at = now()
    return [f"{c[:5]}-{c[5:]}" for c in codes]


async def enabled(session: AsyncSession, user_id) -> bool:
    mfa = await session.get(UserMfa, user_id)
    return mfa is not None and mfa.confirmed_at is not None


async def new_challenge(session: AsyncSession, user: User) -> str:
    token = new_access_token()
    session.add(MfaChallenge(token_hash=hash_token(token), user_id=user.id, expires_at=now() + timedelta(minutes=5)))
    return token


async def solve_challenge(session: AsyncSession, token: str, code: str) -> User:
    ch = await session.scalar(select(MfaChallenge).where(MfaChallenge.token_hash == hash_token(token))
                              .with_for_update())
    if ch is None or ch.expires_at < now() or ch.attempts >= MAX_ATTEMPTS:
        raise AuthError("challenge_expired", 401)
    mfa = await session.get(UserMfa, ch.user_id, with_for_update=True)
    ok = mfa is not None and mfa.confirmed_at is not None and _check_code(mfa, code)
    if not ok and mfa is not None:
        h = hash_token(code.strip().replace("-", "").replace(" ", ""))
        if h in (mfa.recovery_hashes or []):
            mfa.recovery_hashes = [x for x in mfa.recovery_hashes if x != h]  # single use
            ok = True
    if not ok:
        ch.attempts += 1
        raise AuthError("invalid_code", 401)
    await session.delete(ch)
    user = await session.get(User, ch.user_id)
    if user is None or not user.is_active:
        raise AuthError("account_disabled", 403)
    return user
