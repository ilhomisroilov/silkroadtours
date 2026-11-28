import hashlib

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Booking
from tests.conftest import booking_body, idem

SECRET = "test-click-secret"
DEPOSIT_SUMS = f"{30_000 * 12650 / 100:.2f}"


def signed(order_no, action, click_trans_id="5001", prepare_id="", amount=DEPOSIT_SUMS, error="0", secret=SECRET):
    f = {"click_trans_id": click_trans_id, "service_id": "777", "click_paydoc_id": "9001",
         "merchant_trans_id": str(order_no), "amount": amount, "action": str(action), "error": error,
         "error_note": "Success", "sign_time": "2026-11-28 10:00:00"}
    if action == 1:
        f["merchant_prepare_id"] = str(prepare_id)
    raw = (f["click_trans_id"] + f["service_id"] + secret + f["merchant_trans_id"]
           + (f["merchant_prepare_id"] if action == 1 else "") + f["amount"] + f["action"] + f["sign_time"])
    f["sign_string"] = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324 - the Click protocol uses MD5
    return f


async def click_payment(client, departure):
    b = (await client.post("/v1/bookings", json=booking_body(departure.id), headers=idem())).json()
    p = (await client.post(f"/v1/bookings/{b['reference']}/payments", json={"provider": "click"},
                           headers={"X-Booking-Token": b["access_token"]})).json()
    return b, p


async def test_click_checkout_link(client, departure):
    _, p = await click_payment(client, departure)
    assert p["checkout_url"].startswith("https://my.click.uz/services/pay?service_id=777&merchant_id=888")
    assert f"amount={DEPOSIT_SUMS}" in p["checkout_url"]


async def test_bad_signature_is_refused(client, departure):
    _, p = await click_payment(client, departure)
    r = await client.post("/payments/click/prepare", data=signed(p["order_no"], 0, secret="guess"))
    assert r.json()["error"] == -1


async def test_prepare_and_complete_confirm_booking(client, departure):
    _, p = await click_payment(client, departure)
    prep = (await client.post("/payments/click/prepare", data=signed(p["order_no"], 0))).json()
    assert prep["error"] == 0 and prep["merchant_prepare_id"]
    done = (await client.post("/payments/click/complete",
                              data=signed(p["order_no"], 1, prepare_id=prep["merchant_prepare_id"]))).json()
    assert done["error"] == 0 and done["merchant_confirm_id"] == prep["merchant_prepare_id"]
    again = (await client.post("/payments/click/complete",
                               data=signed(p["order_no"], 1, prepare_id=prep["merchant_prepare_id"]))).json()
    assert again["error"] == -4
    async with SessionLocal() as s:
        b = await s.scalar(select(Booking))
        assert b.status == "confirmed" and b.paid_minor == 30_000


async def test_wrong_amount_and_click_side_failure(client, departure):
    _, p = await click_payment(client, departure)
    assert (await client.post("/payments/click/prepare", data=signed(p["order_no"], 0, amount="1.00"))).json()[
        "error"] == -2
    prep = (await client.post("/payments/click/prepare", data=signed(p["order_no"], 0))).json()
    failed = (await client.post("/payments/click/complete",
                                data=signed(p["order_no"], 1, prepare_id=prep["merchant_prepare_id"],
                                            error="-5017"))).json()
    assert failed["error"] == -9
    async with SessionLocal() as s:
        assert (await s.scalar(select(Booking))).status == "awaiting_payment"
