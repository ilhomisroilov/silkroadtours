# National Tours API (backend)

Python 3.12, FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Redis. This is phase 0–1 of the production
rebuild: the booking and payment core. The Next.js site keeps running unchanged until its pages are
switched to this API one by one.

## What is here

| Area | Where | Guarantees |
| --- | --- | --- |
| Bookings | `app/services/booking.py` | Price computed on the server only. Seats change under a row lock (`SELECT … FOR UPDATE`), so the last seat is never sold twice. Unpaid holds expire after `NT_BOOKING_HOLD_MINUTES` and release their seats. Every status change is checked against the allowed transitions and logged in `booking_status_changes`. |
| Idempotency | `POST /v1/bookings` | `Idempotency-Key` header is required; a retried request returns the first booking instead of creating a second one. |
| Guest access | `GET /v1/bookings/{ref}` | Needs the `X-Booking-Token` shown once at booking; only its SHA-256 is stored. Wrong token and unknown reference give the same 404. |
| Payments | `app/services/payments/` | Payme Merchant API (JSON-RPC) and Click SHOP API. The UZS amount is frozen when the payment is opened; every callback is checked against it. Payme: Basic auth, 12 h timeout, refunds after perform. Click: MD5 signature on every call. All calls are logged in `payment_events` (no card data ever reaches us). |
| Deposits | `NT_DEPOSIT_PERCENT` | The traveller pays the deposit first, then the balance. |
| Worker | `app/worker.py` | Releases expired holds every minute, refreshes CBU exchange rates every 6 h, purges idempotency records after 24 h. |
| Hardening | `app/main.py`, `docker-compose.yml` | Security headers, strict CORS, no API docs in production, Redis rate limits, non-root read-only containers with memory/CPU caps, API published on 127.0.0.1 only. |

## Run the tests locally

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
# a PostgreSQL 16 with a database the user can create tables in:
export NT_DATABASE_URL=postgresql+asyncpg://nt:nt@127.0.0.1:5432/nt_test
ruff check . && pytest -q
```

## Run the stack (staging)

```bash
cd backend
cp .env.example .env && chmod 600 .env   # fill in on the server only, never commit
docker compose up -d --build             # migrate runs first, then api and worker
curl -s http://127.0.0.1:3101/ready
```

This compose file is separate from the root one, so it never restarts the live site.

## Provider endpoints (configure in the merchant cabinets)

| Provider | URL |
| --- | --- |
| Payme | `https://<api host>/payments/payme`, account field `order_id` |
| Click | Prepare `https://<api host>/payments/click/prepare`, Complete `https://<api host>/payments/click/complete` |

## Next

Accounts (travellers and staff, Argon2id, 2FA, roles), catalogue and admin API, data migration from the
SQLite site, AI with RAG on pgvector. See the plan document linked in the project.
