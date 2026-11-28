import smtplib

from sqlalchemy import select

from app.db import SessionLocal
from app.models import OutboxMessage
from app.services import mailer


async def queue_verification(client, locale="uz"):
    r = await client.post("/v1/auth/register", json={"email": "ali@example.com", "password": "correct horse battery",
                                                     "full_name": "Ali <b>Valiyev</b>", "locale": locale})
    assert r.status_code == 201


async def test_verification_email_is_sent_once_and_link_is_wiped(client, monkeypatch):
    sent = []

    async def fake_send(em):
        sent.append(em)

    monkeypatch.setattr(mailer, "send_email", fake_send)
    await queue_verification(client)
    async with SessionLocal() as s:
        assert await mailer.send_pending(s) == 1
        await s.commit()
    async with SessionLocal() as s:
        assert await mailer.send_pending(s) == 0  # never twice
        msg = await s.scalar(select(OutboxMessage))
        assert msg.sent_at is not None and "link" not in msg.data

    em = sent[0]
    assert em["From"] == "Gulistan Travel <no-reply@gulistantravel.uz>"
    assert em["To"] == "ali@example.com"
    assert em["Subject"] == "Email manzilingizni tasdiqlang | Gulistan Travel"
    text = em.get_body(("plain",)).get_content()
    html_part = em.get_body(("html",)).get_content()
    assert "https://gulistantravel.uz/uz/account/verify-email?token=" in text
    assert "<b>Valiyev</b>" not in html_part and "&lt;b&gt;Valiyev&lt;/b&gt;" in html_part  # names are escaped


async def test_failed_send_is_retried_later(client, monkeypatch):
    async def broken(em):
        raise smtplib.SMTPServerDisconnected("down")

    monkeypatch.setattr(mailer, "send_email", broken)
    await queue_verification(client, locale="ru")
    async with SessionLocal() as s:
        assert await mailer.send_pending(s) == 0
        await s.commit()
    async with SessionLocal() as s:
        msg = await s.scalar(select(OutboxMessage))
        assert msg.attempts == 1 and msg.sent_at is None and "link" in msg.data


def test_every_template_has_three_languages():
    for name, langs in mailer.TEMPLATES.items():
        assert set(langs) == {"uz", "ru", "en"}, name
        for t in langs.values():
            assert set(t) == {"subject", "hello", "body", "button", "ignore"}
