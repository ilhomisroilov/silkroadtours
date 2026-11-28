"""The same code runs one API per brand. A National Tours deployment must show its own name and references."""

import pytest

from app.config import get_settings
from app.models import OutboxMessage
from app.services import mailer
from tests.conftest import booking_body, idem
from tests.test_catalog import request_body


@pytest.fixture
def national(monkeypatch):
    s = get_settings()
    for key, value in {"brand_name": "National Tours", "booking_prefix": "NT", "request_prefix": "NS",
                       "site_url": "https://nationaltours.uz", "mail_from": "no-reply@nationaltours.uz"}.items():
        monkeypatch.setattr(s, key, value)


async def test_references_follow_the_brand(national, client, departure):
    b = await client.post("/v1/bookings", json=booking_body(departure.id), headers=idem())
    assert b.status_code == 201 and b.json()["reference"].startswith("NT-")
    r = await client.post("/v1/requests", json=request_body())
    assert r.json()["reference"].startswith("NS-")


def test_emails_carry_the_brand(national):
    msg = OutboxMessage(channel="email", to="a@example.com", template="account.verify",
                        data={"name": "Ali", "link": "https://nationaltours.uz/uz/account/verify-email?token=x",
                              "locale": "ru"})
    em = mailer.render(msg)
    text = em.get_body(("plain",)).get_content()
    assert "National Tours" in em["From"] and em["Subject"].endswith("| National Tours")
    assert "аккаунт National Tours" in text and "Gulistan" not in em.as_string()


def test_prefix_must_be_short_capitals():
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError):
        Settings(booking_prefix="gt-")
