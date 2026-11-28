# Guliston Travel API (backend)

Python 3.12, FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Redis. This is phase 0–1 of the production
rebuild: bookings and payments, accounts, the public catalogue, service requests and the staff admin API. The Next.js site keeps running unchanged until its pages are
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
| Accounts | `app/services/accounts.py`, `app/api/auth.py` | Email + password (Argon2id, constant-time miss), Google and Facebook (authorization code + PKCE + single-use state, return path limited to our site), Telegram Login Widget (HMAC check, 24 h freshness). Sessions are HttpOnly SameSite=Lax cookies holding a random token (hash stored); state-changing calls must come from our Origin. Guest bookings join an account only once its email is proven; a social login joins an existing account only when Google vouches for the address, and then any unproven password on it is removed (stops account pre-hijacking). Facebook emails are never trusted for joining. |
| Traveller cabinet | `GET /v1/me`, `GET /v1/me/bookings` | Profile, sign-in methods, upcoming and past trips with payment state; booking pages open without the token for the owner. |
| Catalogue | `app/api/catalog.py` | Destinations, tours with filters (destination, audience, category, month, length, price, text) and sorting, tour pages with day-by-day itinerary and dated departures with seats left, all in uz/ru/en with fallback. `POST /v1/quote` returns the exact price, deposit and free-cancellation date before booking. |
| Service requests | `POST /v1/requests` | Hotels, transport and trains, guides, tailor-made trips, visas. Each kind has its own checked fields; a hidden spam-trap field drops bots. A manager quotes and turns an accepted request into a payable booking with a private payment link. |
| Cancellation | `POST /v1/bookings/{ref}/cancel` | Unpaid: always. Paid: free until `free_cancel_until` (tour's `free_cancel_days` before departure), the paid amount is recorded as owed back. After that a manager decides. |
| Staff admin | `app/api/admin.py` | Roles manager, editor, finance, admin, owner with explicit permissions (`app/core/permissions.py`). Staff must pass two-step verification (TOTP app, encrypted secret, replay-proof, 10 single-use recovery codes) and staff sessions last one day. Dashboard numbers, booking search and detail with history, notes, status changes, office payments (cash, transfer, terminal), refunds, requests pipeline, tours, prices (separate permission), itineraries, departures (never below seats sold), destinations, staff roles. Every change goes to the audit log with who and from which IP. |
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

## Two brands, one codebase

Guliston Travel and National Tours run the same code as two separate stacks, each from its own checkout of the
repository with its own `backend/.env`. They share nothing at run time: separate database, customers, staff,
payment merchant accounts and sign-in apps.

| | Guliston Travel | National Tours |
| --- | --- | --- |
| Checkout | `~/gulistantravel` | `~/silkroadtours` |
| `COMPOSE_PROJECT_NAME` | `gulistantravel-backend` | `nationaltours-backend` |
| `API_PORT` (127.0.0.1) | 3101 | 3103 |
| API host for nginx | `api.gulistantravel.uz` | `api.nationaltours.uz` |
| `NT_BRAND_NAME` | Guliston Travel | National Tours |
| `NT_BOOKING_PREFIX` / `NT_REQUEST_PREFIX` | GT / GS | NT / NS |
| `NT_SITE_URL`, `NT_API_URL`, `NT_COOKIE_DOMAIN`, `NT_ALLOWED_ORIGINS`, mail addresses | gulistantravel.uz | nationaltours.uz |

Site containers use 3100 (National Tours) and 3102 (Guliston Travel), so the four ports never clash. Each brand
also needs its own Google/Facebook sign-in app, Telegram bot and Payme/Click cashbox (or one cashbox per legal
entity, if both brands belong to the same company the owner decides).

## First owner account

On the server, after the stack is up (the password is typed at a hidden prompt):

```bash
docker compose exec api python -m app.cli create-owner owner@gulistantravel.uz "Full Name"
```

Then sign in on the site; the admin asks to set up two-step verification in Google Authenticator or a similar
app. Other staff sign up on the site, and the owner gives them a role in the admin (or with
`python -m app.cli set-role <email> manager`).

## Provider endpoints (configure in the merchant cabinets)

| Provider | URL |
| --- | --- |
| Payme | `https://<api host>/payments/payme`, account field `order_id` |
| Click | Prepare `https://<api host>/payments/click/prepare`, Complete `https://<api host>/payments/click/complete` |

## Sign-in endpoints

| Method | URL |
| --- | --- |
| Register / log in / log out | `POST /v1/auth/register`, `/v1/auth/login`, `/v1/auth/logout` |
| Email link, password reset | `POST /v1/auth/verify-email`, `/v1/auth/password/forgot`, `/v1/auth/password/reset` |
| Google, Facebook | `GET /v1/auth/{google,facebook}/start?return_to=/uz/account` (then the provider calls `/callback`) |
| Telegram | `POST /v1/auth/telegram` with the widget's data |
| What is enabled | `GET /v1/auth/providers` |

Emails (verification, reset) are written to the `outbox` table in the same transaction and sent by the worker
through Google Workspace SMTP (`smtp.gmail.com:587`, STARTTLS, app password of `no-reply@gulistantravel.uz`).
Failed sends retry with backoff; the one-time link is wiped from the row once the email is sent. Templates
in Uzbek, Russian and English live in `app/services/mailer.py`.

For delivery, the gulistantravel.uz DNS needs Google Workspace MX records, SPF
(`v=spf1 include:_spf.google.com ~all`), DKIM (generated in the Workspace admin console) and a DMARC record.

## Next

Connecting the Next.js pages and the admin screens to this API, data migration from the SQLite site,
AI trip planner with RAG on pgvector, international card acquiring. See the plan document linked in the project.
