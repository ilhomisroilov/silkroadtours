"""Staff sign-in with two-step verification, permissions, and the admin actions on bookings, requests and the
catalogue. Every change must land in the audit log."""

from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models import AuditLog, Booking, Departure, Payment, User, UserMfa
from app.services.accounts import hash_password
from app.services.mfa import current_step, totp
from tests.conftest import booking_body, idem, seats_reserved
from tests.test_catalog import request_body

PASSWORD = "staff password 123"
ORIGIN = {"Origin": "https://gulistantravel.uz"}


async def used_step() -> int:
    """The last code step the server accepted. The next valid code is step + 1, whichever 30 s window we are in."""
    async with SessionLocal() as s:
        return (await s.scalar(select(UserMfa))).last_step


async def make_user(email: str, role: str) -> None:
    async with SessionLocal() as s:
        s.add(User(email=email, role=role, full_name=role.title(), password_hash=hash_password(PASSWORD)))
        await s.commit()


async def staff_client(role: str, email: str | None = None) -> tuple[AsyncClient, str]:
    """A signed-in staff browser that has set up two-step verification. Returns it and the TOTP secret."""
    email = email or f"{role}@gulistantravel.uz"
    await make_user(email, role)
    c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN)
    r = await c.post("/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.json() == {"ok": True, "mfa_setup_required": True}
    secret = (await c.post("/v1/me/mfa/setup")).json()["secret"]
    r = await c.post("/v1/me/mfa/confirm", json={"code": totp(secret, current_step())})
    assert r.status_code == 200, r.text
    return c, secret


@pytest.fixture
async def owner():
    c, _ = await staff_client("owner")
    yield c
    await c.aclose()


async def book(client, departure, **kw) -> str:
    r = await client.post("/v1/bookings", json=booking_body(departure.id, **kw), headers=idem())
    assert r.status_code == 201, r.text
    return r.json()["reference"]


# ── two-step verification ───────────────────────────────────────────────────

async def test_staff_without_second_factor_cannot_use_admin(client):
    await make_user("m@gulistantravel.uz", "manager")
    await client.post("/v1/auth/login", json={"email": "m@gulistantravel.uz", "password": PASSWORD})
    r = await client.get("/v1/admin/stats")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "mfa_required"


async def test_tourists_never_reach_admin(client):
    await client.post("/v1/auth/register", json={"email": "t@example.com", "password": PASSWORD, "full_name": "T T"})
    assert (await client.get("/v1/admin/stats")).status_code == 403
    assert (await client.post("/v1/me/mfa/setup")).status_code == 200  # allowed, but gives no admin rights
    await client.post("/v1/auth/logout")
    assert (await client.get("/v1/admin/stats")).status_code == 401


async def test_sign_in_with_code_and_recovery_code(client):
    c, secret = await staff_client("manager")
    await c.aclose()
    async with SessionLocal() as s:
        mfa = await s.scalar(select(UserMfa))
        assert secret not in mfa.secret_encrypted  # stored encrypted
    step = await used_step()

    r = await client.post("/v1/auth/login", json={"email": "manager@gulistantravel.uz", "password": PASSWORD})
    assert r.json()["mfa_required"] is True and "set-cookie" not in r.headers
    challenge = r.json()["challenge"]
    used = totp(secret, step)  # already used during setup
    assert (await client.post("/v1/auth/mfa", json={"challenge": challenge, "code": used})).status_code == 401
    ok = await client.post("/v1/auth/mfa", json={"challenge": challenge, "code": totp(secret, step + 1)})
    assert ok.status_code == 200, ok.text
    assert (await client.get("/v1/admin/stats")).status_code == 200
    # the challenge is single use
    again = await client.post("/v1/auth/mfa", json={"challenge": challenge, "code": totp(secret, step + 2)})
    assert again.status_code == 401 and again.json()["detail"]["code"] == "challenge_expired"


async def test_recovery_codes_work_once(client):
    await make_user("f@gulistantravel.uz", "finance")
    await client.post("/v1/auth/login", json={"email": "f@gulistantravel.uz", "password": PASSWORD})
    secret = (await client.post("/v1/me/mfa/setup")).json()["secret"]
    codes = (await client.post("/v1/me/mfa/confirm", json={"code": totp(secret, current_step())})).json()
    recovery = codes["recovery_codes"][0]
    assert len(codes["recovery_codes"]) == 10
    assert (await client.post("/v1/me/mfa/setup")).status_code == 409  # cannot silently replace the factor

    for expected in (200, 401):
        ch = (await client.post("/v1/auth/login", json={"email": "f@gulistantravel.uz", "password": PASSWORD})).json()
        r = await client.post("/v1/auth/mfa", json={"challenge": ch["challenge"], "code": recovery})
        assert r.status_code == expected


async def test_wrong_codes_lock_the_challenge(client):
    c, secret = await staff_client("editor")
    await c.aclose()
    ch = (await client.post("/v1/auth/login", json={"email": "editor@gulistantravel.uz", "password": PASSWORD})).json()
    for _ in range(5):
        await client.post("/v1/auth/mfa", json={"challenge": ch["challenge"], "code": "000000"})
    r = await client.post("/v1/auth/mfa", json={"challenge": ch["challenge"], "code": totp(secret, await used_step() + 1)})
    assert r.status_code == 401 and r.json()["detail"]["code"] == "challenge_expired"


# ── permissions ─────────────────────────────────────────────────────────────

async def test_roles_only_do_their_job(client, departure):
    ref = await book(client, departure)
    editor, _ = await staff_client("editor")
    finance, _ = await staff_client("finance")
    manager, _ = await staff_client("manager")
    try:
        assert (await editor.get("/v1/admin/bookings")).status_code == 403
        assert (await manager.get("/v1/admin/bookings")).status_code == 200
        pay = {"amount_minor": 1000, "method": "cash", "reference": "R-1"}
        assert (await manager.post(f"/v1/admin/bookings/{ref}/payments", json=pay)).status_code == 403
        assert (await finance.post(f"/v1/admin/bookings/{ref}/status",
                                   json={"to": "cancelled", "reason": "test"})).status_code == 403
        assert (await editor.patch("/v1/admin/tours/classic-silk-road", json={"title": "New title"})).status_code == 200
        # editors write texts, they do not set prices
        r = await editor.patch("/v1/admin/tours/classic-silk-road", json={"adult_price_minor": 1})
        assert r.status_code == 403 and r.json()["detail"]["permission"] == "catalog.price"
        assert (await manager.get("/v1/admin/audit")).status_code == 403
    finally:
        for c in (editor, finance, manager):
            await c.aclose()


async def test_admin_changes_need_our_origin(owner, departure):
    r = await owner.post("/v1/admin/tours/classic-silk-road/departures",
                         json={"start_date": (date.today() + timedelta(days=90)).isoformat(), "seats_total": 10},
                         headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


# ── bookings ────────────────────────────────────────────────────────────────

async def test_list_search_and_detail(owner, client, departure):
    ref = await book(client, departure)
    await book(client, departure, email="other@example.com", full_name="Bob Brown")
    listing = (await owner.get("/v1/admin/bookings", params={"q": "anna"})).json()
    assert listing["total"] == 1 and listing["items"][0]["reference"] == ref
    assert (await owner.post(f"/v1/admin/bookings/{ref}/notes", json={"text": "Vegetarian"})).status_code == 201
    detail = (await owner.get(f"/v1/admin/bookings/{ref.lower()}")).json()
    assert detail["notes"][0]["text"] == "Vegetarian"
    assert detail["history"][0]["to"] == "awaiting_payment"


async def test_office_payment_confirms_and_refund_is_recorded(owner, client, departure):
    ref = await book(client, departure)  # 2 adults, $1 000
    too_much = await owner.post(f"/v1/admin/bookings/{ref}/payments",
                                json={"amount_minor": 100_001, "method": "cash", "reference": "K-1"})
    assert too_much.status_code == 422
    r = await owner.post(f"/v1/admin/bookings/{ref}/payments",
                         json={"amount_minor": 30_000, "method": "bank_transfer", "reference": "TR-555"})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "confirmed" and r.json()["payment_state"] == "deposit_paid"

    r = await owner.post(f"/v1/admin/bookings/{ref}/refunds", json={"amount_minor": 30_000, "reference": "RF-1"})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "cancelled" and r.json()["payment_state"] == "refunded"
    assert await seats_reserved(departure.id) == 0
    async with SessionLocal() as s:
        pays = (await s.scalars(select(Payment).order_by(Payment.order_no))).all()
        assert [(p.method, p.status) for p in pays] == [("bank_transfer", "succeeded"), ("refund", "refunded")]
        actions = (await s.scalars(select(AuditLog.action).order_by(AuditLog.id))).all()
        assert actions == ["payment.record", "payment.refund"]


async def test_manager_cancels_paid_booking_and_refund_is_owed(owner, client, departure):
    ref = await book(client, departure)
    await owner.post(f"/v1/admin/bookings/{ref}/payments",
                     json={"amount_minor": 30_000, "method": "cash", "reference": "K-2"})
    bad = await owner.post(f"/v1/admin/bookings/{ref}/status", json={"to": "expired", "reason": "nope"})
    assert bad.status_code == 422
    r = await owner.post(f"/v1/admin/bookings/{ref}/status", json={"to": "cancelled", "reason": "Visa refused"})
    assert r.status_code == 200 and r.json()["refund_due_minor"] == 30_000
    again = await owner.post(f"/v1/admin/bookings/{ref}/status", json={"to": "confirmed", "reason": "undo"})
    assert again.status_code == 409  # a cancelled booking stays cancelled
    stats = (await owner.get("/v1/admin/stats")).json()
    assert stats["refunds_due"] == [{"currency": "USD", "amount_minor": 30_000}]


# ── service requests ────────────────────────────────────────────────────────

async def test_request_flow_to_a_payable_booking(owner, client):
    ref = (await client.post("/v1/requests", json=request_body())).json()["reference"]
    async with SessionLocal() as s:
        owner_id = (await s.scalar(select(User).where(User.role == "owner"))).id
    r = await owner.patch(f"/v1/admin/requests/{ref}", json={"status": "quoted", "assigned_to": str(owner_id),
                                                              "note": "Offered Hotel Minor, 2 rooms"})
    assert r.status_code == 200 and r.json()["status"] == "quoted"
    assert (await owner.get("/v1/admin/requests", params={"mine": True})).json()["total"] == 1

    conv = await owner.post(f"/v1/admin/requests/{ref}/convert",
                            json={"title": "Hotel in Bukhara, 3 nights", "currency": "USD", "total_minor": 42_000})
    assert conv.status_code == 201, conv.text
    booking = conv.json()["booking"]
    assert booking["kind"] == "custom" and booking["status"] == "awaiting_payment"
    link = conv.json()["payment_link"]
    assert link.startswith("https://gulistantravel.uz/en/booking/GT-")

    token = link.split("token=")[1]
    seen = await client.get(f"/v1/bookings/{booking['reference']}", headers={"X-Booking-Token": token})
    assert seen.status_code == 200 and seen.json()["deposit"]["amount_minor"] == 12_600
    assert (await owner.post(f"/v1/admin/requests/{ref}/convert",
                             json={"title": "Again", "currency": "USD", "total_minor": 1})).status_code == 409


async def test_only_staff_can_be_assigned(owner, client):
    ref = (await client.post("/v1/requests", json=request_body())).json()["reference"]
    await client.post("/v1/auth/register", json={"email": "t@example.com", "password": PASSWORD, "full_name": "T T"})
    async with SessionLocal() as s:
        tourist_id = (await s.scalar(select(User).where(User.role == "tourist"))).id
    r = await owner.patch(f"/v1/admin/requests/{ref}", json={"assigned_to": str(tourist_id)})
    assert r.status_code == 422


# ── catalogue ───────────────────────────────────────────────────────────────

TOUR = {"slug": "fergana-crafts", "title": "Fergana Valley Crafts", "duration_days": 4, "adult_price_minor": 45_000,
        "i18n": {"en": {"title": "Fergana Valley Crafts", "summary": "Silk, ceramics"}}, "is_active": True}


async def test_build_a_tour_and_sell_it(owner, client):
    await owner.put("/v1/admin/destinations/fergana",
                    json={"slug": "fergana", "i18n": {"en": {"name": "Fergana"}}, "is_published": True})
    r = await owner.post("/v1/admin/tours", json=TOUR | {"destination_slug": "fergana"})
    assert r.status_code == 201, r.text
    assert (await owner.post("/v1/admin/tours", json=TOUR)).status_code == 409
    days = [{"i18n": {"en": {"title": f"Day {i}"}}} for i in range(1, 5)]
    assert (await owner.put("/v1/admin/tours/fergana-crafts/itinerary", json=days)).status_code == 200
    assert (await owner.put("/v1/admin/tours/fergana-crafts/itinerary", json=days * 2)).status_code == 422

    start = date.today() + timedelta(days=50)
    dep = await owner.post("/v1/admin/tours/fergana-crafts/departures",
                           json={"start_date": start.isoformat(), "seats_total": 6})
    assert dep.status_code == 201 and dep.json()["end_date"] == (start + timedelta(days=3)).isoformat()
    dup = await owner.post("/v1/admin/tours/fergana-crafts/departures",
                           json={"start_date": start.isoformat(), "seats_total": 6})
    assert dup.status_code == 409
    past = await owner.post("/v1/admin/tours/fergana-crafts/departures",
                            json={"start_date": date.today().isoformat(), "seats_total": 6})
    assert past.status_code == 422

    public = (await client.get("/v1/tours/fergana-crafts")).json()
    assert len(public["itinerary"]) == 4 and public["departures"][0]["seats_left"] == 6
    assert public["destination"]["slug"] == "fergana"


async def test_tour_rules_give_clear_errors(owner):
    bad = await owner.post("/v1/admin/tours", json=TOUR | {"compare_at_price_minor": 40_000})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "compare_price_not_higher"
    await owner.post("/v1/admin/tours", json=TOUR)
    r = await owner.patch("/v1/admin/tours/fergana-crafts", json={"min_group": 10, "max_group": 5})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "group_range"


async def test_departure_cannot_drop_below_sold_seats(owner, client, departure):
    await book(client, departure, adults=3)
    url = f"/v1/admin/departures/{departure.id}"
    r = await owner.patch(url, json={"seats_total": 2})
    assert r.status_code == 409 and r.json()["detail"]["reserved"] == 3
    assert (await owner.patch(url, json={"status": "cancelled"})).status_code == 409
    assert (await owner.patch(url, json={"seats_total": 3})).status_code == 200
    assert (await owner.patch(url, json={"status": "closed"})).status_code == 200
    async with SessionLocal() as s:
        d = await s.get(Departure, departure.id)
        assert (d.seats_total, d.status) == (3, "closed")


# ── staff and audit ─────────────────────────────────────────────────────────

async def test_owner_gives_roles_and_it_is_audited(owner, client):
    await client.post("/v1/auth/register", json={"email": "new@gulistantravel.uz", "password": PASSWORD,
                                                 "full_name": "New Person"})
    r = await owner.post("/v1/admin/staff/role", json={"email": "NEW@gulistantravel.uz", "role": "manager"})
    assert r.status_code == 200 and r.json()["role"] == "manager"
    assert (await client.get("/v1/me")).status_code == 401  # signed out so the new rights apply cleanly
    assert (await owner.post("/v1/admin/staff/role",
                             json={"email": "owner@gulistantravel.uz", "role": "tourist"})).status_code == 409
    assert (await owner.post("/v1/admin/staff/role",
                             json={"email": "new@gulistantravel.uz", "role": "owner"})).status_code == 422
    log = (await owner.get("/v1/admin/audit", params={"entity": "user"})).json()
    assert log[0]["action"] == "staff.role" and log[0]["data"]["to"] == "manager"


async def test_cli_creates_owner(monkeypatch):
    from app import cli

    await cli.create_owner("Boss@GulistanTravel.uz", "Ilhom", "a long owner password")
    async with SessionLocal() as s:
        u = await s.scalar(select(User).where(User.email == "boss@gulistantravel.uz"))
        assert u.role == "owner" and u.email_verified_at is not None
    monkeypatch.setattr(cli.getpass, "getpass", lambda _prompt: "short")
    with pytest.raises(SystemExit):
        cli._read_password()


async def test_stats(owner, client, departure):
    await book(client, departure)
    await client.post("/v1/requests", json=request_body())
    s = (await owner.get("/v1/admin/stats")).json()
    assert s["bookings_by_status"] == {"awaiting_payment": 1}
    assert s["open_requests"] == 1 and s["unanswered_requests"] == 1
    async with SessionLocal() as db:
        assert (await db.scalar(select(Booking))).status == "awaiting_payment"
