"""Google and Facebook sign-in (OAuth 2.0 authorization code flow with PKCE and a single-use state), and the
Telegram Login Widget (HMAC signature check). Provider secrets live only in the server environment."""

import base64
import hashlib
import hmac
import secrets
import time
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.tokens import hash_token, tokens_equal
from app.models import OAuthState
from app.services.accounts import AuthError, ExternalProfile, now

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 - an address, not a secret
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"
FB_VERSION = "v19.0"
FB_AUTH = f"https://www.facebook.com/{FB_VERSION}/dialog/oauth"
FB_TOKEN_URL = f"https://graph.facebook.com/{FB_VERSION}/oauth/access_token"
FB_ME = f"https://graph.facebook.com/{FB_VERSION}/me"
TELEGRAM_MAX_AGE_SECONDS = 24 * 3600
OAUTH_PROVIDERS = ("google", "facebook")


def http_client() -> httpx.AsyncClient:
    """Replaced in tests with a fake transport."""
    return httpx.AsyncClient(timeout=10)


def redirect_uri(provider: str) -> str:
    return f"{get_settings().api_url}/v1/auth/{provider}/callback"


def configured(provider: str) -> bool:
    s = get_settings()
    if provider == "google":
        return bool(s.google_client_id and s.google_client_secret.get_secret_value())
    if provider == "facebook":
        return bool(s.facebook_app_id and s.facebook_app_secret.get_secret_value())
    if provider == "telegram":
        return bool(s.telegram_bot_token.get_secret_value())
    return False


def safe_return_path(path: str | None) -> str:
    """Only a path on our own site; never a full URL (no open redirect)."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path or len(path) > 300:
        return "/"
    return path


async def start(session: AsyncSession, provider: str, return_path: str | None) -> str:
    if provider not in OAUTH_PROVIDERS or not configured(provider):
        raise AuthError("provider_unavailable", 404)
    s = get_settings()
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    session.add(OAuthState(state_hash=hash_token(state), provider=provider, code_verifier=verifier,
                           return_path=safe_return_path(return_path), expires_at=now() + timedelta(minutes=10)))
    common = {"redirect_uri": redirect_uri(provider), "state": state, "response_type": "code",
              "code_challenge": challenge, "code_challenge_method": "S256"}
    if provider == "google":
        params = {**common, "client_id": s.google_client_id, "scope": "openid email profile",
                  "prompt": "select_account"}
        return f"{GOOGLE_AUTH}?{urlencode(params)}"
    params = {**common, "client_id": s.facebook_app_id, "scope": "email,public_profile"}
    return f"{FB_AUTH}?{urlencode(params)}"


async def finish(session: AsyncSession, provider: str, code: str, state: str) -> tuple[ExternalProfile, str]:
    """Check the state, exchange the code and read the profile. Returns the profile and the return path."""
    row = await session.scalar(
        select(OAuthState).where(OAuthState.state_hash == hash_token(state)).with_for_update()
    )
    if row is None or row.provider != provider or row.expires_at < now():
        raise AuthError("invalid_state", 400)
    await session.delete(row)  # single use
    try:
        async with http_client() as http:
            profile = await (_google(http, code, row.code_verifier) if provider == "google"
                             else _facebook(http, code, row.code_verifier))
    except (httpx.HTTPError, KeyError, ValueError):
        raise AuthError("provider_failed", 502) from None
    return profile, row.return_path


async def _google(http: httpx.AsyncClient, code: str, verifier: str) -> ExternalProfile:
    s = get_settings()
    tok = (await http.post(GOOGLE_TOKEN_URL, data={
        "code": code, "client_id": s.google_client_id, "client_secret": s.google_client_secret.get_secret_value(),
        "redirect_uri": redirect_uri("google"), "grant_type": "authorization_code", "code_verifier": verifier,
    })).raise_for_status().json()
    info = (await http.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {tok['access_token']}"})
            ).raise_for_status().json()
    return ExternalProfile(provider="google", subject=str(info["sub"]), email=info.get("email"),
                           email_verified=info.get("email_verified") is True, full_name=info.get("name", ""),
                           avatar_url=info.get("picture"))


async def _facebook(http: httpx.AsyncClient, code: str, verifier: str) -> ExternalProfile:
    s = get_settings()
    secret = s.facebook_app_secret.get_secret_value()
    tok = (await http.get(FB_TOKEN_URL, params={
        "client_id": s.facebook_app_id, "client_secret": secret, "redirect_uri": redirect_uri("facebook"),
        "code": code, "code_verifier": verifier,
    })).raise_for_status().json()
    access = tok["access_token"]
    proof = hmac.new(secret.encode(), access.encode(), hashlib.sha256).hexdigest()
    me = (await http.get(FB_ME, params={"fields": "id,name,email,picture.type(large)", "access_token": access,
                                        "appsecret_proof": proof})).raise_for_status().json()
    picture = (me.get("picture") or {}).get("data", {}).get("url")
    # Facebook does not say whether it verified the address, so it is never used to join an existing account.
    return ExternalProfile(provider="facebook", subject=str(me["id"]), email=me.get("email"), email_verified=False,
                           full_name=me.get("name", ""), avatar_url=picture)


def telegram_profile(data: dict[str, Any]) -> ExternalProfile:
    """Check a Telegram Login Widget payload: HMAC-SHA256 over the sorted fields with SHA256(bot token) as key."""
    if not configured("telegram"):
        raise AuthError("provider_unavailable", 404)
    received = str(data.get("hash", ""))
    fields = {k: str(v) for k, v in data.items() if k != "hash" and v is not None}
    check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    key = hashlib.sha256(get_settings().telegram_bot_token.get_secret_value().encode()).digest()
    expected = hmac.new(key, check.encode(), hashlib.sha256).hexdigest()
    if not received or not tokens_equal(expected, received):
        raise AuthError("invalid_signature", 401)
    try:
        auth_date = int(fields["auth_date"])
        subject = str(int(fields["id"]))
    except (KeyError, ValueError):
        raise AuthError("invalid_signature", 401) from None
    if time.time() - auth_date > TELEGRAM_MAX_AGE_SECONDS:
        raise AuthError("expired", 401)
    name = " ".join(x for x in (fields.get("first_name"), fields.get("last_name")) if x)
    return ExternalProfile(provider="telegram", subject=subject, email=None, email_verified=False,
                           full_name=name, avatar_url=fields.get("photo_url"),
                           extra={"username": fields.get("username")})
