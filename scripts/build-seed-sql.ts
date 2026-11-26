/**
 * Builds drizzle/seed.sql from scripts/seed-data/*.
 *
 *   npx tsx scripts/build-seed-sql.ts            → insert-only (fails safely if the catalog is not empty)
 *   npx tsx scripts/build-seed-sql.ts --reset    → first deletes destinations, tours and FAQ (bookings are kept)
 *
 * Departures are generated relative to the day the script runs, so re-run it before seeding.
 * Also writes drizzle/seed-images.txt — the image paths the seed expects under /public.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Currency } from "../src/db/types.ts";
import { destinations } from "./seed-data/destinations.ts";
import { faq } from "./seed-data/faq.ts";
import { domesticTours } from "./seed-data/tours-domestic.ts";
import { inboundTours, type SeedTour } from "./seed-data/tours-inbound.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESET = process.argv.includes("--reset");
const EXPONENT: Record<Currency, number> = { USD: 2, EUR: 2, UZS: 0 };
const PEAK_MONTHS = new Set([4, 5, 9, 10]);
/** Fallback rates; replace from the admin panel ("Refresh from CBU") after deploying. */
const SEED_RATES = { USD: 1, UZS: 11973.44, EUR: 0.86 };

// ── SQL helpers ────────────────────────────────────────────────────────────

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number in seed: ${v}`);
    return String(v);
  }
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
};

const insert = (table: string, row: Record<string, unknown>): string =>
  `INSERT INTO ${table} (${Object.keys(row).map((k) => `"${k}"`).join(", ")}) VALUES (${Object.values(row).map(q).join(", ")});`;

const minor = (major: number | undefined, c: Currency): number | null =>
  major === undefined ? null : Math.round(major * 10 ** EXPONENT[c]);

// ── Dates (Asia/Tashkent, UTC+5) ───────────────────────────────────────────

const tashkentToday = (): Date => {
  const d = new Date(Date.now() + 5 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

function departureDates(tour: SeedTour): { start: string; end: string; modifier: number }[] {
  if (!tour.departures) return [];
  const { weekday, everyWeeks, count, peakModifierPercent = 0 } = tour.departures;
  const out: { start: string; end: string; modifier: number }[] = [];
  let d = addDays(tashkentToday(), 10); // leave lead time for visas and train tickets
  while (d.getUTCDay() !== weekday) d = addDays(d, 1);
  const horizon = addDays(tashkentToday(), 400);
  while (out.length < count && d < horizon) {
    const month = d.getUTCMonth() + 1;
    if (tour.seasonMonths.length === 0 || tour.seasonMonths.includes(month)) {
      out.push({
        start: iso(d),
        end: iso(addDays(d, tour.durationDays - 1)),
        modifier: PEAK_MONTHS.has(month) ? peakModifierPercent : 0,
      });
    }
    d = addDays(d, 7 * everyWeeks);
  }
  return out;
}

// ── Validation of seed content (fail fast instead of producing a broken DB) ─

function validateTour(t: SeedTour, destSlugs: Set<string>) {
  const fail = (msg: string) => {
    throw new Error(`Seed tour "${t.slug}": ${msg}`);
  };
  if (t.destinations.length === 0) fail("no destinations");
  for (const s of t.destinations) if (!destSlugs.has(s)) fail(`unknown destination ${s}`);
  if (t.itinerary.length !== t.durationDays) fail(`itinerary has ${t.itinerary.length} days, expected ${t.durationDays}`);
  if (t.durationNights > t.durationDays) fail("more nights than days");
  if (t.tiers.length === 0) fail("no price tiers");
  const baseKey = t.baseCurrency.toLowerCase() as "usd" | "uzs" | "eur";
  for (const tier of t.tiers) {
    if (tier[baseKey] === undefined) fail(`tier ${tier.bookingType} ${tier.minPax}-${tier.maxPax} lacks a ${t.baseCurrency} price`);
    if (tier.minPax < t.minGroup || tier.maxPax > t.maxGroup) fail(`tier ${tier.minPax}-${tier.maxPax} outside group size ${t.minGroup}-${t.maxGroup}`);
  }
  for (const type of ["group", "private"] as const) {
    const ts = t.tiers.filter((x) => x.bookingType === type).sort((a, b) => a.minPax - b.minPax);
    for (let i = 1; i < ts.length; i++) if (ts[i]!.minPax <= ts[i - 1]!.maxPax) fail(`${type} tiers overlap`);
  }
  for (const [lang, text] of Object.entries(t.title)) if (!text.trim()) fail(`empty ${lang} title`);
  if (t.departures && !t.tiers.some((x) => x.bookingType === "group")) fail("scheduled departures but no group tier");
}

// ── Build ──────────────────────────────────────────────────────────────────

const tours = [...inboundTours, ...domesticTours];
const destSlugs = new Set(destinations.map((d) => d.slug));
const slugs = new Set<string>();
for (const t of tours) {
  if (slugs.has(t.slug)) throw new Error(`Duplicate tour slug ${t.slug}`);
  slugs.add(t.slug);
  validateTour(t, destSlugs);
}

const lines: string[] = [
  "-- Generated by scripts/build-seed-sql.ts — do not edit by hand.",
  `-- Generated: ${new Date().toISOString()}  (departures relative to ${iso(tashkentToday())})`,
  "",
];
const images: string[] = [];

if (RESET) {
  lines.push(
    "-- Reset catalog (bookings and service requests are kept; their tour links become NULL).",
    "DELETE FROM tour_departures;",
    "DELETE FROM tour_price_tiers;",
    "DELETE FROM tour_itinerary_days;",
    "DELETE FROM tour_destinations;",
    "DELETE FROM tours;",
    "DELETE FROM destinations;",
    "DELETE FROM faq_items;",
    "",
  );
}

const destId = new Map<string, number>();
destinations.forEach((d, i) => {
  const id = i + 1;
  destId.set(d.slug, id);
  const hero = `/images/destinations/${d.slug}/hero.jpg`;
  const gallery = d.attractions.slice(0, 4).map((a, n) => ({
    url: `/images/destinations/${d.slug}/${n + 1}.jpg`,
    type: "image",
    alt: a.name,
  }));
  images.push(hero, ...gallery.map((g) => g.url));
  lines.push(
    insert("destinations", {
      id,
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      overview: d.overview,
      attractions: d.attractions,
      best_time: d.bestTime,
      best_months: d.bestMonths,
      lat: d.lat,
      lng: d.lng,
      hero_image: hero,
      gallery,
      seo_title: null,
      seo_description: { en: d.tagline.en, uz: d.tagline.uz, ru: d.tagline.ru },
      sort_order: i,
      is_published: true,
    }),
  );
});
lines.push("");

let dayId = 1;
let tierId = 1;
let depId = 1;
let departureCount = 0;
tours.forEach((t, i) => {
  const id = i + 1;
  const base = t.baseCurrency;
  const baseKey = base.toLowerCase() as "usd" | "uzs" | "eur";
  const fromPrice = Math.min(...t.tiers.map((x) => minor(x[baseKey], base)!));
  const hero = `/images/tours/${t.slug}.jpg`;
  images.push(hero);

  lines.push(
    insert("tours", {
      id,
      slug: t.slug,
      audience: t.audience,
      category: t.category,
      primary_destination_id: destId.get(t.destinations[0]!)!,
      title: t.title,
      summary: t.summary,
      description: t.description,
      duration_days: t.durationDays,
      duration_nights: t.durationNights,
      difficulty: t.difficulty,
      min_group: t.minGroup,
      max_group: t.maxGroup,
      base_currency: base,
      child_price_percent: t.childPricePercent,
      from_price_minor: fromPrice,
      compare_at_price_minor: minor(t.compareAtPrice, base),
      badges: t.badges,
      included: t.included,
      excluded: t.excluded,
      accommodation: t.accommodation,
      transport: t.transport,
      route: t.route,
      guide_languages: t.guideLanguages,
      season_months: t.seasonMonths,
      hero_image: hero,
      gallery: [],
      rating_avg: 0,
      rating_count: 0,
      seo_title: null,
      seo_description: t.summary,
      is_featured: t.featured,
      is_published: true,
      sort_order: i,
    }),
  );
  t.destinations.forEach((slug, position) =>
    lines.push(insert("tour_destinations", { tour_id: id, destination_id: destId.get(slug)!, position })),
  );
  t.itinerary.forEach((d, n) =>
    lines.push(
      insert("tour_itinerary_days", {
        id: dayId++,
        tour_id: id,
        day_number: n + 1,
        title: d.title,
        description: d.description,
        meals: d.meals,
        overnight: d.overnight ?? null,
        distance_km: d.distanceKm ?? null,
        walking_hours: d.walkingHours ?? null,
      }),
    ),
  );
  for (const tier of t.tiers) {
    lines.push(
      insert("tour_price_tiers", {
        id: tierId++,
        tour_id: id,
        booking_type: tier.bookingType,
        min_pax: tier.minPax,
        max_pax: tier.maxPax,
        price_usd: minor(tier.usd, "USD"),
        price_uzs: minor(tier.uzs, "UZS"),
        price_eur: minor(tier.eur, "EUR"),
      }),
    );
  }
  for (const dep of departureDates(t)) {
    departureCount++;
    lines.push(
      insert("tour_departures", {
        id: depId++,
        tour_id: id,
        start_date: dep.start,
        end_date: dep.end,
        seats_total: t.maxGroup,
        seats_booked: 0,
        status: "open",
        price_modifier_percent: dep.modifier,
      }),
    );
  }
  lines.push("");
});

faq.forEach((f, i) =>
  lines.push(insert("faq_items", { id: i + 1, category: f.category, question: f.question, answer: f.answer, sort_order: i, is_published: true })),
);
lines.push("");

// Settings are only inserted if missing, so values edited in the admin panel are never overwritten.
const settingsRows = {
  exchange_rates: { base: "USD", rates: SEED_RATES, updatedAt: new Date().toISOString(), source: "manual" },
  contact: {
    agencyName: "Silk Road Tours",
    phone: "",
    email: "",
    whatsapp: "",
    telegram: "",
    address: { en: "Jizzakh, Uzbekistan", uz: "Jizzax, Oʻzbekiston", ru: "Джизак, Узбекистан" },
    licenseNumber: "",
  },
};
for (const [key, value] of Object.entries(settingsRows)) {
  lines.push(`INSERT OR IGNORE INTO settings ("key", "value") VALUES (${q(key)}, ${q(value)});`);
}

mkdirSync(join(ROOT, "drizzle"), { recursive: true });
writeFileSync(join(ROOT, "drizzle/seed.sql"), lines.join("\n") + "\n");
writeFileSync(join(ROOT, "drizzle/seed-images.txt"), images.map((p) => `public${p}`).join("\n") + "\n");

const missing = images.filter((p) => !existsSync(join(ROOT, "public", p)));
console.log(
  `seed.sql: ${destinations.length} destinations, ${tours.length} tours ` +
    `(${inboundTours.length} inbound, ${domesticTours.length} domestic), ${dayId - 1} itinerary days, ` +
    `${tierId - 1} price tiers, ${departureCount} departures, ${faq.length} FAQ items${RESET ? " [with reset]" : ""}.`,
);
if (missing.length) {
  console.log(`Note: ${missing.length} of ${images.length} images are not in /public yet — see drizzle/seed-images.txt.`);
}
