/**
 * Builds drizzle/seed.sql from scripts/seed-data/*.
 *
 *   npx tsx scripts/build-seed-sql.ts            → insert-only (fails safely if the catalog is not empty)
 *   npx tsx scripts/build-seed-sql.ts --reset    → first deletes destinations, tours and FAQ (bookings are kept)
 *
 * Departures are generated relative to the day the script runs, so re-run it before seeding.
 * Also writes drizzle/seed-images.txt — the image paths the seed expects under /public.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Currency } from "../src/db/types.ts";
import { destinations as baseDestinations } from "./seed-data/destinations.ts";
import { faq as baseFaq } from "./seed-data/faq.ts";
import { domesticTours } from "./seed-data/tours-domestic.ts";
import { inboundTours, type SeedTour } from "./seed-data/tours-inbound.ts";
import { extraContent, extraDestinations, extraFaq, extraTours, sampleReviews } from "./seed-data/extra.ts";
import { sampleLeads } from "./seed-data/leads.ts";
import { samplePartners } from "./seed-data/partners.ts";
import { seedPlaces } from "./seed-data/places.ts";
import { uzText } from "../src/lib/uz-alphabet.ts";

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

const destinations = [...baseDestinations.map((d) => ({ ...d, country: null })), ...extraDestinations];
const faq = [...baseFaq, ...extraFaq];
const tours = [...inboundTours, ...domesticTours, ...extraTours];
const destSlugs = new Set(destinations.map((d) => d.slug));
if (destSlugs.size !== destinations.length) throw new Error("Duplicate destination slug");
const slugs = new Set<string>();
for (const t of tours) {
  if (slugs.has(t.slug)) throw new Error(`Duplicate tour slug ${t.slug}`);
  slugs.add(t.slug);
  validateTour(t, destSlugs);
}

const header = [
  "-- Generated by scripts/build-seed-sql.ts — do not edit by hand.",
  `-- Generated: ${new Date().toISOString()}  (departures relative to ${iso(tashkentToday())})`,
  "",
];
const resetLines = [
  "-- Reset catalog (bookings and service requests are kept; their tour links become NULL).",
  "DELETE FROM tour_departures;",
  "DELETE FROM tour_price_tiers;",
  "DELETE FROM tour_itinerary_days;",
  "DELETE FROM tour_destinations;",
  "DELETE FROM reviews WHERE source = 'sample';",
  "DELETE FROM tours;",
  "DELETE FROM destinations;",
  "DELETE FROM faq_items;",
  "DELETE FROM content_items;",
  "DELETE FROM places WHERE source = 'seed';",
  "DELETE FROM partners WHERE source = 'sample';",
  "DELETE FROM lead_activities WHERE lead_id IN (SELECT id FROM leads WHERE source = 'admin' AND source_ref LIKE 'SAMPLE-%');",
  "DELETE FROM leads WHERE source = 'admin' AND source_ref LIKE 'SAMPLE-%';",
  "UPDATE settings SET value = json_set(value, '$.agencyName', 'National Tours') WHERE key = 'contact' AND json_extract(value, '$.agencyName') IN ('Silk Road Tours', '');",
  "",
];
const lines: string[] = [];
const images: string[] = [];

/** Photos that are technically fine but do not show the place well; kept on disk for credits, left out of the site. */
const WEAK_PHOTOS = new Set(["samarkand/2", "samarkand/3", "dubai/2", "aydarkul/3", "margilan/2", "margilan/3", "margilan/4"]);
/** Which photo leads the destination page when the first one is not the strongest. */
const HERO_PHOTO: Record<string, string> = { khiva: "4", termez: "4", nukus: "4" };
const credits = JSON.parse(readFileSync(join(ROOT, "public/images/credits.json"), "utf8")) as Record<string, { file?: string }>;
/** Alt text from the Wikimedia file name ("Iwan_Khudayar_Khan_Palace,_Kokand.jpg" → "Iwan Khudayar Khan Palace, Kokand"). */
function photoAlt(url: string): string | null {
  const file = credits[url.replace(/^\/images\//, "")]?.file;
  if (!file) return null;
  const text = file
    .replace(/\.[a-z]+$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[\s-]+$/g, "")
    .replace(/\b(IMG|DSC|DSCF|P)\s?\d+\b/gi, "")
    .replace(/\b\d{6,8}\b/g, "")
    .replace(/([A-Za-z])\d{2,}\b/g, "$1")
    .replace(/\s+\d{1,4}$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text.length >= 4 && !/[\u0400-\u04FF]/.test(text) ? text : null;
}

const destId = new Map<string, number>();
destinations.forEach((d, i) => {
  const id = i + 1;
  destId.set(d.slug, id);
  // Photos actually present for this place, minus weak ones; the hero can be overridden per place.
  const present = ["hero", "1", "2", "3", "4"].filter(
    (n) => !WEAK_PHOTOS.has(`${d.slug}/${n}`) && existsSync(join(ROOT, "public/images/destinations", d.slug, `${n}.jpg`)),
  );
  const heroName = HERO_PHOTO[d.slug] && present.includes(HERO_PHOTO[d.slug]!) ? HERO_PHOTO[d.slug]! : (present[0] ?? "hero");
  const hero = `/images/destinations/${d.slug}/${heroName}.jpg`;
  const gallery = present
    .filter((n) => n !== heroName)
    .map((n) => {
      const url = `/images/destinations/${d.slug}/${n}.jpg`;
      const alt = photoAlt(url);
      return { url, type: "image", alt: alt ? { en: alt, uz: alt, ru: alt } : d.name };
    });
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
      country: d.country ?? null,
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

// CMS content: travel guides, experiences, services.
const contentKeys = new Set<string>();
extraContent.forEach((c, i) => {
  const key = `${c.kind}/${c.slug}`;
  if (contentKeys.has(key)) throw new Error(`Duplicate content ${key}`);
  contentKeys.add(key);
  for (const f of ["title", "excerpt", "body"] as const) {
    for (const l of ["en", "uz", "ru"] as const) if (!c[f][l]?.trim()) throw new Error(`Content ${key}: empty ${f}.${l}`);
  }
  if (c.image) images.push(c.image);
  lines.push(
    insert("content_items", {
      id: i + 1,
      kind: c.kind,
      slug: c.slug,
      category: c.category,
      title: c.title,
      excerpt: c.excerpt,
      body: c.body,
      image: c.image,
      destination_slug: c.destinationSlug,
      icon: c.icon,
      request_type: c.requestType,
      duration_hours: c.durationHours,
      price_from_usd: c.priceFromUsd,
      reading_minutes: c.readingMinutes,
      is_published: true,
      sort_order: i,
    }),
  );
});
lines.push("");

// Hotels, restaurants and transport (source = "seed"). INSERT OR IGNORE keeps rows an admin created with the same slug.
const placeKeys = new Set<string>();
seedPlaces.forEach((p, i) => {
  const key = `${p.kind}/${p.slug}`;
  if (placeKeys.has(key)) throw new Error(`Duplicate place ${key}`);
  placeKeys.add(key);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) throw new Error(`Place ${key}: bad slug`);
  if (p.destinationSlug && !destinations.some((d) => d.slug === p.destinationSlug)) throw new Error(`Place ${key}: unknown destination ${p.destinationSlug}`);
  for (const f of ["name", "summary", "description"] as const) {
    for (const l of ["en", "uz", "ru"] as const) if (!p[f][l]?.trim()) throw new Error(`Place ${key}: empty ${f}.${l}`);
  }
  if (p.image) images.push(p.image);
  for (const g of p.gallery ?? []) images.push(g);
  lines.push(
    insert("places", {
      kind: p.kind,
      slug: p.slug,
      destination_slug: p.destinationSlug,
      name: p.name,
      summary: p.summary,
      description: p.description,
      image: p.image,
      gallery: p.gallery ?? [],
      lat: p.lat,
      lng: p.lng,
      price_from_usd: p.priceFromUsd,
      price_level: p.priceLevel,
      tags: p.tags,
      details: p.details,
      source: "seed",
      is_published: true,
      sort_order: i,
    }).replace(/^INSERT INTO/, "INSERT OR IGNORE INTO"),
  );
});
lines.push("");

// Partner profiles (investor concept, source = "sample"): invented businesses. Approved ones are listed on /partners;
// pending and rejected ones show the review workflow in the admin panel. placeSlugs link the partner to its places.
const partnerEpoch = Math.floor(Date.now() / 1000);
samplePartners.forEach((p, i) => {
  const reference = `PA-${90001 + i}`;
  lines.push(
    insert("partners", {
      reference,
      token: randomBytes(18).toString("base64url"),
      type: p.type,
      status: p.status,
      source: "sample",
      business_name: p.businessName,
      contact_name: p.contactName,
      email: p.email,
      phone: p.phone,
      website: p.website,
      destination_slug: p.destinationSlug,
      city: p.city,
      description: p.description,
      services: p.services,
      locale: p.locale,
      admin_note: p.adminNote ?? null,
      created_at: partnerEpoch - (60 - i * 2) * 86400,
      reviewed_at: p.status === "pending" ? null : partnerEpoch - (50 - i * 2) * 86400,
    }).replace(/^INSERT INTO/, "INSERT OR IGNORE INTO"),
  );
  for (const key of p.placeSlugs ?? []) {
    const [kind, slug] = key.split("/");
    if (!seedPlaces.some((x) => x.kind === kind && x.slug === slug)) throw new Error(`Partner "${p.businessName}": unknown place ${key}`);
    lines.push(`UPDATE places SET partner_id = (SELECT id FROM partners WHERE reference = ${q(reference)}) WHERE kind = ${q(kind)} AND slug = ${q(slug)};`);
  }
});
lines.push("");

// Sample reviews (investor concept): published, never verified, flagged internally with source = 'sample'.
const tourIdBySlug = new Map(tours.map((t, i) => [t.slug, i + 1]));
for (const r of sampleReviews) {
  lines.push(
    insert("reviews", {
      tour_id: tourIdBySlug.get(r.tour) ?? null,
      author_name: r.authorName,
      author_country: r.authorCountry,
      rating: r.rating,
      // Catalogue text keeps the current spelling and is converted on display; review and lead text is plain, so it is converted here.
      title: r.language === "uz" ? uzText(r.title) : r.title,
      body: r.language === "uz" ? uzText(r.body) : r.body,
      language: r.language,
      source: "sample",
      travel_date: /^\d{4}-\d{2}$/.test(r.travelMonth) ? `${r.travelMonth}-01` : null,
      is_verified: false,
      is_published: true,
    }),
  );
}
// Sample CRM pipeline (admin only): invented people, flagged by source_ref "SAMPLE-xxxx".
{
  const today = tashkentToday();
  const stageOrder = ["new", "contacted", "qualified", "offer_sent", "negotiation", "confirmed", "completed"];
  for (const l of sampleLeads) {
    const created = `unixepoch() - ${l.ageDays * 86400 + 3600}`;
    const cols: Record<string, unknown> = {
      source: "admin",
      source_ref: l.ref,
      stage: l.stage,
      full_name: l.fullName,
      email: l.email,
      phone: l.phone,
      locale: l.locale,
      title: l.locale === "uz" ? uzText(l.title) : l.title,
      destination: l.destination,
      interests: l.locale === "uz" ? uzText(l.interests) : l.interests,
      budget_usd: l.budgetUsd,
      travel_from: iso(addDays(today, l.fromDays)),
      travel_to: iso(addDays(today, l.toDays)),
      travellers: l.travellers,
      value_usd: l.valueUsd,
      follow_up_at: l.followUpDays == null ? null : iso(addDays(today, l.followUpDays)),
    };
    lines.push(
      `INSERT OR IGNORE INTO leads (${Object.keys(cols).map((k) => `"${k}"`).join(", ")}, "created_at", "updated_at") VALUES (${Object.values(cols).map(q).join(", ")}, ${created}, unixepoch() - ${Math.floor(l.ageDays / 2) * 86400});`,
    );
    const lead = `(SELECT id FROM leads WHERE source = 'admin' AND source_ref = ${q(l.ref)})`;
    const acts: [string, string, number][] = [["created", "Lead created", l.ageDays * 86400 + 3600]];
    const reached = l.stage === "lost" ? 1 : stageOrder.indexOf(l.stage);
    for (let i = 1; i <= reached; i++) acts.push(["stage", `${stageOrder[i - 1]} → ${stageOrder[i]}`, Math.max(600, (l.ageDays * 86400 * (reached - i + 1)) / (reached + 1))]);
    if (l.stage === "lost") acts.push(["stage", "contacted → lost", 7200]);
    l.notes.forEach((n, i) => acts.push(["note", l.locale === "uz" ? uzText(n) : n, 3600 * (i + 2)]));
    for (const [kind, text, ago] of acts) {
      lines.push(`INSERT INTO lead_activities (lead_id, kind, text, created_at) SELECT ${lead}, ${q(kind)}, ${q(text)}, unixepoch() - ${Math.round(ago)} WHERE NOT EXISTS (SELECT 1 FROM lead_activities WHERE lead_id = ${lead} AND kind = ${q(kind)} AND text = ${q(text)});`);
    }
  }
  lines.push("");
}

lines.push(
  "UPDATE tours SET rating_avg = (SELECT coalesce(round(avg(rating), 2), 0) FROM reviews WHERE reviews.tour_id = tours.id AND is_published = 1), rating_count = (SELECT count(*) FROM reviews WHERE reviews.tour_id = tours.id AND is_published = 1);",
);
lines.push("");

// Settings are only inserted if missing, so values edited in the admin panel are never overwritten.
const settingsRows = {
  exchange_rates: { base: "USD", rates: SEED_RATES, updatedAt: new Date().toISOString(), source: "manual" },
  contact: {
    agencyName: "National Tours",
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
writeFileSync(join(ROOT, "drizzle/seed.sql"), [...header, ...(RESET ? resetLines : []), ...lines].join("\n") + "\n");
// Always also written: used once to replace an older catalogue (`node scripts/db.mjs seed --reset`).
writeFileSync(join(ROOT, "drizzle/seed-reset.sql"), [...header, ...resetLines, ...lines].join("\n") + "\n");
writeFileSync(join(ROOT, "drizzle/seed-images.txt"), images.map((p) => `public${p}`).join("\n") + "\n");

const missing = images.filter((p) => !existsSync(join(ROOT, "public", p)));
console.log(
  `seed.sql: ${destinations.length} destinations, ${tours.length} tours ` +
    `(${inboundTours.length} inbound, ${domesticTours.length} domestic), ${dayId - 1} itinerary days, ` +
    `${tierId - 1} price tiers, ${departureCount} departures, ${faq.length} FAQ items, ` +
    `${extraContent.length} content items, ${seedPlaces.length} places, ${samplePartners.length} sample partners, ` +
    `${sampleReviews.length} sample reviews${RESET ? " [with reset]" : ""}.`,
);
if (missing.length) {
  console.log(`Note: ${missing.length} of ${images.length} images are not in /public yet — see drizzle/seed-images.txt.`);
}
