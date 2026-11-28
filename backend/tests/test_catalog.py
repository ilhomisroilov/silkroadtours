"""Public catalogue, quotes, service requests and traveller cancellation."""

from datetime import date, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Booking, Departure, Destination, ServiceRequest, Tour, TourDay
from tests.conftest import booking_body, idem, seats_reserved


async def seed_catalog():
    async with SessionLocal() as s:
        sam = Destination(slug="samarkand", is_published=True, sort_order=1,
                          i18n={"en": {"name": "Samarkand", "tagline": "Registan"}, "uz": {"name": "Samarqand"}})
        hidden = Destination(slug="draft-place", is_published=False, i18n={"en": {"name": "Draft"}})
        s.add_all([sam, hidden])
        await s.flush()
        a = Tour(slug="silk-road", title="Silk Road", currency="USD", adult_price_minor=90_000, duration_days=8,
                 destination_id=sam.id, category="cultural", sort_order=2, compare_at_price_minor=110_000,
                 i18n={"en": {"title": "Silk Road", "included": ["Hotels", "Guide"]},
                       "ru": {"title": "Шёлковый путь"}})
        b = Tour(slug="tashkent-day", title="Tashkent Day", currency="USD", adult_price_minor=8_000, duration_days=1,
                 category="city", sort_order=1, season_months=[4, 5, 9, 10])
        off = Tour(slug="secret", title="Not yet", currency="USD", adult_price_minor=1, is_active=False)
        s.add_all([a, b, off])
        await s.flush()
        s.add_all([TourDay(tour_id=a.id, day_no=1, i18n={"en": {"title": "Arrival"}}, overnight="Tashkent"),
                   TourDay(tour_id=a.id, day_no=2, i18n={"en": {"title": "Samarkand"}})])
        soon, later = date.today() + timedelta(days=20), date.today() + timedelta(days=60)
        s.add_all([
            Departure(tour_id=a.id, start_date=later, end_date=later + timedelta(days=7), seats_total=12,
                      price_modifier_percent=10),
            Departure(tour_id=a.id, start_date=soon, end_date=soon + timedelta(days=7), seats_total=4,
                      seats_reserved=4),  # sold out
            Departure(tour_id=b.id, start_date=soon, end_date=soon, seats_total=20),
        ])
        await s.commit()


async def test_destinations_only_published_and_translated(client):
    await seed_catalog()
    r = await client.get("/v1/destinations", params={"locale": "uz"})
    assert [d["slug"] for d in r.json()] == ["samarkand"]
    assert r.json()[0]["name"] == "Samarqand"
    assert r.json()[0]["tagline"] == "Registan"  # falls back to English
    assert (await client.get("/v1/destinations/draft-place")).status_code == 404


async def test_tour_listing_filters_and_sort(client):
    await seed_catalog()
    r = (await client.get("/v1/tours")).json()
    assert [t["slug"] for t in r["items"]] == ["tashkent-day", "silk-road"]  # inactive tour hidden
    assert r["total"] == 2
    silk = r["items"][1]
    assert silk["compare_at_price"]["amount_minor"] == 110_000
    assert silk["next_departure"] == (date.today() + timedelta(days=60)).isoformat()  # sold-out date skipped

    by_price = (await client.get("/v1/tours", params={"sort": "price"})).json()["items"]
    assert by_price[0]["slug"] == "tashkent-day"
    assert [t["slug"] for t in (await client.get("/v1/tours", params={"destination": "samarkand"})).json()["items"]] \
        == ["silk-road"]
    july = (await client.get("/v1/tours", params={"month": 7})).json()["items"]
    assert [t["slug"] for t in july] == ["silk-road"]  # the day tour runs in spring and autumn only
    assert (await client.get("/v1/tours", params={"min_days": 2})).json()["total"] == 1
    assert (await client.get("/v1/tours", params={"q": "шёлков"})).json()["total"] == 1
    assert (await client.get("/v1/tours", params={"category": "city", "max_price_minor": 5_000})).json()["total"] == 0


async def test_tour_detail(client):
    await seed_catalog()
    r = await client.get("/v1/tours/silk-road", params={"locale": "ru"})
    assert r.status_code == 200
    t = r.json()
    assert t["title"] == "Шёлковый путь"
    assert t["included"] == ["Hotels", "Guide"]
    assert [d["title"] for d in t["itinerary"]] == ["Arrival", "Samarkand"]
    assert t["destination"]["slug"] == "samarkand"
    sold_out, open_ = t["departures"]
    assert sold_out["sold_out"] is True and sold_out["seats_left"] == 0
    assert open_["price"]["amount_minor"] == 99_000  # +10 % for that date
    assert (await client.get("/v1/tours/secret")).status_code == 404


async def test_quote_matches_the_booking(client, departure):
    q = await client.post("/v1/quote", json={"departure_id": str(departure.id), "adults": 2, "children": 1})
    assert q.status_code == 200, q.text
    body = q.json()
    assert body["total"]["amount_minor"] == 135_000
    assert body["deposit"]["amount_minor"] + body["balance"]["amount_minor"] == 135_000
    assert body["free_cancel_until"] == date.today().isoformat()  # 30 days before a trip that starts in 30 days

    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=2, children=1), headers=idem())
    assert r.status_code == 201
    assert r.json()["total"]["amount_minor"] == body["total"]["amount_minor"]


async def test_quote_refuses_what_booking_would_refuse(client, departure):
    big = await client.post("/v1/quote", json={"departure_id": str(departure.id), "adults": 11})
    assert big.status_code in (409, 422)
    async with SessionLocal() as s:
        (await s.get(Departure, departure.id)).status = "closed"
        await s.commit()
    closed = await client.post("/v1/quote", json={"departure_id": str(departure.id), "adults": 1})
    assert closed.status_code == 409 and closed.json()["detail"]["code"] == "departure_closed"


async def test_group_limit_of_the_tour(client, departure):
    async with SessionLocal() as s:
        (await s.get(Tour, departure.tour_id)).max_group = 3
        await s.commit()
    r = await client.post("/v1/bookings", json=booking_body(departure.id, adults=4), headers=idem())
    assert r.status_code == 422 and r.json()["detail"]["code"] == "group_too_large"


# ── service requests ────────────────────────────────────────────────────────

def request_body(**kw):
    body = {"details": {"kind": "hotel", "city": "Bukhara", "rooms": 2, "stars": 4}, "full_name": "Maria Rossi",
            "email": "Maria@Example.com", "phone": "+39 333 1234567", "adults": 2,
            "start_date": (date.today() + timedelta(days=40)).isoformat(),
            "end_date": (date.today() + timedelta(days=43)).isoformat()}
    return body | kw


async def test_request_is_saved_with_its_details(client):
    r = await client.post("/v1/requests", json=request_body())
    assert r.status_code == 201, r.text
    assert r.json()["reference"].startswith("GS-")
    async with SessionLocal() as s:
        req = await s.scalar(select(ServiceRequest))
        assert req.kind == "hotel" and req.details == {"city": "Bukhara", "rooms": 2, "stars": 4, "place_slug": None}
        assert req.email == "maria@example.com" and req.status == "new"


async def test_request_validation(client):
    bad_kind = request_body(details={"kind": "hotel", "mode": "car"})
    assert (await client.post("/v1/requests", json=bad_kind)).status_code == 422
    past = request_body(start_date=(date.today() - timedelta(days=1)).isoformat(), end_date=None)
    assert (await client.post("/v1/requests", json=past)).status_code == 422
    backwards = request_body(end_date=date.today().isoformat())
    assert (await client.post("/v1/requests", json=backwards)).status_code == 422
    transport = request_body(details={"kind": "transport", "mode": "train", "from_city": "Tashkent",
                                      "to_city": "Samarkand"})
    assert (await client.post("/v1/requests", json=transport)).status_code == 201


async def test_spam_trap_saves_nothing(client):
    r = await client.post("/v1/requests", json=request_body(website="http://spam.example"))
    assert r.status_code == 201  # the bot sees success
    async with SessionLocal() as s:
        assert await s.scalar(select(ServiceRequest)) is None


# ── traveller cancellation ──────────────────────────────────────────────────

async def _book(client, departure, **kw):
    r = await client.post("/v1/bookings", json=booking_body(departure.id, **kw), headers=idem())
    assert r.status_code == 201, r.text
    return r.json()["reference"], r.json()["access_token"]


async def test_cancel_unpaid_booking_frees_seats(client, departure):
    ref, token = await _book(client, departure)
    assert await seats_reserved(departure.id) == 2
    assert (await client.post(f"/v1/bookings/{ref}/cancel")).status_code in (401, 403, 404)
    r = await client.post(f"/v1/bookings/{ref}/cancel", headers={"X-Booking-Token": token})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    assert await seats_reserved(departure.id) == 0


async def test_cancel_paid_booking_inside_free_window(client, departure):
    ref, token = await _book(client, departure)
    async with SessionLocal() as s:
        b = await s.scalar(select(Booking).where(Booking.reference == ref))
        b.status, b.paid_minor, b.payment_state = "confirmed", 30_000, "deposit_paid"
        b.free_cancel_until = date.today() + timedelta(days=1)
        await s.commit()
    r = await client.post(f"/v1/bookings/{ref}/cancel", headers={"X-Booking-Token": token})
    assert r.status_code == 200, r.text
    assert r.json()["refund_due"]["amount_minor"] == 30_000


async def test_cancel_paid_booking_after_free_window_needs_a_manager(client, departure):
    ref, token = await _book(client, departure)
    async with SessionLocal() as s:
        b = await s.scalar(select(Booking).where(Booking.reference == ref))
        b.status, b.paid_minor, b.payment_state = "confirmed", 30_000, "deposit_paid"
        b.free_cancel_until = date.today() - timedelta(days=1)
        await s.commit()
    r = await client.post(f"/v1/bookings/{ref}/cancel", headers={"X-Booking-Token": token})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "cancel_needs_manager"
    assert await seats_reserved(departure.id) == 2
