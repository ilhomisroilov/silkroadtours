# Competitor analysis

**Date:** 18 November 2026. **Method:** every site was opened in headless Chromium at an iPhone 13 viewport (390 × 844). For each site we recorded the page structure (headings, navigation, forms, structured data, `lang`/`hreflang`, image `alt` coverage), looked at the first screen, and opened one tour or product page. Lighthouse 12 (mobile, simulated throttling) was run once per home page from a cloud container.

**Caveats.** Lighthouse is a single run from one location, so treat the scores as indicative (±10 points). G Adventures and Airbnb served a reduced page to the headless browser: G Adventures rendered without its stylesheet and both had a suspiciously small page weight. Their scores are marked *unreliable*. GetYourGuide returned a bot challenge (HTTP 403), and yurtcamp.uz redirected to a host this research environment could not reach, so those two are assessed only from what was visible. No screenshots or text from these sites are committed. Everything below is our own description.

---

## 1. Comparison table

| Site | Type | Lighthouse mobile (Perf / A11y / BP / SEO) | LCP | Page weight | Languages | Prices & currency | Booking flow | Cultural identity |
|---|---|---|---|---|---|---|---|---|
| **Advantour** | UZ/Central Asia specialist | 74 / 75 / 96 / 92 | 5.5 s | 1.1 MB | EN, RU, DE, FR, ES, IT, JA (no Uzbek) | US$ "from" + per-person date table; no currency switch, no so'm | "Book Now" or "Request More Info" form (≈ 47 inputs on tour page) | Generic: blue/teal brand, promotional banners; cookie dialog covers most of the mobile first screen |
| **Nuratau Travel** | UZ trekking/eco specialist | 84 / 97 / 96 / 100 | 1.4 s | 0.8 MB | EN only | No prices on home page | "Enquire Now"; search by destination + duration | Clean serif headings, neutral palette; little sense of place beyond photos |
| **uzbekistan.travel** | Official tourism portal | 61 / 76 / 96 / 75 | **16.3 s** | **8.9 MB** | 12 languages incl. UZ, RU | Not a seller | None (inspiration only) | Strong photography, a minimal dome/mountain logo mark; 17 of 41 home images have no `alt`, page has no `<title>` |
| **Caravanistan** | Central Asia guide + tours | 76 / 96 / 77 / 92 | 5.7 s | 1.1 MB | EN only | No prices on home page | Tailor-made enquiry | Mountain photo with heavy text overlay; generic WordPress look |
| **Intrepid** | International operator | 67 / 94 / 96 / 100 | 2.0 s | **11.7 MB** | Regional English sites | Price + "deal" price, departures list ("Show 194 departures") | Departure picker → online booking; sticky bottom bar on mobile | Strong corporate brand, no place identity. A geo-redirect modal covered the tour page on load |
| **G Adventures** | International operator | *94 / 85 / 96 / 92 (unreliable)* | — | — | EN | — | Online booking | Generic; 98 `<script>` tags on the home page |
| **Wild Frontiers** | Adventure specialist | 78 / 73 / 96 / 92 | 4.8 s | 0.9 MB | Regional English sites | — | Search: holiday type, destination, month → "Plan your trip" | Classy dark/gold serif look, but a template feel; `<html>` has no `lang` |
| **Steppes Travel** | Luxury tailor-made | 77 / 95 / 92 / 100 | 4.8 s | 1.6 MB | EN-GB / EN-US | £ from-price, single supplement, key-facts table, currency selector | "Reserve place" + enquiry form | Elegant photography; cookie banner covers half the mobile screen |
| **Remote Lands** | Luxury Asia | 79 / 94 / 96 / 92 | 3.7 s | 1.3 MB | EN | $ from-price; dates table | Enquire only | Dramatic photography, gold small caps; no regional motif |
| **Exodus** | Adventure operator | 78 / 97 / 96 / 100 | 4.6 s | 0.6 MB (2.3 MB HTML on tour page, 282 images) | Regional English sites | £, departures grouped by month with availability | Sticky bottom bar (phone + "Dates & prices"), online booking | Generic; product images still blank after 3.5 s on mobile |
| **GetYourGuide** | Booking benchmark | blocked (403) | — | — | many | multi-currency switch | Participants + date → live total | n/a |
| **Airbnb Experiences** | Booking benchmark | *100 / 100 / 96 / 100 (unreliable)* | 1.4 s | — | many | multi-currency switch | Date + guests → live total; sticky bottom booking bar | n/a |

**Tour page section order observed**
- Advantour: title + key facts → itinerary (day by day) → included / not included → **dates & prices per person** → accommodation → enquiry form → reviews → similar tours. JSON-LD `TouristTrip` + `Product`.
- Intrepid: title → why you'll love it → featured stay → itinerary → included (accommodation, transport, destinations) → before you book → **dates & prices** → reviews. Static route map image near the top. JSON-LD `TravelAgency`, `BreadcrumbList`, `Product`.
- Exodus: title → overview with key information → itinerary → **dates & prices grouped by month** → accommodation → essential info → reviews. Sticky mobile CTA bar.
- Steppes: hero → expert → highlights → suggested itinerary → includes/excludes → other dates → reserve. Key-facts table (start, end, days, price from, single supplement).

Nobody we tested shows a **live price that changes as you choose group size, private vs group, and date**. Every site shows a static "from" price or a table and sends you to a form.

---

## 2. Top 10 patterns worth adopting

1. **Key-facts strip under the tour title**: days, group size, difficulty, start/end city, from-price. Seen in different forms on Advantour, Steppes and Exodus; it answers "is this for me?" in one glance.
2. **Day-by-day itinerary accordion** with meals and overnight per day. Universal among the operators; we add distance and walking hours from our data.
3. **Departure list with seats-left status**, grouped by month (Exodus, Intrepid, Advantour). We render it from real `tour_departures` (seats total − booked).
4. **Sticky price card with live recalculation** on desktop and a **sticky bottom "Book" bar** on mobile (Intrepid, Exodus, Airbnb). We go further: the card recalculates from our quote API.
5. **Participant stepper + date picker → total** (GetYourGuide/Airbnb pattern), with per-person and total shown together.
6. **Price table by group size**, which is honest pricing for private tours (Nuratau-style tiers, Advantour per-person dates table).
7. **Included / not included checklists** side by side, near the price (everyone).
8. **Search by destination + month + guests on the home page** (Nuratau, Wild Frontiers, Intrepid).
9. **Breadcrumbs + `TouristTrip`/`Product` JSON-LD** on tour pages (Advantour, Intrepid, Exodus, Remote Lands). We use `TouristTrip` + `Offer`, plus `BreadcrumbList`, `FAQPage` and `TravelAgency`.
10. **Route map near the top of the tour page** (Intrepid's static map). Ours is interactive (Leaflet + OpenStreetMap) with numbered day stops, loaded only when visible.

## 3. Weaknesses we will beat

| Weakness seen | Where | Our answer |
|---|---|---|
| **No prices in so'm and no Uzbek-language selling site.** The only Uzbek interface is the official portal, which sells nothing. | All sellers | Full `/uz` site, UZS-first domestic hub, live currency switcher (USD/UZS/EUR) on every price. |
| **Enquiry-only flows with no live price** | Every specialist; Steppes, Remote Lands | Live quote in the sticky card for group/private, adults, children and departure; booking in 3 steps with the price carried through. |
| **Slow, heavy pages**: LCP 4.6–16 s, up to 11.7 MB | uzbekistan.travel, Intrepid, Advantour, Caravanistan, Steppes, Exodus | Server-rendered pages, self-hosted fonts, SVG ornament instead of decorative images, no jQuery/sliders, map loaded on demand. Budget: LCP < 2.5 s, Lighthouse ≥ 90. |
| **First screen blocked by overlays** (cookie dialogs, geo-redirect modals, sale banners) | Advantour, Steppes, Intrepid, Remote Lands | No cookie banner needed (no tracking cookies; only functional `NEXT_LOCALE`/`CURRENCY`), no pop-ups. |
| **Accessibility gaps**: missing `alt`, missing `lang`, low contrast | uzbekistan.travel (17 images without `alt`, no title), Wild Frontiers (no `lang`), Advantour (a11y 75) | WCAG 2.2 AA tokens with contrast checked, `lang` per locale, axe in CI with 0 serious/critical violations. |
| **Generic stock look, little cultural identity** | Most sites | Original girih/islimi/suzani/ikat ornament system, arch-masked imagery, lapis/turquoise/saffron palette, branded fallbacks instead of stock photos. |
| **Invented-looking urgency and sale banners** | Several | No fake urgency. Seats-left only from real data; reviews only from the `reviews` table. |

## 4. How Silk Road Tours will be visually stronger and more distinctive

Every site in this list either looks like a global brand template (Intrepid, G Adventures, Exodus) or uses a quiet neutral template with landscape photos (Nuratau, Caravanistan, Wild Frontiers, Steppes). The official portal has the best photography but a slow, inaccessible build. **None of them uses the visual language of Uzbekistan itself.**

Silk Road Tours will:
- **Speak in the language of the place.** The iwan/peshtaq arch frames every hero and card image. An original girih star lattice (8- and 10-point stars) runs in thin saffron lines on deep lapis bands. Islimi borders and ikat-feathered dividers separate sections. A suzani medallion marks key moments such as the booking confirmation and empty states.
- **Use a national palette with accessible contrast**: lapis and Rishtan cobalt, turquoise tile, terracotta and saffron, pomegranate and desert sand, on an ivory ground. Every text pair is checked against WCAG 2.2 AA.
- **Look finished before the owner uploads photos.** Missing images become branded ornament compositions with the place name, never grey boxes or stock photos.
- **Be the fastest and most usable**: target Lighthouse ≥ 90 in all four categories on mobile, where the best specialist we measured scored 84 for performance.
- **Treat Uzbek and Russian speakers as first-class customers**: three full languages, prices in so'm, and a domestic hub that no foreign operator offers.
