import hashlib
import hmac
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Booking, OutboxMessage, User, UserIdentity
from app.services import oauth
from tests.conftest import booking_body, idem

PASSWORD = "correct horse battery"


async def register(client, email="traveller@example.com", **kw):
    body = {"email": email, "password": PASSWORD, "full_name": "Ali Valiyev", "locale": "uz"} | kw
    return await client.post("/v1/auth/register", json=body)


def outbox_token(msg: OutboxMessage) -> str:
    return parse_qs(urlparse(msg.data["link"]).query)["token"][0]


# ── password accounts ───────────────────────────────────────────────────────

async def test_register_sign_in_and_profile(client):
    r = await register(client)
    assert r.status_code == 201, r.text
    assert r.json()["email_verified"] is False
    cookie = r.headers["set-cookie"]
    assert "httponly" in cookie.lower() and "samesite=lax" in cookie.lower()
    me = (await client.get("/v1/me")).json()
    assert me["email"] == "traveller@example.com" and me["sign_in_methods"] == ["password"]

    await client.post("/v1/auth/logout")
    assert (await client.get("/v1/me")).status_code == 401
    assert (await client.post("/v1/auth/login", json={"email": "TRAVELLER@example.com",
                                                        "password": PASSWORD})).status_code == 200
    assert (await client.get("/v1/me")).status_code == 200


async def test_password_rules_and_duplicates(client):
    assert (await register(client, password="short")).status_code == 422
    assert (await register(client)).status_code == 201
    assert (await register(client)).status_code == 409


async def test_wrong_password_and_unknown_email_look_the_same(client):
    await register(client)
    a = await client.post("/v1/auth/login", json={"email": "traveller@example.com", "password": "wrong password"})
    b = await client.post("/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong password"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


async def test_state_changes_need_our_origin(client):
    r = await client.post("/v1/auth/login", json={"email": "x@example.com", "password": "x"},
                          headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


async def test_email_verification_links_guest_bookings(client, departure):
    guest = await client.post("/v1/bookings", json=booking_body(departure.id, email="traveller@example.com"),
                              headers=idem())
    await register(client)
    assert (await client.get("/v1/me/bookings")).json()["upcoming"] == []  # not before the address is proven

    async with SessionLocal() as s:
        msg = await s.scalar(select(OutboxMessage).where(OutboxMessage.template == "account.verify"))
    assert (await client.post("/v1/auth/verify-email", json={"token": outbox_token(msg)})).status_code == 200
    mine = (await client.get("/v1/me/bookings")).json()
    assert [b["reference"] for b in mine["upcoming"]] == [guest.json()["reference"]]
    # the link works once only
    assert (await client.post("/v1/auth/verify-email", json={"token": outbox_token(msg)})).status_code == 400


async def test_booking_while_signed_in_belongs_to_account_and_opens_without_token(client, departure):
    await register(client)
    ref = (await client.post("/v1/bookings", json=booking_body(departure.id), headers=idem())).json()["reference"]
    assert [b["reference"] for b in (await client.get("/v1/me/bookings")).json()["upcoming"]] == [ref]
    assert (await client.get(f"/v1/bookings/{ref}")).status_code == 200
    await client.post("/v1/auth/logout")
    assert (await client.get(f"/v1/bookings/{ref}")).status_code == 404


async def test_password_reset_signs_out_everywhere(client):
    await register(client)
    assert (await client.post("/v1/auth/password/forgot", json={"email": "nobody@example.com"})).status_code == 202
    assert (await client.post("/v1/auth/password/forgot", json={"email": "traveller@example.com"})).status_code == 202
    async with SessionLocal() as s:
        msg = await s.scalar(select(OutboxMessage).where(OutboxMessage.template == "account.reset"))
    r = await client.post("/v1/auth/password/reset", json={"token": outbox_token(msg), "new_password": "a brand new secret"})
    assert r.status_code == 200
    assert (await client.get("/v1/me")).status_code == 401  # old session revoked
    ok = await client.post("/v1/auth/login", json={"email": "traveller@example.com", "password": "a brand new secret"})
    assert ok.status_code == 200


async def test_update_profile(client):
    await register(client)
    r = await client.patch("/v1/me", json={"phone": "+998 90 123 45 67", "locale": "ru", "marketing_opt_in": True})
    assert r.status_code == 200 and r.json()["locale"] == "ru" and r.json()["marketing_opt_in"] is True
    assert (await client.patch("/v1/me", json={"role": "owner"})).status_code == 422  # cannot promote yourself


# ── Google and Facebook ─────────────────────────────────────────────────────

def fake_providers(monkeypatch, google_email="ali@gmail.com", verified=True, fb_email="ali@example.com"):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.startswith(oauth.GOOGLE_TOKEN_URL):
            seen["google_form"] = parse_qs(request.content.decode())
            return httpx.Response(200, json={"access_token": "g-access"})
        if url.startswith(oauth.GOOGLE_USERINFO):
            return httpx.Response(200, json={"sub": "g-123", "email": google_email, "email_verified": verified,
                                             "name": "Ali Valiyev", "picture": "https://lh3.example/p.jpg"})
        if url.startswith(oauth.FB_TOKEN_URL):
            seen["fb_query"] = parse_qs(urlparse(url).query)
            return httpx.Response(200, json={"access_token": "fb-access"})
        if url.startswith(oauth.FB_ME):
            seen["fb_me"] = parse_qs(urlparse(url).query)
            return httpx.Response(200, json={"id": "fb-9", "name": "Ali V", "email": fb_email})
        return httpx.Response(404)

    monkeypatch.setattr(oauth, "http_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return seen


async def oauth_round_trip(client, provider, return_to="/uz/account"):
    start = await client.get(f"/v1/auth/{provider}/start", params={"return_to": return_to})
    assert start.status_code == 303
    q = parse_qs(urlparse(start.headers["location"]).query)
    assert q["code_challenge_method"] == ["S256"] and q["redirect_uri"] == [
        f"https://api.gulistantravel.uz/v1/auth/{provider}/callback"]
    return await client.get(f"/v1/auth/{provider}/callback", params={"code": "abc", "state": q["state"][0]})


async def test_google_sign_up_with_pkce(client, monkeypatch, departure):
    seen = fake_providers(monkeypatch)
    await client.post("/v1/bookings", json=booking_body(departure.id, email="ali@gmail.com"), headers=idem())
    done = await oauth_round_trip(client, "google")
    assert done.status_code == 303 and done.headers["location"] == "https://gulistantravel.uz/uz/account"
    assert seen["google_form"]["code_verifier"][0]
    me = (await client.get("/v1/me")).json()
    assert me["email"] == "ali@gmail.com" and me["email_verified"] and me["sign_in_methods"] == ["google"]
    assert len((await client.get("/v1/me/bookings")).json()["upcoming"]) == 1  # verified email: guest booking joins


async def test_state_is_single_use_and_required(client, monkeypatch):
    fake_providers(monkeypatch)
    start = await client.get("/v1/auth/google/start")
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    first = await client.get("/v1/auth/google/callback", params={"code": "abc", "state": state})
    assert "auth_error" not in first.headers["location"]
    replay = await client.get("/v1/auth/google/callback", params={"code": "abc", "state": state})
    assert "auth_error=invalid_state" in replay.headers["location"]
    forged = await client.get("/v1/auth/google/callback", params={"code": "abc", "state": "made-up"})
    assert "auth_error=invalid_state" in forged.headers["location"]


async def test_return_path_cannot_leave_our_site(client, monkeypatch):
    fake_providers(monkeypatch)
    done = await oauth_round_trip(client, "google", return_to="//evil.example/steal")
    assert done.headers["location"] == "https://gulistantravel.uz/"


async def test_google_takes_over_an_unproven_password_account(client, monkeypatch):
    """Someone registered the victim's address with a password but never proved it. When the real owner signs in
    with Google (which proved the address), the squatter's password and sessions stop working."""
    async with httpx.AsyncClient(transport=client._transport, base_url="http://test",
                                 headers={"Origin": "https://gulistantravel.uz"}) as squatter:
        await register(squatter, email="ali@gmail.com")
        fake_providers(monkeypatch)
        await oauth_round_trip(client, "google")
        assert (await squatter.get("/v1/me")).status_code == 401
        r = await squatter.post("/v1/auth/login", json={"email": "ali@gmail.com", "password": PASSWORD})
        assert r.status_code == 401
    assert (await client.get("/v1/me")).json()["sign_in_methods"] == ["google"]


async def test_facebook_never_joins_an_existing_account_by_email(client, monkeypatch):
    await register(client, email="ali@example.com")
    await client.post("/v1/auth/logout")
    seen = fake_providers(monkeypatch, fb_email="ali@example.com")
    done = await oauth_round_trip(client, "facebook")
    assert "auth_error=email_in_use_sign_in_first" in done.headers["location"]
    assert seen["fb_me"]["appsecret_proof"][0]


async def test_facebook_sign_up(client, monkeypatch):
    fake_providers(monkeypatch, fb_email="new@example.com")
    await oauth_round_trip(client, "facebook")
    me = (await client.get("/v1/me")).json()
    assert me["sign_in_methods"] == ["facebook"] and me["email_verified"] is False


# ── Telegram ────────────────────────────────────────────────────────────────

def telegram_payload(bot_token="123456:test-bot-token", auth_date=None, **kw):
    data = {"id": 777000, "first_name": "Ali", "username": "ali_uz", "auth_date": auth_date or int(time.time())} | kw
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    key = hashlib.sha256(bot_token.encode()).digest()
    return data | {"hash": hmac.new(key, check.encode(), hashlib.sha256).hexdigest()}


async def test_telegram_sign_in(client):
    r = await client.post("/v1/auth/telegram", json=telegram_payload())
    assert r.status_code == 200, r.text
    me = (await client.get("/v1/me")).json()
    assert me["sign_in_methods"] == ["telegram"] and me["email"] is None and me["full_name"] == "Ali"
    # signing in again finds the same account
    await client.post("/v1/auth/logout")
    await client.post("/v1/auth/telegram", json=telegram_payload())
    async with SessionLocal() as s:
        assert len((await s.scalars(select(User))).all()) == 1


@pytest.mark.parametrize("payload", [
    telegram_payload(bot_token="999:someone-elses-bot"),
    telegram_payload(auth_date=int(time.time()) - 2 * 86400),
    telegram_payload() | {"id": 1},
])
async def test_telegram_rejects_forged_or_old_data(client, payload):
    assert (await client.post("/v1/auth/telegram", json=payload)).status_code == 401
    async with SessionLocal() as s:
        assert (await s.scalars(select(UserIdentity))).all() == []


async def test_providers_list(client):
    out = (await client.get("/v1/auth/providers")).json()
    assert out == {"google": True, "facebook": True, "telegram": {"enabled": True, "bot_username": "gulistantravel_bot"}}


async def test_booking_link_needs_verified_email_not_just_matching(client, departure, monkeypatch):
    await client.post("/v1/bookings", json=booking_body(departure.id, email="new@example.com"), headers=idem())
    fake_providers(monkeypatch, fb_email="new@example.com")
    await oauth_round_trip(client, "facebook")  # Facebook does not prove the address
    assert (await client.get("/v1/me/bookings")).json()["upcoming"] == []
    async with SessionLocal() as s:
        assert (await s.scalar(select(Booking))).user_id is None
