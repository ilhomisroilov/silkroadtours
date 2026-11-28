import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Booking, Departure
from app.services.booking import expire_holds
from tests.conftest import booking_body, idem, seats_reserved


async def test_create_booking_prices_on_server_and_holds_seats(client, departure):
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=2, children=1), headers=idem())
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["reference"].startswith("GT-")
    assert b["status"] == "awaiting_payment"
    assert b["total"] == {"currency": "USD", "amount_minor": 135_000}
    assert b["deposit"]["amount_minor"] == 40_500  # 30%
    assert b["amount_due"]["amount_minor"] == 40_500
    assert len(b["access_token"]) > 30
    assert await seats_reserved(departure.id) == 3


async def test_client_cannot_send_its_own_price(client, departure):
    r = await client.post("/v1/bookings", json=booking_body(departure.id, total_minor=1), headers=idem())
    assert r.status_code == 422


async def test_idempotency_key_returns_first_result(client, departure):
    headers = idem()
    body = booking_body(departure.id)
    first = await client.post("/v1/bookings", json=body, headers=headers)
    second = await client.post("/v1/bookings", json=body, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["reference"] == second.json()["reference"]
    assert await seats_reserved(departure.id) == 2

    other = await client.post("/v1/bookings", json=booking_body(departure.id, adults=3), headers=headers)
    assert other.status_code == 422


async def test_idempotency_key_is_required(client, departure):
    r = await client.post("/v1/bookings", json=booking_body(departure.id))
    assert r.status_code == 422


async def test_not_enough_seats(client, departure):
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=31), headers=idem())
    assert r.status_code == 422  # above the per-booking limit is invalid input
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=11), headers=idem())
    assert r.status_code == 409
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=8), headers=idem())
    assert r.status_code == 201
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=3), headers=idem())
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "not_enough_seats"


async def test_last_seats_cannot_be_sold_twice(client, departure):
    """Ten travellers press "book" for the last 2 seats at the same moment: exactly one booking wins."""
    await client.post("/v1/bookings", json=booking_body(departure.id, adults=8), headers=idem())
    results = await asyncio.gather(*[
        client.post("/v1/bookings", json=booking_body(departure.id, adults=2), headers=idem()) for _ in range(10)
    ])
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1 and codes.count(409) == 9
    assert await seats_reserved(departure.id) == 10


async def test_booking_needs_its_token(client, departure):
    created = (await client.post("/v1/bookings", json=booking_body(departure.id), headers=idem())).json()
    ref = created["reference"]
    assert (await client.get(f"/v1/bookings/{ref}")).status_code == 404
    assert (await client.get(f"/v1/bookings/{ref}", headers={"X-Booking-Token": "wrong"})).status_code == 404
    ok = await client.get(f"/v1/bookings/{ref}", headers={"X-Booking-Token": created["access_token"]})
    assert ok.status_code == 200 and ok.json()["reference"] == ref
    assert "access_token" not in ok.json()


async def test_expired_hold_releases_seats(client, departure):
    await client.post("/v1/bookings", json=booking_body(departure.id, adults=4), headers=idem())
    async with SessionLocal() as s:
        b = await s.scalar(select(Booking))
        b.hold_expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await s.commit()
    async with SessionLocal() as s:
        assert await expire_holds(s) == 1
        await s.commit()
    async with SessionLocal() as s:
        assert (await s.scalar(select(Booking))).status == "expired"
        assert (await s.get(Departure, departure.id)).seats_reserved == 0


async def test_security_headers(client):
    r = await client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert (await client.get("/docs")).status_code == 404
