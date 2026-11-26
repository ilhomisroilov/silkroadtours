# Manual setup still required

Everything below needs your accounts, secrets or content. None of it can be done from the code.

> **Deploying for the first time?** Follow `docs/DEPLOYMENT.md` — it covers sections 1, 2, 4, 5 and 7 below step by step, including how to do them from the Cloudflare and GitHub websites. This file stays as the technical reference.

## 1. Cloudflare D1 database

```bash
npx wrangler login
npx wrangler d1 create silkroad-tours-db
```
Paste the printed `database_id` into `wrangler.toml` in place of `REPLACE_WITH_OUTPUT_OF_wrangler_d1_create`. Then:

```bash
npm run db:migrate:local      # local dev database (.wrangler/)
npm run db:seed:local         # 9 destinations, 18 tours, departures, FAQ, settings
npm run db:migrate:remote     # production
npm run db:seed:remote
```
Departure dates are generated from the day you build the seed, so build it right before seeding. To reload the catalog later, use `npm run db:seed:reset:local`. This replaces destinations, tours and FAQ but keeps bookings.

## 2. Secrets

Copy `.dev.vars.example` to `.dev.vars` for local work. For production:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put SESSION_SECRET        # openssl rand -base64 32
npx wrangler secret put ADMIN_SECRET          # openssl rand -base64 32 (min 16 chars)
npx wrangler secret put TURNSTILE_SECRET_KEY
```
In `wrangler.toml` `[vars]`, set `SITE_URL` to your real domain. It is used for the "Open in admin" links in Telegram messages.

## 3. Telegram bot

1. In Telegram, open **@BotFather**, send `/newbot` and copy the token. That is `TELEGRAM_BOT_TOKEN`.
2. Create a group for the booking team and add the bot to it.
3. Send any message in the group, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`. For groups it is a negative number such as `-1001234567890`. That is `TELEGRAM_CHAT_ID`.
4. After deploying and signing in, open **Admin → Sozlamalar (Settings) → Telegram** and click **Telegramga sinov xabari**. A test message should appear in the group.

If a booking alert fails, the booking is still saved. `telegram_notified_at` stays empty, and you can resend with `POST /api/admin/bookings/{id}/notify`.

## 4. Cloudflare Turnstile (spam protection)

Cloudflare dashboard → Turnstile → Add widget for your domain. Put the **site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (a build variable) and the **secret** in `TURNSTILE_SECRET_KEY`. The values in the example files are Cloudflare's official always-pass test keys and must not be used in production.

## 5. First admin account

After deploying with `ADMIN_SECRET` set:

```bash
curl -X POST https://YOUR-DOMAIN/api/admin/auth/bootstrap \
  -H "content-type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"email":"you@agency.uz","name":"Your Name","password":"at-least-12-characters"}'
```
This works only while there are no admins. Afterwards, owners add staff through `/api/admin/users`.

## 6. Agency contact details

The seed stores the agency name "Silk Road Tours" and the address "Jizzakh, Uzbekistan". Phone, email, WhatsApp, Telegram and licence number are left empty on purpose. Set the real values in **Admin → Settings → Contact details**. Empty fields are hidden on the site (including the floating WhatsApp/Telegram buttons); they are never shown as placeholders.

## 7. Exchange rates

The seed uses USD = 11,973.44 UZS (the Central Bank rate of 13 Nov 2026) and USD = 0.86 EUR. After deploying, click **Admin → Settings → Exchange rates → Refresh from Central Bank**, or enter rates manually there.

## 8. Photos (62 images)

The seed refers to images under `/public/images/...`. The full list is in `drizzle/seed-images.txt` (9 destination heroes, 36 destination gallery photos, 18 tour heroes). Use your own photos or properly licensed ones. JPEG files about 1600 px wide (under 300 KB) are enough; warm golden-hour light, people, crafts and food alongside monuments. You can also point any image to an `https://` URL (for example a Cloudflare R2 public bucket) in the admin **Media** tab.

Until a photo exists the site shows a branded ornament placeholder with the place name, so nothing looks broken. Local files are detected when the site is built: after adding files under `public/images/`, commit them and the next deploy picks them up.

## 9. Review the seed content

Prices, itineraries, hotel types and FAQ answers are realistic starting points written for this agency. **They are not your actual contracted rates.** Check every price tier and inclusion before going live. Visa and registration rules were current in November 2026 and change often.

There are **no reviews** in the seed. Fake testimonials would mislead customers. Reviews come from:
- guests with a completed booking (`POST /api/reviews`, checked by reference and email, marked verified), or
- real Google or TripAdvisor reviews that you copy in with a link to the original (`POST /api/admin/reviews`).

## 10. Schema changes later

The migration `0000_init.sql` is hand-written and checked against `src/db/schema.ts` by `npm run db:check`, a Python script that applies the migrations to SQLite and compares every table, column, index and CHECK constraint. For future changes:

```bash
npm run db:new-migration -- add_something   # creates drizzle/migrations/0001_add_something.sql
# write the SQL, update src/db/schema.ts to match
npm run db:check
npm run db:migrate:local
```
Do not run `drizzle-kit generate` on this project. It has no snapshot of the hand-written 0000 migration and would try to recreate every table.
