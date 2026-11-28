"""Sign-up, sign-in and the traveller's own account. Authentication is an HttpOnly session cookie; every
state-changing call must come from our own site (Origin check), which together with SameSite=Lax stops CSRF."""

from datetime import date
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.ratelimit import client_ip, limit
from app.core.tokens import hash_token
from app.db import get_session
from app.models import Booking, Departure, Session, User, UserIdentity
from app.services import accounts, oauth
from app.services.accounts import AuthError

router = APIRouter(prefix="/v1", tags=["accounts"])


# ── plumbing ────────────────────────────────────────────────────────────────

def same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer", "")
        origin = "/".join(referer.split("/")[:3]) if referer else None
    if origin not in get_settings().allowed_origins:
        raise HTTPException(403, {"code": "bad_origin"})


def set_session_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(s.session_cookie, token, max_age=s.session_days * 86400, httponly=True,
                        secure=s.env != "development", samesite="lax", domain=s.cookie_domain, path="/")


def clear_session_cookie(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.session_cookie, domain=s.cookie_domain, path="/")


async def current(request: Request, session: AsyncSession = Depends(get_session)) -> tuple[Session, User]:
    found = await accounts.session_user(session, request.cookies.get(get_settings().session_cookie))
    if found is None:
        raise HTTPException(401, {"code": "not_signed_in"})
    await session.commit()  # keeps last_seen_at fresh
    return found


async def signed_in(session: AsyncSession, response: Response, request: Request, user: User, method: str) -> None:
    token = await accounts.start_session(session, user, method, client_ip(request), request.headers.get("user-agent"))
    await session.commit()
    set_session_cookie(response, token)


def auth_error(exc: AuthError) -> HTTPException:
    return HTTPException(exc.status, {"code": exc.code})


# ── schemas ─────────────────────────────────────────────────────────────────

Password = Field(min_length=10, max_length=128)
Locale = Literal["uz", "ru", "en"]


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Password
    full_name: str = Field(min_length=2, max_length=200)
    locale: Locale = "en"
    marketing_opt_in: bool = False


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=20, max_length=200)


class ResetIn(TokenIn):
    new_password: str = Password


class ForgotIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    full_name: str | None = Field(None, min_length=2, max_length=200)
    phone: str | None = Field(None, pattern=r"^\+?[0-9][0-9 ()\-]{6,24}$")
    locale: Locale | None = None
    marketing_opt_in: bool | None = None


class TelegramIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    first_name: str | None = Field(None, max_length=200)
    last_name: str | None = Field(None, max_length=200)
    username: str | None = Field(None, max_length=64)
    photo_url: str | None = Field(None, max_length=500)
    auth_date: int
    hash: str = Field(min_length=64, max_length=64)


def profile_out(user: User, identities: list[UserIdentity]) -> dict:
    return {
        "id": str(user.id), "email": user.email, "email_verified": user.email_verified_at is not None,
        "full_name": user.full_name, "phone": user.phone, "locale": user.locale, "avatar_url": user.avatar_url,
        "marketing_opt_in": user.marketing_opt_in, "role": user.role,
        "sign_in_methods": sorted({i.provider for i in identities}),
    }


# ── password accounts ───────────────────────────────────────────────────────

@router.post("/auth/register", status_code=201,
             dependencies=[Depends(same_origin), Depends(limit("auth.register", times=5, seconds=3600))])
async def register(body: RegisterIn, request: Request, response: Response,
                   session: AsyncSession = Depends(get_session)):
    if body.password.lower() == body.email.lower():
        raise HTTPException(422, {"code": "weak_password"})
    try:
        user = await accounts.register_with_password(session, body.email, body.password, body.full_name, body.locale,
                                                     body.marketing_opt_in)
    except AuthError as e:
        raise auth_error(e) from None
    await signed_in(session, response, request, user, "password")
    return profile_out(user, [UserIdentity(provider="password", subject="")])


@router.post("/auth/login", dependencies=[Depends(same_origin), Depends(limit("auth.login", times=10, seconds=900))])
async def login(body: LoginIn, request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    try:
        user = await accounts.login_with_password(session, body.email, body.password)
    except AuthError as e:
        raise auth_error(e) from None
    await signed_in(session, response, request, user, "password")
    return {"ok": True}


@router.post("/auth/logout", dependencies=[Depends(same_origin)])
async def logout(request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    token = request.cookies.get(get_settings().session_cookie)
    if token:
        s = await session.scalar(select(Session).where(Session.token_hash == hash_token(token)))
        if s is not None and s.revoked_at is None:
            s.revoked_at = accounts.now()
            await session.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.post("/auth/verify-email", dependencies=[Depends(same_origin), Depends(limit("auth.token", 20, 900))])
async def verify_email(body: TokenIn, session: AsyncSession = Depends(get_session)):
    try:
        await accounts.verify_email(session, body.token)
    except AuthError as e:
        raise auth_error(e) from None
    await session.commit()
    return {"ok": True}


@router.post("/auth/password/forgot", status_code=202,
             dependencies=[Depends(same_origin), Depends(limit("auth.forgot", times=5, seconds=3600))])
async def forgot(body: ForgotIn, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(select(User).where(User.email == accounts.normalise_email(body.email)))
    if user is not None and user.is_active:
        await accounts.queue_email_token(session, user, "reset")
        await session.commit()
    return {"ok": True}  # same answer whether or not the address has an account


@router.post("/auth/password/reset", dependencies=[Depends(same_origin), Depends(limit("auth.token", 20, 900))])
async def reset(body: ResetIn, session: AsyncSession = Depends(get_session)):
    try:
        await accounts.reset_password(session, body.token, body.new_password)
    except AuthError as e:
        raise auth_error(e) from None
    await session.commit()
    return {"ok": True}


# ── Google, Facebook, Telegram ──────────────────────────────────────────────

@router.get("/auth/providers")
async def providers():
    s = get_settings()
    return {
        "google": oauth.configured("google"),
        "facebook": oauth.configured("facebook"),
        "telegram": {"enabled": oauth.configured("telegram"), "bot_username": s.telegram_bot_username or None},
    }


@router.get("/auth/{provider}/start", dependencies=[Depends(limit("auth.oauth", times=30, seconds=900))])
async def oauth_start(provider: Literal["google", "facebook"], return_to: str | None = None,
                      session: AsyncSession = Depends(get_session)):
    try:
        url = await oauth.start(session, provider, return_to)
    except AuthError as e:
        raise auth_error(e) from None
    await session.commit()
    return RedirectResponse(url, status_code=303)


@router.get("/auth/{provider}/callback", dependencies=[Depends(limit("auth.oauth", times=30, seconds=900))])
async def oauth_callback(provider: Literal["google", "facebook"], request: Request, code: str | None = None,
                         state: str | None = None, session: AsyncSession = Depends(get_session)):
    site = get_settings().site_url
    if not code or not state:
        return RedirectResponse(f"{site}/?{urlencode({'auth_error': 'cancelled'})}", status_code=303)
    try:
        profile, return_path = await oauth.finish(session, provider, code, state)
        user = await accounts.sign_in_external(session, profile)
    except AuthError as e:
        await session.commit()  # the used state stays deleted
        return RedirectResponse(f"{site}/?{urlencode({'auth_error': e.code})}", status_code=303)
    response = RedirectResponse(f"{site}{return_path}", status_code=303)
    await signed_in(session, response, request, user, provider)
    return response


@router.post("/auth/telegram", dependencies=[Depends(same_origin), Depends(limit("auth.oauth", 30, 900))])
async def telegram(body: TelegramIn, request: Request, response: Response,
                   session: AsyncSession = Depends(get_session)):
    try:
        profile = oauth.telegram_profile(body.model_dump(exclude_none=True))
        user = await accounts.sign_in_external(session, profile)
    except AuthError as e:
        raise auth_error(e) from None
    await signed_in(session, response, request, user, "telegram")
    return {"ok": True}


# ── the traveller's own account ─────────────────────────────────────────────

@router.get("/me")
async def me(found=Depends(current), session: AsyncSession = Depends(get_session)):
    _, user = found
    ids = (await session.scalars(select(UserIdentity).where(UserIdentity.user_id == user.id))).all()
    return profile_out(user, list(ids))


@router.patch("/me", dependencies=[Depends(same_origin)])
async def update_me(body: ProfileIn, found=Depends(current), session: AsyncSession = Depends(get_session)):
    _, user = found
    user = await session.get(User, user.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(user, k, v)
    await session.commit()
    ids = (await session.scalars(select(UserIdentity).where(UserIdentity.user_id == user.id))).all()
    return profile_out(user, list(ids))


@router.get("/me/bookings")
async def my_bookings(found=Depends(current), session: AsyncSession = Depends(get_session)):
    _, user = found
    rows = (await session.execute(
        select(Booking, Departure.start_date, Departure.end_date)
        .outerjoin(Departure, Departure.id == Booking.departure_id)
        .where(Booking.user_id == user.id)
        .order_by(Departure.start_date.desc().nulls_last(), Booking.created_at.desc())
    )).all()
    today = date.today()
    out = {"upcoming": [], "past": []}
    for b, start, end in rows:
        item = {
            "reference": b.reference, "status": b.status, "payment_state": b.payment_state,
            "tour_title": b.tour_title_snapshot, "start_date": start.isoformat() if start else None,
            "end_date": end.isoformat() if end else None, "adults": b.adults, "children": b.children,
            "currency": b.currency, "total_minor": b.total_minor, "paid_minor": b.paid_minor,
            "amount_due_minor": b.amount_due_minor,
        }
        past = (end or start or today) < today or b.status in ("completed", "cancelled", "expired")
        out["past" if past else "upcoming"].append(item)
    out["upcoming"].reverse()  # soonest trip first
    return out


@router.post("/me/logout-everywhere", dependencies=[Depends(same_origin)])
async def logout_everywhere(response: Response, found=Depends(current), session: AsyncSession = Depends(get_session)):
    _, user = found
    await accounts.revoke_all_sessions(session, user.id)
    await session.commit()
    clear_session_cookie(response)
    return {"ok": True}
