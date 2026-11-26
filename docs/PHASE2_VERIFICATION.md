> **Historical record of Phase 2.** Everything listed under "not verified yet" has since been verified — see `docs/PROGRESS.md`.

# Phase 2: what has been verified, and what has not

**Status: the backend is complete; the checks in section C run in Codespaces/GitHub Actions. Not production-ready until they pass and deployment (next step) is done.** `npm install`, `next build`, the OpenNext build and a real deployment have **not** been run yet. The build environment used for Phase 2 could not install npm packages. Run the checks in section C before relying on any of this.

## A. Verified (run during Phase 2)

| Check | How | Result |
|---|---|---|
| Migration SQL ↔ `schema.ts` parity | `scripts/check-schema-parity.py` applies the SQL to SQLite 3.53 and compares tables, columns, indexes and CHECKs | ✅ 15 tables, 179 columns, 28 indexes, 13 CHECK constraints match |
| Reviews rating 1–5 CHECK | Insert 0, 6 → rejected by `reviews_rating_ck`; 5 → accepted | ✅ |
| Other constraints | Overbooking a departure, tier without price, invalid booking status, duplicate reference, deleting a destination still used by tours | ✅ all rejected |
| Seed data | `drizzle/seed.sql` applied on top of the migration with foreign keys ON | ✅ 9 destinations, 18 tours (11 inbound / 7 domestic), 50 itinerary days, 62 price tiers, 142 departures, 12 FAQ |
| Seed content checks | Built into `build-seed-sql.ts`: itinerary length = duration, base-currency price on every tier, no overlapping tiers, all titles in en/uz/ru, every destination has ≥ 2 tours | ✅ |
| Pricing engine | 372 quotes: every tour × every tier × min/max group size × USD/UZS/EUR | ✅ 0 failures |
| SQL used by queries | Month filter (`json_each`), destination filter, seat reservation/release, stats aggregates run on the seeded DB | ✅ |
| Password hashing | PBKDF2 hash/verify, wrong password, malformed hash, dummy hash, minimum length | ✅ |
| Telegram formatting | HTML escaping (an injected `<script>` is neutralised), tel/WhatsApp/Telegram links, quote, admin link; API error and "not configured" paths with a mocked fetch | ✅ |
| CBU rate parsing, Turnstile result handling, reference retry on collision | Unit tests with mocked responses | ✅ |
| TypeScript | Strict `tsc` on all dependency-free modules and seed scripts: ✅ 0 errors. Whole project with packages stubbed out: 0 errors other than those caused by the missing packages. | ⚠️ partial |
| i18n error messages | Every error code thrown by the API or validators has an en/uz/ru message | ✅ 77 codes |

## B. Not verified yet

- Full `tsc --noEmit` with the real types of Next.js, Drizzle, Zod and next-intl.
- `next build` and `opennextjs-cloudflare build`.
- Route handlers running against a real D1 database (local `wrangler dev` / preview).
- Real Telegram delivery, real Turnstile verification, and a real CBU request (all tested only with mocks).
- `@cloudflare/workers-types` together with the DOM lib in `tsconfig`. If this causes type conflicts, run `npm run cf-typegen` and use the generated runtime types instead.

## C. How the remaining checks are run

Everything in section B is covered by tests that run in GitHub Codespaces and in GitHub Actions. Follow `docs/CODESPACES_GUIDE.md`:

| Command | What it proves |
|---|---|
| `npm run test:unit` | Pricing, passwords, references, Telegram escaping, Turnstile/CBU handling, all form validators (with the real Zod), en/uz/ru message parity |
| `npm run typecheck` | The whole project compiles with the real Next.js / Drizzle / Zod types |
| `npm run test:smoke` (29 checks) | Every main API path against the running app and the local D1 database |
| `npm run preview` + smoke test | The OpenNext Cloudflare Workers build runs and behaves the same |
| GitHub Actions "Test" | All of the above, automatically, on every push |

## D. Known limitations by design

- There are no customer pages yet (Phase 3), so visiting `/` returns 404. Only `/api/*` exists.
- Seats are reserved when a booking is **confirmed**, not when it is submitted as pending. This prevents spam from blocking departures.
- `GET /api/tours` filters and sorts in memory after one SQL query. That is fine for hundreds of tours; a large catalog would need SQL-side pagination.
- Exchange rates are refreshed manually (admin button or API). An automatic daily refresh via a Cron Trigger can be added in Phase 4.
