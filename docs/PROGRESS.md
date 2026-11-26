# Progress log

Working branch: `mvp`. Every phase ends with the quality gates in the table below.

| Gate | Command |
|---|---|
| Types | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| Schema parity | `npm run db:check` |
| Smoke (dev) | `npm run dev` + `npm run test:smoke` |
| Smoke (Workers build) | `npm run preview` + `BASE_URL=http://localhost:8787 npm run test:smoke` |
| CI | GitHub Actions "Test" workflow |

---

## Phase 0 — verify the base (2026-11-18)

### What was fixed
| Problem | Fix | Why this fix |
|---|---|---|
| `npm install` failed: the current `@opennextjs/cloudflare` (1.20.x) needs `next >= 15.5.29`; the project pinned `next 15.5.2`. | `next` → `15.5.29` (latest Next 15 patch), `react`/`react-dom` → `19.1.10` (latest 19.1 patch), `wrangler` → `^4.164`, `@cloudflare/workers-types` → `^5.20261117`. | Same major versions, same architecture. 15.5.2 and 19.1.1 also predate the December 2025 React Server Components security fixes. |
| `drizzle-orm < 0.45.2` has a high-severity advisory (identifier escaping). | `drizzle-orm` → `^0.45.4`. | The project never builds identifiers from user input, but the upgrade is free (typecheck and tests pass unchanged). |
| No `package-lock.json` in the repo. | Committed the lockfile. | CI uses `npm ci` and installs become reproducible. |
| Server-side Turnstile checks failed in restricted networks (this sandbox cannot reach `challenges.cloudflare.com`). | `verifyTurnstile()` now answers Cloudflare's **documented test secret keys** (`1x…AA` pass, `2x…AA` fail, `3x…AA` spent) locally, without a network call. A unit test proves real secrets still go to Cloudflare. | Test keys always return a fixed answer by design, so behaviour is identical; tests no longer depend on an external service. Production uses a real secret, which is never in that list. |

### Remaining audit notes (accepted)
`npm audit` still lists moderate/high advisories in **build-time tooling only**: `postcss` bundled inside `next` (CSS build step) and `glob`/`minimatch` inside the OpenNext CLI. None of these run in the deployed Worker. They clear when Next/OpenNext ship patched dependencies; forcing them now would downgrade OpenNext to 0.3 or jump to Next 16 (an architecture change).

### Results
| Gate | Result |
|---|---|
| `typecheck` | ✅ 0 errors |
| `test:unit` | ✅ 24 passed |
| `db:check` | ✅ 15 tables, 179 columns, 28 indexes, 13 CHECKs |
| Smoke vs `next dev` | ✅ 28 passed, 0 failed, 1 skipped (Telegram — no bot configured locally) |
| Smoke vs `opennextjs-cloudflare preview` (Workers runtime) | ✅ 28 passed, 0 failed, 1 skipped |

### Worker size (API only, before any pages)
`wrangler deploy --dry-run`: **5,080.79 KiB raw / 972.34 KiB gzip**. The limit that matters is the compressed size: Workers Free = 3 MiB, Workers Paid = 10 MiB.

---

## Phase A — competitor analysis
13 sites opened in a headless browser (mobile viewport), one tour page each, Lighthouse mobile on every home page. Result: `docs/design/COMPETITOR_ANALYSIS.md`. Key gaps we target: no seller offers Uzbek or prices in so'm, nobody shows a live price that changes with group size and date, most pages are slow (LCP 4.6–16 s) and look generic.

The research environment initially blocked these sites; a personal Claude environment ("silkroadtours") was created with exactly the 14 research hosts plus OpenStreetMap tiles, Turnstile and cbu.uz allowed.

## Phase B — design system
`docs/design/DESIGN_SYSTEM.md`. Highlights and decisions:
- **Fonts chosen by measurement**, not taste: Fraunces (the earlier suggestion) has no Cyrillic and no ʻ; Cormorant + Source Sans 3 cover Latin Extended, Cyrillic, Uzbek Cyrillic and U+02BB/U+02BC.
- **Contrast fixes**: the brief's turquoise (3.1:1) and saffron (2.15:1) fail as text on ivory, so `turquoise-ink` and `saffron-ink` text variants were added; the brand colours stay for ornament and UI.
- **Original ornaments** built from geometry code (girih star lattice, {10/3} rosette, islimi scroll, suzani medallion, stepped ikat, pointed arch, ribbed dome) and shipped as static SVG files.
- **Native `<select>` in forms** (shadcn/Radix Select is used for the currency switcher): native pickers are the most accessible on phones and work before JavaScript loads.

## Phase C — customer site (en / uz / ru)
Home, `/inbound`, `/domestic`, `/tours` (URL filters, sort, pagination, empty state, pending skeleton), `/tours/[slug]` (gallery, sticky live-price card + mobile bottom bar, itinerary timeline, stays, transport, inclusions, route map, price table, departures with seats left, reviews, FAQ, related), `/destinations` + 9 landing pages, `/book/[slug]` (3 steps + Turnstile), `/booking/[reference]`, 4 service forms, `/travel-guide`, `/reviews/new`, about, contact, localized 404/error, `sitemap.xml`, `robots.txt`, JSON-LD (`TravelAgency`, `TouristTrip`+`Offer`, `TouristDestination`, `BreadcrumbList`, `FAQPage`; `AggregateRating` only when real reviews exist).

Decisions:
- **Currency**: `CURRENCY` cookie wins; otherwise UZS on Uzbek pages and on the domestic hub; otherwise the site default (USD).
- **No invented social proof**: the reviews section, ratings and "licensed operator" line render only from real data. WhatsApp/Telegram buttons render only when the owner has entered contact details.
- **Missing photos** never break the layout: a build-time manifest of `public/images` decides between the photo and a branded ornament placeholder, so there are no 404 image requests.
- **Turnstile test secrets** are answered locally (Phase 0), so tests are deterministic; real secrets always go to Cloudflare.

## Phase D — admin panel (`/admin`, Uzbek default + English)
Overview (KPIs, funnel, inbound/domestic split, top destinations, 30-day chart with table view, upcoming departures), bookings (filters, valid-only status changes that move seats, notes timeline, Telegram resend, click-to-chat), service requests, tours CMS (side-by-side en/uz/ru with missing-translation warnings, itinerary reorder, pricing grid with live converted preview, departures calendar + table, media previews, route stops picked on a map, publish/duplicate/delete-refused-with-bookings), destinations and FAQ CRUD, review moderation + "import a real review" (source URL required), settings (contact, rates + CBU refresh, Telegram test, users, own password). Status transitions are shared by UI and API (`src/lib/booking-status.ts`), so the UI never offers a change the server would refuse.

## Phase E — testing
| Suite | Where | Result (local, Workers build) |
|---|---|---|
| Unit (`npm run test:unit`) | node:test | ✅ 40 passed — incl. message-key parity en/uz/ru + admin uz/en, ICU validity, same placeholders in every language, ʻ (not ') in Uzbek, currency cookie, URL filter parsing, messenger links, image manifest, formatters |
| Schema (`npm run db:check`) | SQLite | ✅ 15 tables, 179 columns, 28 indexes, 13 CHECKs |
| Smoke (`npm run test:smoke`) | dev and Workers preview | ✅ 28 passed, 1 skipped (Telegram not configured locally) |
| Playwright e2e + axe (`npm run test:e2e`) | desktop 1366×900 and mobile 390×844 | ✅ 66 passed (one mobile test timed out once under load and passed on re-run; CI retries once) |
| axe (inside e2e) | 23 templates incl. admin | ✅ 0 serious/critical violations |
| Crawl, 22 routes × 3 locales at 390 px | Workers preview | ✅ 63/63 pages: HTTP 200, correct `lang`, no raw message keys, no console errors, no horizontal scroll (the 3 intentional 404 pages return 404) |
| Lighthouse CI (`lighthouserc.json`, 5 runs, median) | mobile, slow 4G, 4× CPU | ✅ Perf 0.99 / 0.99 / 0.96, A11y 1.00 / 0.98 / 1.00, BP 1.00, SEO 1.00, LCP 1.1 s, CLS 0.000 (home / tours / tour page) |

**Performance work** (details in DESIGN_SYSTEM.md §8): first measurement was Perf 0.67–0.78 with LCP up to 5.4 s. Causes found in the Lighthouse traces and fixed: inline SVG ornaments bloating HTML and the RSC payload (→ static files), a route-level `loading.tsx` streaming a skeleton before content (→ removed), fonts not preloaded, below-the-fold motion and heavy widgets loaded eagerly, links prefetching every route.

**CI-only layout shift (fixed).** The first CI runs failed the tour page on CLS 0.187 (perf 0.88) while local runs showed 0.002. Both runs failed with the identical value, so it was deterministic, not noise. Cause: with `font-display: swap`, `next/font`'s fallback faces are built from local Times New Roman / Arial; the GitHub runner (like Android phones) lacks them, so the long Cormorant title re-wrapped when the webfont arrived and pushed the page down. Fix: `font-display: optional` with the existing preload — CLS is now 0.000 everywhere, including with fonts deliberately delayed 1.5 s. CI now also uploads `.lighthouseci` (a hidden folder `upload-artifact` skipped) and prints a per-page summary with layout-shift culprits (`scripts/lighthouse-summary.mjs`).

**Lighthouse runs behind `scripts/compress-proxy.mjs`**: the local workerd preview sends HTML uncompressed while Cloudflare's edge compresses it in production; measuring uncompressed bytes would misrepresent real visitors.

## Phase F — deploy-ready (not deployed)
- `.github/workflows/deploy.yml`: manual run, or automatic after a successful Test run on `main`. It first checks every required secret/variable and the `database_id` and stops with instructions if anything is missing; then migrations → (optional first-run seed) → OpenNext build → `wrangler deploy` → health check.
- `docs/DEPLOYMENT.md` (click-by-click), `docs/GO_LIVE_CHECKLIST.md`.

### Worker size (final)
`wrangler deploy --dry-run`: **9,543 KiB raw / 1,847 KiB gzip (1.80 MiB)** — under the Free plan's 3 MiB limit. **Recommendation: Workers Paid ($5/month)** anyway, because the Free plan's 10 ms CPU limit per request is too low for server-rendered React pages and PBKDF2 admin sign-in.

## Open items for the owner
- Real prices, departure dates and seat counts (seed values are estimates).
- 62 photos listed in `drizzle/seed-images.txt` (9 destination heroes, 36 destination gallery images, 18 tour heroes). Until then, branded placeholders show.
- Contact details, licence number, Telegram bot + group, Turnstile production keys, domain → `docs/DEPLOYMENT.md`.
- Review the Uzbek and Russian texts of tours and FAQ with a native speaker before launch.

## Known limitations
- `npm audit` lists advisories only in build tooling (postcss inside Next, glob/minimatch inside the OpenNext CLI); none run in the deployed Worker.
- Tour listing filters/sorts in memory after one SQL query; fine for hundreds of tours.
- Exchange rates refresh on demand (admin button); a daily Cron Trigger could automate it later.
