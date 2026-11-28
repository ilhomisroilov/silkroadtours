import base64
import time

from sqlalchemy import select, update

from app.db import SessionLocal
from app.models import Booking, Departure, ProviderTransaction
from tests.conftest import booking_body, idem

AUTH = {"Authorization": "Basic " + base64.b64encode(b"Paycom:test-payme-key").decode()}
DEPOSIT_TIYIN = 30_000 * 12650  # $300 deposit (30% of $1000) at 12 650 so'm, in tiyin


async def rpc(client, method, params, headers=AUTH):
    r = await client.post("/payments/payme", json={"jsonrpc": "2.0", "id": 7, "method": method, "params": params},
                          headers=headers)
    assert r.status_code == 200  # Payme protocol: always 200
    return r.json()


async def booked_payment(client, departure):
    b = (await client.post("/v1/bookings", json=booking_body(departure.id), headers=idem())).json()
    r = await client.post(f"/v1/bookings/{b['reference']}/payments", json={"provider": "payme"},
                          headers={"X-Booking-Token": b["access_token"]})
    assert r.status_code == 200, r.text
    return b, r.json()


async def test_checkout_link_has_frozen_uzs_amount(client, departure):
    _, p = await booked_payment(client, departure)
    assert p["amount_uzs_tiyin"] == DEPOSIT_TIYIN
    decoded = base64.b64decode(p["checkout_url"].rsplit("/", 1)[1]).decode()
    assert f"ac.order_id={p['order_no']}" in decoded and f"a={DEPOSIT_TIYIN}" in decoded
    assert "c=https://nationaltours.uz/en/booking/NT-" in decoded


async def test_rejects_wrong_key(client, departure):
    bad = {"Authorization": "Basic " + base64.b64encode(b"Paycom:guess").decode()}
    out = await rpc(client, "CheckPerformTransaction", {}, headers=bad)
    assert out["error"]["code"] == -32504
    assert (await rpc(client, "CheckPerformTransaction", {}, headers={}))["error"]["code"] == -32504


async def test_check_perform_validates_order_and_amount(client, departure):
    _, p = await booked_payment(client, departure)
    acc = {"order_id": str(p["order_no"])}
    assert (await rpc(client, "CheckPerformTransaction", {"amount": DEPOSIT_TIYIN, "account": acc}))["result"] == {
        "allow": True}
    wrong = await rpc(client, "CheckPerformTransaction", {"amount": DEPOSIT_TIYIN - 100, "account": acc})
    assert wrong["error"]["code"] == -31001
    missing = await rpc(client, "CheckPerformTransaction", {"amount": DEPOSIT_TIYIN, "account": {"order_id": "1"}})
    assert missing["error"]["code"] == -31050


async def test_full_payment_flow_then_refund(client, departure):
    b, p = await booked_payment(client, departure)
    acc = {"order_id": str(p["order_no"])}
    t = int(time.time() * 1000)

    created = (await rpc(client, "CreateTransaction", {"id": "pm-1", "time": t, "amount": DEPOSIT_TIYIN,
                                                        "account": acc}))["result"]
    assert created["state"] == 1
    again = (await rpc(client, "CreateTransaction", {"id": "pm-1", "time": t, "amount": DEPOSIT_TIYIN,
                                                      "account": acc}))["result"]
    assert again == created
    busy = await rpc(client, "CreateTransaction", {"id": "pm-2", "time": t, "amount": DEPOSIT_TIYIN, "account": acc})
    assert busy["error"]["code"] == -31052

    done = (await rpc(client, "PerformTransaction", {"id": "pm-1"}))["result"]
    assert done["state"] == 2 and done["perform_time"] > 0
    assert (await rpc(client, "PerformTransaction", {"id": "pm-1"}))["result"] == done  # repeat is harmless

    view = (await client.get(f"/v1/bookings/{b['reference']}", headers={"X-Booking-Token": b["access_token"]})).json()
    assert view["status"] == "confirmed" and view["payment_state"] == "deposit_paid"
    assert view["paid"]["amount_minor"] == 30_000 and view["amount_due"]["amount_minor"] == 70_000

    check = (await rpc(client, "CheckTransaction", {"id": "pm-1"}))["result"]
    assert check["state"] == 2 and check["cancel_time"] == 0

    statement = (await rpc(client, "GetStatement", {"from": t - 1000, "to": t + 1000}))["result"]
    assert [x["id"] for x in statement["transactions"]] == ["pm-1"]

    cancelled = (await rpc(client, "CancelTransaction", {"id": "pm-1", "reason": 5}))["result"]
    assert cancelled["state"] == -2
    async with SessionLocal() as s:
        booking = await s.scalar(select(Booking))
        assert booking.status == "cancelled" and booking.paid_minor == 0
        assert (await s.get(Departure, departure.id)).seats_reserved == 0


async def test_cancel_before_perform_lets_traveller_retry(client, departure):
    _, p = await booked_payment(client, departure)
    acc = {"order_id": str(p["order_no"])}
    t = int(time.time() * 1000)
    await rpc(client, "CreateTransaction", {"id": "pm-a", "time": t, "amount": DEPOSIT_TIYIN, "account": acc})
    assert (await rpc(client, "CancelTransaction", {"id": "pm-a", "reason": 3}))["result"]["state"] == -1
    retry = await rpc(client, "CreateTransaction", {"id": "pm-b", "time": t, "amount": DEPOSIT_TIYIN, "account": acc})
    assert retry["result"]["state"] == 1
    assert (await rpc(client, "PerformTransaction", {"id": "pm-a"}))["error"]["code"] == -31008


async def test_transaction_times_out_after_12_hours(client, departure):
    _, p = await booked_payment(client, departure)
    acc = {"order_id": str(p["order_no"])}
    await rpc(client, "CreateTransaction", {"id": "pm-old", "time": 1, "amount": DEPOSIT_TIYIN, "account": acc})
    async with SessionLocal() as s:
        await s.execute(update(ProviderTransaction).values(create_time=int(time.time() * 1000) - 43_200_001))
        await s.commit()
    assert (await rpc(client, "PerformTransaction", {"id": "pm-old"}))["error"]["code"] == -31008
    check = (await rpc(client, "CheckTransaction", {"id": "pm-old"}))["result"]
    assert check["state"] == -1 and check["reason"] == 4


async def test_unknown_transaction_and_method(client):
    assert (await rpc(client, "CheckTransaction", {"id": "nope"}))["error"]["code"] == -31003
    assert (await rpc(client, "DropTables", {}))["error"]["code"] == -32601
