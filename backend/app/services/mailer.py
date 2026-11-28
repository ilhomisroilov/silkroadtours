"""Sends queued emails from the outbox through Google Workspace SMTP (STARTTLS, app password).

A message is sent at most a few times (backoff by attempts) and its data, which may hold a one-time link,
is wiped once sent. Templates exist in Uzbek, Russian and English."""

import asyncio
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import OutboxMessage
from app.services.accounts import now

log = logging.getLogger("nt.mailer")
MAX_ATTEMPTS = 6

TEMPLATES: dict[str, dict[str, dict[str, str]]] = {
    "account.verify": {
        "uz": {"subject": "Email manzilingizni tasdiqlang",
               "hello": "Assalomu alaykum, {name}!",
               "body": "{brand} akkauntingizni faollashtirish uchun quyidagi tugmani bosing. "
                       "Havola 48 soat amal qiladi.",
               "button": "Emailni tasdiqlash",
               "ignore": "Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xatga e'tibor bermang."},
        "ru": {"subject": "Подтвердите адрес электронной почты",
               "hello": "Здравствуйте, {name}!",
               "body": "Чтобы активировать аккаунт {brand}, нажмите кнопку ниже. Ссылка действует 48 часов.",
               "button": "Подтвердить email",
               "ignore": "Если вы не регистрировались, просто проигнорируйте это письмо."},
        "en": {"subject": "Confirm your email address",
               "hello": "Hello {name},",
               "body": "Please confirm your email to activate your {brand} account. The link is valid for 48 hours.",
               "button": "Confirm email",
               "ignore": "If you did not sign up, you can ignore this email."},
    },
    "account.reset": {
        "uz": {"subject": "Parolni tiklash",
               "hello": "Assalomu alaykum, {name}!",
               "body": "Yangi parol o'rnatish uchun quyidagi tugmani bosing. Havola 1 soat amal qiladi.",
               "button": "Yangi parol o'rnatish",
               "ignore": "Agar parolni tiklashni so'ramagan bo'lsangiz, bu xatga e'tibor bermang: parolingiz o'zgarmaydi."},
        "ru": {"subject": "Восстановление пароля",
               "hello": "Здравствуйте, {name}!",
               "body": "Чтобы задать новый пароль, нажмите кнопку ниже. Ссылка действует 1 час.",
               "button": "Задать новый пароль",
               "ignore": "Если вы не запрашивали восстановление, проигнорируйте письмо: пароль не изменится."},
        "en": {"subject": "Reset your password",
               "hello": "Hello {name},",
               "body": "Click the button below to set a new password. The link is valid for 1 hour.",
               "button": "Set a new password",
               "ignore": "If you did not ask for this, ignore this email: your password stays the same."},
    },
}


def render(msg: OutboxMessage) -> EmailMessage:
    s = get_settings()
    locale = msg.data.get("locale", "en")
    t = TEMPLATES[msg.template].get(locale) or TEMPLATES[msg.template]["en"]
    name = (msg.data.get("name") or "").strip() or {"uz": "mehmon", "ru": "гость"}.get(locale, "traveller")
    link = msg.data["link"]
    hello = t["hello"].format(name=name)
    body = t["body"].format(brand=s.brand_name)

    em = EmailMessage()
    em["Subject"] = f"{t['subject']} | {s.brand_name}"
    em["From"] = formataddr((s.brand_name, s.mail_from))
    em["To"] = msg.to
    em["Reply-To"] = s.mail_reply_to
    em["Message-ID"] = make_msgid(domain=s.mail_from.split("@")[-1])
    em.set_content(f"{hello}\n\n{body}\n\n{link}\n\n{t['ignore']}\n\n{s.brand_name}\n{s.site_url}\n")
    e = html.escape
    em.add_alternative(f"""<!doctype html><html lang="{e(locale)}"><body style="margin:0;background:#f5f1ea;font-family:Arial,sans-serif;color:#1f2a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:bold;color:#0f4c5c">{e(s.brand_name)}</td></tr>
<tr><td style="padding:8px 32px;font-size:16px;line-height:1.5"><p>{e(hello)}</p><p>{e(body)}</p></td></tr>
<tr><td style="padding:8px 32px 24px"><a href="{e(link)}" style="display:inline-block;background:#0f4c5c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">{e(t['button'])}</a></td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;color:#5b6b70;line-height:1.5">{e(t['ignore'])}<br><br><a href="{e(s.site_url)}" style="color:#5b6b70">{e(s.site_url.removeprefix('https://'))}</a></td></tr>
</table></td></tr></table></body></html>""", subtype="html")
    return em


def _smtp_send(em: EmailMessage) -> None:
    s = get_settings()
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(s.smtp_username, s.smtp_password.get_secret_value())
        smtp.send_message(em)


async def send_email(em: EmailMessage) -> None:
    """Replaced in tests."""
    await asyncio.to_thread(_smtp_send, em)


def configured() -> bool:
    s = get_settings()
    return bool(s.smtp_username and s.smtp_password.get_secret_value())


async def send_pending(session: AsyncSession, batch: int = 20) -> int:
    """Send due emails. Retries back off: a message with n failed attempts waits n² minutes."""
    if not configured():
        return 0
    rows = (await session.scalars(
        select(OutboxMessage)
        .where(OutboxMessage.channel == "email", OutboxMessage.sent_at.is_(None),
               OutboxMessage.attempts < MAX_ATTEMPTS)
        .order_by(OutboxMessage.created_at).limit(batch).with_for_update(skip_locked=True)
    )).all()
    sent = 0
    for msg in rows:
        if msg.attempts and (now() - msg.created_at).total_seconds() < 60 * msg.attempts ** 2:
            continue
        try:
            await send_email(render(msg))
        except (smtplib.SMTPException, OSError, KeyError) as exc:
            msg.attempts += 1
            log.warning("email %s to %s failed (attempt %d): %s", msg.template, msg.to, msg.attempts, exc)
            continue
        msg.sent_at = now()
        msg.attempts += 1
        msg.data = {"locale": msg.data.get("locale")}  # the one-time link is not kept after sending
        sent += 1
    return sent
