// Pure helpers for the Trip Constructor, the navigator and the trip snapshot API (no React, no DOM, no server-only imports).
import type { HotelDetails, Locale, LocalizedText, RestaurantDetails, TransportDetails } from "../db/types";
import type { TripItem, TripItemKind, TripState } from "./trip-store";
import { localize } from "./localize";

export const MAX_TRIP_DAYS = 30;
export const MAX_TRIP_ITEMS = 80;
export const MAX_TRIP_DESTINATIONS = 8;
/** Typical lunch + dinner per person per day in USD when the visitor has not picked restaurants for every meal. */
export const DAILY_MEALS_USD = 20;

export const TRIP_ITEM_KINDS = ["hotel", "restaurant", "transport", "flight", "train", "transfer", "attraction", "experience", "tour", "activity"] as const satisfies readonly TripItemKind[];
export const PRICE_UNITS = ["night", "person", "trip", "meal", "group"] as const;

export type CatalogTab = "hotels" | "restaurants" | "flights" | "trains" | "transfers" | "attractions" | "experiences" | "tours";
export const CATALOG_TABS: CatalogTab[] = ["hotels", "restaurants", "attractions", "experiences", "tours", "trains", "flights", "transfers"];

export type BudgetCategory = "stay" | "food" | "transport" | "sights" | "experiences" | "tours";
export const BUDGET_CATEGORIES: BudgetCategory[] = ["stay", "food", "transport", "experiences", "tours", "sights"];

export interface CatalogEntry extends TripItem {
  tab: CatalogTab;
  summary?: string;
  /** Locale-free site path of the detail page, e.g. "/hotels/slug". */
  href?: string;
}

/** Minimal shapes of what GET /api/places and GET /api/trip-catalog return (structurally typed so this file stays client-safe). */
export interface PlaceLike {
  kind: "hotel" | "restaurant" | "transport";
  slug: string;
  destinationSlug: string | null;
  name: LocalizedText;
  summary: LocalizedText;
  image: string | null;
  lat: number | null;
  lng: number | null;
  priceFromUsd: number | null;
  details: unknown;
}
export interface AttractionLike {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  image?: string;
  lat?: number;
  lng?: number;
  destinationSlug: string;
}
export interface CatalogExperience {
  slug: string;
  title: string;
  summary: string;
  image: string | null;
  destinationSlug: string | null;
  priceUsd: number | null;
  durationHours: number | null;
}
export interface CatalogTour {
  slug: string;
  title: string;
  summary: string;
  image: string | null;
  destinationSlug: string;
  priceUsd: number | null;
  days: number;
}
export interface DestinationPoint {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  abroad?: boolean;
}

/** Translated fragments the catalogue meta lines need (passed in so this module has no i18n dependency). */
export interface MetaFormat {
  duration: (minutes: number) => string;
  hours: (hours: number) => string;
  days: (days: number) => string;
}

const transportKind = (mode: TransportDetails["mode"]): { kind: TripItemKind; tab: CatalogTab; unit: TripItem["priceUnit"] } => {
  if (mode === "flight") return { kind: "flight", tab: "flights", unit: "person" };
  if (mode === "train") return { kind: "train", tab: "trains", unit: "person" };
  if (mode === "transfer" || mode === "taxi" || mode === "car") return { kind: "transfer", tab: "transfers", unit: "group" };
  return { kind: "transport", tab: "transfers", unit: "person" };
};

/** Small, stable offset (≈ up to 1.5 km) so items placed at a destination's centre do not hide each other on the map. */
function jitter(seed: string, lat: number, lng: number): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const r = 0.006 + (((h >>> 16) & 0xff) / 0xff) * 0.008;
  return { lat: +(lat + Math.sin(a) * r).toFixed(5), lng: +(lng + Math.cos(a) * r).toFixed(5) };
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Canonical trip item id, shared by every "Add to trip" button: "<places.kind>:<slug>" for places (so trains are "transport:<slug>"), "attraction:<id>", "experience:<slug>", "tour:<slug>". */
export function tripItemId(kind: TripItemKind, ref: string): string {
  return `${kind}:${ref}`;
}

/** A hotel, restaurant or transport row (GET /api/places) as a trip item. */
export function placeToEntry(p: PlaceLike, locale: Locale, fmt: MetaFormat): CatalogEntry {
  const base = {
    title: localize(p.name, locale),
    summary: localize(p.summary, locale),
    refSlug: p.slug,
    destinationSlug: p.destinationSlug ?? undefined,
    priceUsd: num(p.priceFromUsd),
    lat: num(p.lat),
    lng: num(p.lng),
    image: p.image ?? undefined,
  };
  if (p.kind === "hotel") {
    const d = (p.details ?? {}) as Partial<HotelDetails>;
    const meta = [d.area ? localize(d.area, locale) : "", d.stars ? "★".repeat(Math.min(5, d.stars)) : ""].filter(Boolean).join(" · ");
    return { ...base, id: tripItemId("hotel", p.slug), kind: "hotel", tab: "hotels", priceUnit: "night", meta: meta || undefined, href: `/hotels/${p.slug}` };
  }
  if (p.kind === "restaurant") {
    const d = (p.details ?? {}) as Partial<RestaurantDetails>;
    const meta = [d.area ? localize(d.area, locale) : "", d.hours ? localize(d.hours, locale) : ""].filter(Boolean).join(" · ");
    return { ...base, id: tripItemId("restaurant", p.slug), kind: "restaurant", tab: "restaurants", priceUnit: "meal", meta: meta || undefined, href: `/restaurants/${p.slug}` };
  }
  const d = (p.details ?? {}) as Partial<TransportDetails>;
  const k = transportKind(d.mode ?? "car");
  const meta = [d.from && d.to ? `${d.from} → ${d.to}` : "", d.durationMin ? fmt.duration(d.durationMin) : ""].filter(Boolean).join(" · ");
  return { ...base, id: `transport:${p.slug}`, kind: k.kind, tab: k.tab, priceUnit: k.unit, meta: meta || undefined, href: `/transport/${p.slug}` };
}

export function attractionToEntry(a: AttractionLike, locale: Locale, destinationName?: string): CatalogEntry {
  return {
    id: tripItemId("attraction", a.id),
    kind: "attraction",
    tab: "attractions",
    title: localize(a.name, locale),
    summary: localize(a.description, locale),
    refSlug: a.id,
    destinationSlug: a.destinationSlug,
    lat: num(a.lat),
    lng: num(a.lng),
    image: a.image,
    meta: destinationName,
    href: `/destinations/${a.destinationSlug}`,
  };
}

export function experienceToEntry(e: CatalogExperience, fmt: MetaFormat, dest?: DestinationPoint): CatalogEntry {
  const pos = dest?.lat != null && dest.lng != null ? jitter(e.slug, dest.lat, dest.lng) : undefined;
  return {
    id: tripItemId("experience", e.slug),
    kind: "experience",
    tab: "experiences",
    title: e.title,
    summary: e.summary,
    refSlug: e.slug,
    destinationSlug: e.destinationSlug ?? undefined,
    priceUsd: num(e.priceUsd),
    priceUnit: "person",
    lat: pos?.lat,
    lng: pos?.lng,
    image: e.image ?? undefined,
    meta: [dest?.name, e.durationHours ? fmt.hours(e.durationHours) : ""].filter(Boolean).join(" · ") || undefined,
    href: `/experiences/${e.slug}`,
  };
}

export function tourToEntry(t: CatalogTour, fmt: MetaFormat, dest?: DestinationPoint): CatalogEntry {
  const pos = dest?.lat != null && dest.lng != null ? jitter(t.slug, dest.lat, dest.lng) : undefined;
  return {
    id: tripItemId("tour", t.slug),
    kind: "tour",
    tab: "tours",
    title: t.title,
    summary: t.summary,
    refSlug: t.slug,
    destinationSlug: t.destinationSlug,
    priceUsd: num(t.priceUsd),
    priceUnit: "person",
    lat: pos?.lat,
    lng: pos?.lng,
    image: t.image ?? undefined,
    meta: [dest?.name, fmt.days(t.days)].filter(Boolean).join(" · "),
    href: `/tours/${t.slug}`,
  };
}

/** Detail page of a trip item (locale-free path), when it comes from our catalogue. */
export function itemHref(item: TripItem): string | undefined {
  const slug = item.refSlug && /^[a-z0-9][a-z0-9-]*$/.test(item.refSlug) ? item.refSlug : undefined;
  switch (item.kind) {
    case "hotel":
      return slug && `/hotels/${slug}`;
    case "restaurant":
      return slug && `/restaurants/${slug}`;
    case "transport":
    case "flight":
    case "train":
    case "transfer":
      return slug && `/transport/${slug}`;
    case "attraction":
      return item.destinationSlug ? `/destinations/${item.destinationSlug}` : undefined;
    case "experience":
    case "activity":
      return slug && `/experiences/${slug}`;
    case "tour":
      return slug && `/tours/${slug}`;
  }
}

export function categoryOf(kind: TripItemKind): BudgetCategory {
  switch (kind) {
    case "hotel":
      return "stay";
    case "restaurant":
      return "food";
    case "attraction":
      return "sights";
    case "experience":
    case "activity":
      return "experiences";
    case "tour":
      return "tours";
    default:
      return "transport";
  }
}

// ── Days ───────────────────────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Days between the trip dates (inclusive), or null when the dates are missing or inverted. */
export function daysFromDates(start?: string, end?: string): number | null {
  if (!start || !end || !ISO.test(start) || !ISO.test(end)) return null;
  const d = Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1;
  return d >= 1 ? Math.min(d, MAX_TRIP_DAYS) : null;
}

/** Number of itinerary days: from the dates, otherwise enough for what is already planned (at least 3). */
export function tripDayCount(trip: Pick<TripState, "startDate" | "endDate" | "items" | "destinations">): number {
  const fromDates = daysFromDates(trip.startDate, trip.endDate);
  if (fromDates) return fromDates;
  const maxDay = trip.items.reduce((m, i) => Math.max(m, i.day ?? 0), 0);
  return Math.min(MAX_TRIP_DAYS, Math.max(3, maxDay, trip.destinations.length * 2));
}

/** ISO date of day N (1-based) when the trip has a start date. */
export function dateOfDay(start: string | undefined, day: number): string | null {
  if (!start || !ISO.test(start)) return null;
  return new Date(toUtc(start) + (day - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Great-circle distance in km (same formula as src/db/queries/places.ts, usable in the browser). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasPos = <T extends { lat?: number; lng?: number }>(i: T): i is T & { lat: number; lng: number } => typeof i.lat === "number" && typeof i.lng === "number";

/** Items in itinerary order: by day (unscheduled last), keeping the visitor's order inside a day. */
export function orderedItems(items: TripItem[]): TripItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.day ?? 999) - (b.item.day ?? 999) || a.index - b.index)
    .map((x) => x.item);
}

/** Inter-city legs travel on the first day at a destination; stays begin there too. */
const ARRIVAL_KINDS = new Set<TripItemKind>(["flight", "train", "transport", "transfer", "hotel"]);

/**
 * Spreads the items over the trip's days: destinations in the visitor's order, each getting days in proportion to what
 * the visitor picked there; arrival transport and the hotel go to a destination's first day; sights, experiences and
 * meals follow a nearest-neighbour walk from the hotel and are split evenly over that destination's days.
 */
export function autoArrange(trip: TripState, destinationCentres: Record<string, { lat: number; lng: number }> = {}): TripItem[] {
  const totalDays = tripDayCount(trip);
  const order: string[] = [];
  for (const d of trip.destinations) if (!order.includes(d)) order.push(d);
  for (const i of trip.items) if (i.destinationSlug && !order.includes(i.destinationSlug)) order.push(i.destinationSlug);

  // Items without a destination join the closest destination that has a position, else the first one.
  const keyOf = (i: TripItem): string => {
    if (i.destinationSlug) return i.destinationSlug;
    if (hasPos(i)) {
      let best: string | undefined;
      let bestKm = Infinity;
      for (const d of order) {
        const c = destinationCentres[d];
        if (!c) continue;
        const km = distanceKm(i, c);
        if (km < bestKm) [best, bestKm] = [d, km];
      }
      if (best) return best;
    }
    return order[0] ?? "_";
  };
  const groups = new Map<string, TripItem[]>();
  for (const i of trip.items) {
    const k = keyOf(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  const keys = [...order.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !order.includes(k))];
  if (keys.length === 0) return trip.items;

  // Days per destination: at least one each (when there are enough days), the rest by weight (largest remainder).
  const weights = keys.map((k) => Math.max(1, groups.get(k)!.filter((i) => !ARRIVAL_KINDS.has(i.kind)).length));
  const alloc: number[] = keys.map(() => 0);
  if (totalDays >= keys.length) {
    alloc.fill(1);
    let rest = totalDays - keys.length;
    const sum = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map((w) => (w / sum) * rest);
    exact.forEach((x, i) => (alloc[i]! += Math.floor(x)));
    rest -= exact.reduce((a, x) => a + Math.floor(x), 0);
    const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
    for (let n = 0; n < rest; n++) alloc[byRemainder[n % byRemainder.length]!.i]! += 1;
  }

  const out: TripItem[] = [];
  let firstDay = 1;
  keys.forEach((k, gi) => {
    const items = groups.get(k)!;
    const span = totalDays >= keys.length ? alloc[gi]! : 1;
    const start = totalDays >= keys.length ? firstDay : Math.min(totalDays, Math.floor((gi * totalDays) / keys.length) + 1);
    firstDay += span;

    const arrivals = items.filter((i) => ARRIVAL_KINDS.has(i.kind) && i.kind !== "hotel");
    const hotels = items.filter((i) => i.kind === "hotel");
    const tours = items.filter((i) => i.kind === "tour");
    const rest = items.filter((i) => !ARRIVAL_KINDS.has(i.kind) && i.kind !== "tour");

    // Nearest-neighbour walk from the hotel (or the destination centre).
    let cursor: { lat: number; lng: number } | undefined = hotels.find(hasPos) ?? destinationCentres[k] ?? rest.find(hasPos);
    const pool = [...rest];
    const walk: TripItem[] = [];
    while (pool.length) {
      let idx = 0;
      if (cursor) {
        let bestKm = Infinity;
        pool.forEach((p, i) => {
          const km = hasPos(p) ? distanceKm(cursor!, p) : 10_000;
          if (km < bestKm) [idx, bestKm] = [i, km];
        });
      }
      const [next] = pool.splice(idx, 1);
      walk.push(next!);
      if (hasPos(next!)) cursor = next;
    }

    for (const a of arrivals) out.push({ ...a, day: start });
    hotels.forEach((h, i) => out.push({ ...h, day: Math.min(start + i, start + span - 1) }));
    tours.forEach((t, i) => out.push({ ...t, day: start + (i % span) }));
    // Sights and experiences fill the days evenly; restaurants are spread one per day where possible.
    const meals = walk.filter((i) => i.kind === "restaurant");
    const sights = walk.filter((i) => i.kind !== "restaurant");
    const perDay = Math.max(1, Math.ceil(sights.length / span));
    sights.forEach((s, i) => out.push({ ...s, day: start + Math.min(span - 1, Math.floor(i / perDay)) }));
    meals.forEach((m, i) => out.push({ ...m, day: start + (i % span) }));
  });
  return orderedItems(out.map((i) => ({ ...i, day: Math.min(totalDays, Math.max(1, i.day ?? 1)) })));
}

// ── Budget ─────────────────────────────────────────────────────────────────

export interface BudgetLine {
  id: string;
  title: string;
  kind: TripItemKind | "meals";
  category: BudgetCategory;
  day?: number;
  usd: number;
  /** How the amount was computed, for the breakdown: unit price × quantity. */
  unitUsd: number;
  quantity: number;
  unit: "night_room" | "person" | "trip" | "group" | "meal_person" | "day_person";
}

export interface Budget {
  lines: BudgetLine[];
  byCategory: Record<BudgetCategory, number>;
  /** Index 0 = not scheduled yet, 1…days = itinerary days. */
  byDay: number[];
  totalUsd: number;
  perPersonUsd: number;
  travellers: number;
  rooms: number;
  days: number;
  nights: number;
  /** Items without an indicative price (sights with tickets paid on site, items from outside the catalogue). */
  unpriced: number;
}

/**
 * Indicative trip cost in USD: hotels × nights × rooms, per-person prices × travellers, per-trip/group prices once,
 * restaurants per person per meal, plus (optionally) typical everyday meals. Never a confirmed price.
 */
export function estimateBudget(trip: Pick<TripState, "startDate" | "endDate" | "items" | "destinations" | "adults" | "children">, opts: { includeMeals?: boolean } = {}): Budget {
  const days = tripDayCount(trip);
  const nights = Math.max(1, days - 1);
  const travellers = Math.max(1, (trip.adults || 0) + (trip.children || 0));
  const rooms = Math.max(1, Math.ceil(travellers / 2));
  const lines: BudgetLine[] = [];

  // Hotel nights: a scheduled hotel covers the nights from its day until the next hotel's day (or the end of the trip);
  // unscheduled hotels share the nights no scheduled hotel covers.
  const hotels = trip.items.filter((i) => i.kind === "hotel");
  const scheduled = hotels.filter((h) => h.day).sort((a, b) => a.day! - b.day!);
  const nightsOf = new Map<string, { nights: number; from?: number }>();
  let covered = 0;
  scheduled.forEach((h, i) => {
    const next = scheduled[i + 1]?.day ?? days;
    const n = Math.max(1, Math.min(nights, next - h.day!));
    nightsOf.set(h.id, { nights: n, from: h.day });
    covered += n;
  });
  const unscheduled = hotels.filter((h) => !h.day);
  if (unscheduled.length) {
    const left = Math.max(unscheduled.length, nights - covered);
    unscheduled.forEach((h, i) => nightsOf.set(h.id, { nights: Math.floor(left / unscheduled.length) + (i < left % unscheduled.length ? 1 : 0) }));
  }

  const byDay = new Array<number>(days + 1).fill(0);
  let unpriced = 0;
  for (const item of trip.items) {
    const price = item.priceUsd;
    if (price == null || !(price > 0)) {
      unpriced += item.kind === "attraction" ? 0 : 1;
      continue;
    }
    const category = categoryOf(item.kind);
    let quantity = 1;
    let unit: BudgetLine["unit"] = "trip";
    if (item.kind === "hotel" || item.priceUnit === "night") {
      const n = nightsOf.get(item.id)?.nights ?? 1;
      quantity = n * rooms;
      unit = "night_room";
    } else if (item.priceUnit === "meal") {
      quantity = travellers;
      unit = "meal_person";
    } else if (item.priceUnit === "person" || item.priceUnit === undefined) {
      quantity = travellers;
      unit = "person";
    } else if (item.priceUnit === "group") {
      unit = "group";
    }
    const usd = price * quantity;
    lines.push({ id: item.id, title: item.title, kind: item.kind, category, day: item.day, usd, unitUsd: price, quantity, unit });
    if (item.kind === "hotel" && item.day) {
      const n = nightsOf.get(item.id)?.nights ?? 1;
      for (let d = 0; d < n; d++) byDay[Math.min(days, item.day + d)]! += usd / n;
    } else {
      byDay[item.day && item.day <= days ? item.day : 0]! += usd;
    }
  }

  if (opts.includeMeals !== false) {
    const usd = DAILY_MEALS_USD * days * travellers;
    lines.push({ id: "meals", title: "", kind: "meals", category: "food", usd, unitUsd: DAILY_MEALS_USD, quantity: days * travellers, unit: "day_person" });
    for (let d = 1; d <= days; d++) byDay[d]! += DAILY_MEALS_USD * travellers;
  }

  const byCategory = { stay: 0, food: 0, transport: 0, sights: 0, experiences: 0, tours: 0 } as Record<BudgetCategory, number>;
  for (const l of lines) byCategory[l.category] += l.usd;
  const totalUsd = Math.round(lines.reduce((a, l) => a + l.usd, 0));
  return { lines, byCategory, byDay, totalUsd, perPersonUsd: Math.round(totalUsd / travellers), travellers, rooms, days, nights, unpriced };
}

// ── Look ───────────────────────────────────────────────────────────────────

/** Day colours on maps and in the itinerary (all readable with white text). */
export const DAY_COLORS = ["#173d66", "#b5532e", "#1e7b4f", "#7a3e9d", "#0f6f7a", "#a26a12", "#b42357", "#3d5a99", "#5b6b1f", "#8a4b2a"];
export const UNSCHEDULED_COLOR = "#667085";
export const dayColor = (day: number | undefined): string => (day ? DAY_COLORS[(day - 1) % DAY_COLORS.length]! : UNSCHEDULED_COLOR);

/** Marker colours per catalogue layer. */
export const KIND_COLORS: Record<TripItemKind, string> = {
  hotel: "#173d66",
  restaurant: "#b5532e",
  attraction: "#0f6f7a",
  experience: "#7a3e9d",
  activity: "#7a3e9d",
  tour: "#a26a12",
  transport: "#3d5a99",
  flight: "#3d5a99",
  train: "#3d5a99",
  transfer: "#3d5a99",
};

/** Comparable fingerprint of a trip's content (used to tell whether the saved link is up to date). */
export function tripSignature(trip: TripState): string {
  const { savedId: _s, ...rest } = trip;
  return JSON.stringify(rest);
}
