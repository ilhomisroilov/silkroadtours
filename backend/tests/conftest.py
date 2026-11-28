import os

os.environ.setdefault("NT_DATABASE_URL", "postgresql+asyncpg://nt:nt@127.0.0.1:5432/nt_test")
os.environ["NT_RATE_LIMIT_ENABLED"] = "false"
os.environ["NT_PAYME_MERCHANT_ID"] = "test-merchant"
os.environ["NT_PAYME_KEY"] = "test-payme-key"
os.environ["NT_CLICK_SERVICE_ID"] = "777"
os.environ["NT_CLICK_MERCHANT_ID"] = "888"
os.environ["NT_CLICK_SECRET_KEY"] = "test-click-secret"
os.environ["NT_API_URL"] = "https://api.gulistantravel.uz"
os.environ["NT_GOOGLE_CLIENT_ID"] = "google-client"
os.environ["NT_GOOGLE_CLIENT_SECRET"] = "google-secret"
os.environ["NT_FACEBOOK_APP_ID"] = "fb-app"
os.environ["NT_FACEBOOK_APP_SECRET"] = "fb-secret"
os.environ["NT_TELEGRAM_BOT_TOKEN"] = "123456:test-bot-token"
os.environ["NT_SMTP_USERNAME"] = "no-reply@gulistantravel.uz"
os.environ["NT_SMTP_PASSWORD"] = "app-password"
os.environ["NT_TELEGRAM_BOT_USERNAME"] = "gulistantravel_bot"

import uuid  # noqa: E402
from datetime import UTC, date, datetime, timedelta  # noqa: E402
from decimal import Decimal  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, Departure, FxRate, Tour  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean():
    yield
    names = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test",
                           headers={"Origin": "https://gulistantravel.uz"}) as c:
        yield c


@pytest.fixture
async def departure():
    """A $500 tour (children $350) with 10 seats, 30 days from now, and a USD rate of 12 650 so'm."""
    async with SessionLocal() as s:
        tour = Tour(slug="classic-silk-road", title="Classic Silk Road", currency="USD",
                    adult_price_minor=50_000, child_price_minor=35_000)
        s.add(tour)
        await s.flush()
        start = date.today() + timedelta(days=30)
        dep = Departure(tour_id=tour.id, start_date=start, end_date=start + timedelta(days=7), seats_total=10)
        s.add(dep)
        s.add(FxRate(currency="USD", uzs_per_unit=Decimal("12650.00"), fetched_at=datetime.now(UTC)))
        await s.commit()
        return dep


def booking_body(departure_id, **kw):
    body = {"departure_id": str(departure_id), "adults": 2, "children": 0, "full_name": "Anna Schmidt",
            "email": "Anna@Example.com", "phone": "+49 151 2345678", "locale": "en"}
    body.update(kw)
    return body


def idem() -> dict:
    return {"Idempotency-Key": uuid.uuid4().hex}


async def seats_reserved(dep_id) -> int:
    async with SessionLocal() as s:
        return (await s.get(Departure, dep_id)).seats_reserved
