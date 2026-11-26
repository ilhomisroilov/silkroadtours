# Go-live checklist

Tick every line before you tell customers about the site. Items marked **(owner)** need your decision or content; nobody else can do them.

## Content
- [ ] **(owner) Real prices.** In **Admin → Turlar → each tour → Narxlar (Pricing)**, check every price tier against your contracts with hotels, drivers and guides. The seed prices are realistic estimates, not your rates. Also check child % and seasonal ±% on departures.
- [ ] **(owner) Departure dates and seats.** Admin → each tour → **Sanalar (Departures)**: delete dates you won't run, set real seat numbers.
- [ ] **(owner) Itineraries, inclusions, hotels.** Read every tour in English, Uzbek and Russian. The editor shows a warning wherever a translation is missing.
- [ ] **(owner) Travel guide.** Admin → **Savol-javob (FAQ)**: check visa and registration answers (rules change often).
- [ ] **(owner) Photos.** Upload your own or properly licensed photos (no stock images of other agencies, no AI images of real monuments presented as real). Either add files under `public/images/...` (paths listed in `drizzle/seed-images.txt`) or paste `https://` links in the admin **Rasmlar (Media)** tab. Until a photo exists, the site shows a branded ornament placeholder, so nothing looks broken.
- [ ] **(owner) Contact details and licence number** in Admin → Settings. The "licensed tour operator" line only appears when a licence number is set.
- [ ] Remove the local test admin accounts if you created any, and test tours/bookings from your checks (cancel them; they never count as revenue).

## Accounts and security
- [ ] Turnstile **production** keys are set (the deploy refuses the test key).
- [ ] `SESSION_SECRET` and `ADMIN_SECRET` are long random values (step 8 of DEPLOYMENT.md).
- [ ] Each staff member has their **own** admin account (Settings → Adminlar). Only the people who manage settings are **Ega (Owner)**; others are **Muharrir (Editor)**.
- [ ] **(owner) Who receives Telegram alerts:** everyone in the bookings Telegram group sees customer names and phone numbers. Keep the group to staff who handle bookings, and remove people who leave.
- [ ] Two-factor authentication is on for your Cloudflare and GitHub accounts.

## Search engines
- [ ] **Google Search Console:** https://search.google.com/search-console → **Add property** → **Domain** → follow the DNS instructions (with Cloudflare DNS, Google can add the record for you).
- [ ] In Search Console → **Sitemaps**, submit `https://YOUR-SITE/sitemap.xml` (it lists every page in English, Uzbek and Russian).
- [ ] Optional: **Yandex Webmaster** (many Russian-speaking travellers use Yandex) — add the site and the same sitemap.
- [ ] Check `https://YOUR-SITE/robots.txt` allows the site and hides `/admin` and `/api`.

## Analytics (privacy-friendly)
- [ ] Turn on **Cloudflare Web Analytics**: Cloudflare dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site** → choose your domain → **Automatic setup**. It uses no cookies and collects no personal data, so no cookie banner is needed. No code change is required.
- [ ] Do **not** add trackers that set cookies (e.g. ad pixels) without adding a consent banner first.

## Backups
- [ ] D1 keeps 30 days of history automatically (Time Travel — see DEPLOYMENT.md, "Rolling back").
- [ ] **Weekly export** of the whole database to a file you keep somewhere safe (e.g. a private cloud drive):
  ```bash
  npx wrangler d1 export silkroad-tours-db --remote --output=backup-$(date +%F).sql
  ```
  Run it in a terminal where `CLOUDFLARE_API_TOKEN` is set (for example a Codespace with the token stored as a Codespaces secret). The file contains customer data: never commit it to GitHub.
- [ ] Once, practise a restore into a **local** database: `npx wrangler d1 execute silkroad-tours-db --local --file=backup-YYYY-MM-DD.sql`.

## Final test (on the live site)
- [ ] Open the site on a phone: change language and currency, filter tours, open a tour.
- [ ] Book a tour → confirmation page shows a `UZ-…` reference → Telegram alert arrives → the booking shows in Admin → confirm it → seats go down → cancel it again.
- [ ] Send an airport transfer request → `SR-…` reference → Telegram alert.
- [ ] Click the WhatsApp and Telegram buttons and check they open **your** chats.
- [ ] `https://YOUR-SITE/api/health` answers with `"status":"ok"`.
