# National Tours / Guliston Travel — AI-assisted travel platform (one codebase, brand per deployment)

Website, AI travel assistant, AI trip planner and admin panel for a tour agency in Jizzakh, Uzbekistan.
Next.js 15 + SQLite (libSQL) in Docker behind nginx. The site is in English, Uzbek and Russian and shows
indicative prices in USD, UZS or EUR; the admin panel is in Uzbek (default) and English.

What makes it different for travellers: a day-by-day **AI trip planner** built from the real catalogue, an
**assistant on every page** that answers in the visitor's language and links real tours, transparent indicative
prices, request-first booking with no online prepayment, and a site that keeps working (database search,
contacts) when the AI is unavailable.

## Start here
```bash
cp .env.example .env.local   # fill SESSION_SECRET, ADMIN_SECRET; AI keys optional
npm install
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000  (/en, /uz, /ru, /en/planner; admin at /admin)
npm run typecheck && npm run test:unit && npm run db:check
npm run build && npm start   # production mode
npm run test:smoke           # API checks against the running app
npm run ai:eval              # AI evaluation set (UZ/EN/RU) against the running app
docker compose up -d --build # production container on 127.0.0.1:3000
```
Going live: `docs/DEPLOYMENT.md` (Oracle Cloud Always Free, nginx, HTTPS, backups).

AI: every provider is optional and used in order Mistral → Cerebras → Gemini → OpenRouter (any OpenAI-compatible
endpoint also works). Keys live only in the server's `.env`; install them with `sudo bash deploy/set-ai-key.sh`.
With no key the assistant answers from the site's own database. The assistant searches tours, destinations,
FAQ and the travel-guide, experience and service articles (`search_site_content`) before it answers.

Admin panel (`/admin`): dashboard, bookings, leads and requests, customers (built from bookings and requests),
tours with departures and prices, destinations, articles (guides, experiences, services), media library with
uploads, reviews, newsletter subscribers with CSV export, AI conversations and usage, settings and users.

Uzbek alphabet: Uzbek text is stored and shown in the current Latin spelling (oʻ, gʻ, sh, ch).
`src/lib/uz-alphabet.ts` can show it in the new alphabet (ö, ğ, ş, ç) instead: build with
`NEXT_PUBLIC_UZ_SPELLING=new` (in `.env` for `docker compose up -d --build`).

Photos: real, open-licensed images from Wikimedia Commons; author, licence and source for every file are in
`public/images/credits.json` and shown on the page where a photo is used as the hero.

## Documents
| File | What it covers |
|---|---|
| `docs/ARCHITECTURE.md` | Stack, folders, data model, every API endpoint |
| `docs/design/DESIGN_SYSTEM.md` | The "Modern Silk Road" design system: palette, type, ornaments, motion, performance budget |
| `docs/design/COMPETITOR_ANALYSIS.md` | 13 competitor and benchmark sites compared |
| `docs/DEPLOYMENT.md` | Docker + nginx deployment to Oracle Cloud, operations, backups, AI configuration |
| `docs/GO_LIVE_CHECKLIST.md` | Content, security, SEO, analytics and backups before launch |
| `docs/MANUAL_SETUP.md` | Telegram bot, photos, content review, schema changes |
| `docs/PROGRESS.md` | What was built, test results, decisions, open items |
| `docs/CODESPACES_GUIDE.md` | Testing everything in a browser-based Codespace |
