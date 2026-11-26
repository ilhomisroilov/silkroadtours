import "server-only";
import { and, asc, count, desc, eq, gte, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { conflict, notFound, unprocessable } from "@/lib/http";
import {
  convertMinor,
  lowestBasePrice,
  roundToDisplayStep,
  tierPriceIn,
  type PriceTierLike,
} from "@/lib/pricing";
import type {
  departureUpsertSchema,
  itineraryReplaceSchema,
  tourUpsertSchema,
} from "@/validators/admin";
import type { TourListQuery } from "@/validators/public";
import { runBatch, todayTashkent } from "../batch";
import type { Db } from "../client";
import {
  bookings,
  destinations,
  tourDepartures,
  tourDestinations,
  tourItineraryDays,
  tourPriceTiers,
  tours,
} from "../schema";
import type { Currency, ExchangeRates, Locale } from "../types";

type TourUpsert = z.output<typeof tourUpsertSchema>;
type ItineraryInput = z.output<typeof itineraryReplaceSchema>;
type DepartureInput = z.output<typeof departureUpsertSchema>;

// ── Public listing ─────────────────────────────────────────────────────────

const cardColumns = {
  id: tours.id,
  slug: tours.slug,
  audience: tours.audience,
  category: tours.category,
  title: tours.title,
  summary: tours.summary,
  durationDays: tours.durationDays,
  durationNights: tours.durationNights,
  difficulty: tours.difficulty,
  minGroup: tours.minGroup,
  maxGroup: tours.maxGroup,
  baseCurrency: tours.baseCurrency,
  compareAtPriceMinor: tours.compareAtPriceMinor,
  badges: tours.badges,
  heroImage: tours.heroImage,
  ratingAvg: tours.ratingAvg,
  ratingCount: tours.ratingCount,
  isFeatured: tours.isFeatured,
  sortOrder: tours.sortOrder,
  seasonMonths: tours.seasonMonths,
  destination: { id: destinations.id, slug: destinations.slug, name: destinations.name },
};

export interface TourCard {
  id: number;
  slug: string;
  audience: "inbound" | "domestic";
  category: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  durationDays: number;
  durationNights: number;
  difficulty: string;
  minGroup: number;
  maxGroup: number;
  badges: string[];
  heroImage: string;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  seasonMonths: number[];
  destination: { id: number; slug: string; name: Record<Locale, string> };
  /** Lowest per-person price in the requested currency, or null if the tour has no tiers yet. */
  fromPrice: { amountMinor: number; currency: Currency } | null;
  compareAtPrice: { amountMinor: number; currency: Currency } | null;
}

/** "Belongs to destination" = primary destination OR listed in tour_destinations. */
function destinationCondition(destinationId: number): SQL {
  return sql`(${tours.primaryDestinationId} = ${destinationId} OR EXISTS (SELECT 1 FROM ${tourDestinations} WHERE ${tourDestinations.tourId} = ${tours.id} AND ${tourDestinations.destinationId} = ${destinationId}))`;
}

/** Lowest per-person price for each tour in `currency`, honouring manual per-currency overrides. */
async function fromPrices(
  db: Db,
  rows: { id: number; baseCurrency: Currency }[],
  currency: Currency,
  rates: ExchangeRates,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (rows.length === 0) return result;
  const tiers = await db
    .select()
    .from(tourPriceTiers)
    .where(inArray(tourPriceTiers.tourId, rows.map((r) => r.id)));
  const base = new Map(rows.map((r) => [r.id, r.baseCurrency]));
  for (const t of tiers) {
    const baseCurrency = base.get(t.tourId);
    if (!baseCurrency) continue;
    try {
      const { amountMinor } = tierPriceIn(t, currency, baseCurrency, rates);
      const prev = result.get(t.tourId);
      if (prev === undefined || amountMinor < prev) result.set(t.tourId, amountMinor);
    } catch (err) {
      console.error(`[pricing] tour ${t.tourId} tier ${t.id}`, err);
    }
  }
  return result;
}

function matchesText(row: { title: Record<string, string>; summary: Record<string, string> }, q: string): boolean {
  const needle = q.toLocaleLowerCase();
  return [...Object.values(row.title), ...Object.values(row.summary)].some((v) =>
    v.toLocaleLowerCase().includes(needle),
  );
}

export async function listPublishedTours(
  db: Db,
  query: TourListQuery,
  rates: ExchangeRates,
): Promise<{ items: TourCard[]; total: number; page: number; pageSize: number }> {
  const conds: (SQL | undefined)[] = [eq(tours.isPublished, true)];
  if (query.audience) conds.push(eq(tours.audience, query.audience));
  if (query.category) conds.push(eq(tours.category, query.category));
  if (query.featured) conds.push(eq(tours.isFeatured, true));
  if (query.maxDays) conds.push(sql`${tours.durationDays} <= ${query.maxDays}`);
  if (query.guests) {
    conds.push(sql`${tours.minGroup} <= ${query.guests} AND ${tours.maxGroup} >= ${query.guests}`);
  }
  if (query.month) {
    conds.push(
      sql`(json_array_length(${tours.seasonMonths}) = 0 OR EXISTS (SELECT 1 FROM json_each(${tours.seasonMonths}) WHERE value = ${query.month}))`,
    );
  }
  if (query.destination) {
    const [dest] = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(and(eq(destinations.slug, query.destination), eq(destinations.isPublished, true)))
      .limit(1);
    if (!dest) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    conds.push(destinationCondition(dest.id));
  }

  let rows = await db
    .select(cardColumns)
    .from(tours)
    .innerJoin(destinations, eq(destinations.id, tours.primaryDestinationId))
    .where(and(...conds));

  // Case-insensitive search across all three languages (SQLite's lower() is ASCII-only, so do it here).
  if (query.q) rows = rows.filter((r) => matchesText(r, query.q!));

  const prices = await fromPrices(db, rows, query.currency, rates);
  const usd = (id: number) => {
    const p = prices.get(id);
    return p === undefined ? Number.POSITIVE_INFINITY : convertMinor(p, query.currency, "USD", rates);
  };

  rows.sort((a, b) => {
    switch (query.sort) {
      case "price_asc":
        return usd(a.id) - usd(b.id);
      case "price_desc":
        return usd(b.id) - usd(a.id);
      case "duration_asc":
        return a.durationDays - b.durationDays;
      case "duration_desc":
        return b.durationDays - a.durationDays;
      case "rating":
        return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
      case "featured":
      default:
        return Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder || a.id - b.id;
    }
  });

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const items = rows.slice(start, start + query.pageSize).map((r): TourCard => {
    const from = prices.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      audience: r.audience,
      category: r.category,
      title: r.title,
      summary: r.summary,
      durationDays: r.durationDays,
      durationNights: r.durationNights,
      difficulty: r.difficulty,
      minGroup: r.minGroup,
      maxGroup: r.maxGroup,
      badges: r.badges,
      heroImage: r.heroImage,
      ratingAvg: r.ratingAvg,
      ratingCount: r.ratingCount,
      isFeatured: r.isFeatured,
      seasonMonths: r.seasonMonths,
      destination: r.destination,
      fromPrice: from === undefined ? null : { amountMinor: from, currency: query.currency },
      compareAtPrice:
        r.compareAtPriceMinor == null
          ? null
          : {
              amountMinor: roundToDisplayStep(
                convertMinor(r.compareAtPriceMinor, r.baseCurrency, query.currency, rates),
                query.currency,
              ),
              currency: query.currency,
            },
    };
  });

  return { items, total, page: query.page, pageSize: query.pageSize };
}

// ── Tour detail ────────────────────────────────────────────────────────────

const destinationSummaryColumns = { id: true, slug: true, name: true, lat: true, lng: true } as const;

export async function getPublishedTourBySlug(db: Db, slug: string) {
  const today = todayTashkent();
  return db.query.tours.findFirst({
    where: and(eq(tours.slug, slug), eq(tours.isPublished, true)),
    with: {
      primaryDestination: { columns: destinationSummaryColumns },
      destinationLinks: {
        orderBy: (l, { asc }) => [asc(l.position)],
        with: { destination: { columns: destinationSummaryColumns } },
      },
      itinerary: { orderBy: (d, { asc }) => [asc(d.dayNumber)] },
      priceTiers: { orderBy: (t, { asc }) => [asc(t.bookingType), asc(t.minPax)] },
      departures: {
        where: (d, { and, gte, ne }) => and(gte(d.startDate, today), ne(d.status, "cancelled")),
        orderBy: (d, { asc }) => [asc(d.startDate)],
        limit: 60,
      },
    },
  });
}

export type PublishedTourDetail = NonNullable<Awaited<ReturnType<typeof getPublishedTourBySlug>>>;

/** Per-person price table in the requested currency for the detail page. */
export function priceTable(
  tour: Pick<PublishedTourDetail, "baseCurrency" | "priceTiers">,
  currency: Currency,
  rates: ExchangeRates,
) {
  return tour.priceTiers.map((t) => ({
    bookingType: t.bookingType,
    minPax: t.minPax,
    maxPax: t.maxPax,
    ...tierPriceIn(t, currency, tour.baseCurrency, rates),
    currency,
  }));
}

/** Related tours sharing the primary destination (excluding this one). */
export async function relatedTours(db: Db, tourId: number, destinationId: number, limit = 4) {
  return db
    .select({ id: tours.id, slug: tours.slug, title: tours.title, heroImage: tours.heroImage, durationDays: tours.durationDays, audience: tours.audience })
    .from(tours)
    .where(and(eq(tours.isPublished, true), ne(tours.id, tourId), destinationCondition(destinationId)))
    .orderBy(desc(tours.isFeatured), asc(tours.sortOrder))
    .limit(limit);
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function listToursAdmin(
  db: Db,
  filters: { q?: string; audience?: "inbound" | "domestic"; published?: "true" | "false" },
) {
  const conds: (SQL | undefined)[] = [];
  if (filters.audience) conds.push(eq(tours.audience, filters.audience));
  if (filters.published) conds.push(eq(tours.isPublished, filters.published === "true"));
  const bookingCount = db
    .select({ tourId: bookings.tourId, n: count().as("n") })
    .from(bookings)
    .groupBy(bookings.tourId)
    .as("bc");
  let rows = await db
    .select({
      id: tours.id,
      slug: tours.slug,
      title: tours.title,
      summary: tours.summary,
      audience: tours.audience,
      category: tours.category,
      durationDays: tours.durationDays,
      baseCurrency: tours.baseCurrency,
      fromPriceMinor: tours.fromPriceMinor,
      isPublished: tours.isPublished,
      isFeatured: tours.isFeatured,
      sortOrder: tours.sortOrder,
      updatedAt: tours.updatedAt,
      destination: { id: destinations.id, name: destinations.name },
      bookingCount: sql<number>`coalesce(${bookingCount.n}, 0)`,
    })
    .from(tours)
    .innerJoin(destinations, eq(destinations.id, tours.primaryDestinationId))
    .leftJoin(bookingCount, eq(bookingCount.tourId, tours.id))
    .where(and(...conds))
    .orderBy(asc(tours.sortOrder), asc(tours.id));
  if (filters.q) rows = rows.filter((r) => matchesText(r, filters.q!) || r.slug.includes(filters.q!.toLowerCase()));
  return rows;
}

export async function getTourAdmin(db: Db, id: number) {
  return db.query.tours.findFirst({
    where: eq(tours.id, id),
    with: {
      destinationLinks: { orderBy: (l, { asc }) => [asc(l.position)] },
      itinerary: { orderBy: (d, { asc }) => [asc(d.dayNumber)] },
      priceTiers: { orderBy: (t, { asc }) => [asc(t.bookingType), asc(t.minPax)] },
      departures: { orderBy: (d, { asc }) => [asc(d.startDate)] },
    },
  });
}

function tourValues(input: TourUpsert) {
  const { destinationIds: _ignored, ...rest } = input;
  return rest;
}

function destinationLinkRows(tourId: number, input: TourUpsert) {
  const ids = [input.primaryDestinationId, ...input.destinationIds.filter((d) => d !== input.primaryDestinationId)];
  return ids.map((destinationId, position) => ({ tourId, destinationId, position }));
}

async function assertDestinationsExist(db: Db, ids: number[]) {
  const unique = [...new Set(ids)];
  const found = await db.select({ id: destinations.id }).from(destinations).where(inArray(destinations.id, unique));
  if (found.length !== unique.length) throw unprocessable("destination_not_found");
}

async function assertSlugFree(db: Db, slug: string, exceptId?: number) {
  const [row] = await db.select({ id: tours.id }).from(tours).where(eq(tours.slug, slug)).limit(1);
  if (row && row.id !== exceptId) throw conflict("slug_taken");
}

export async function createTour(db: Db, input: TourUpsert): Promise<number> {
  await assertDestinationsExist(db, [input.primaryDestinationId, ...input.destinationIds]);
  await assertSlugFree(db, input.slug);
  const [row] = await db
    .insert(tours)
    .values({ ...tourValues(input), fromPriceMinor: 0 })
    .returning({ id: tours.id });
  if (!row) throw new Error("Tour insert returned no row");
  await db.insert(tourDestinations).values(destinationLinkRows(row.id, input));
  return row.id;
}

export async function updateTour(db: Db, id: number, input: TourUpsert): Promise<void> {
  const [existing] = await db.select({ id: tours.id, baseCurrency: tours.baseCurrency }).from(tours).where(eq(tours.id, id)).limit(1);
  if (!existing) throw notFound();
  await assertDestinationsExist(db, [input.primaryDestinationId, ...input.destinationIds]);
  await assertSlugFree(db, input.slug, id);

  const tiers = await db.select().from(tourPriceTiers).where(eq(tourPriceTiers.tourId, id));
  // If the base currency changes, every tier must already carry a price in the new base currency.
  if (input.baseCurrency !== existing.baseCurrency && tiers.some((t) => lowestBasePrice([t], input.baseCurrency) === null)) {
    throw unprocessable("tiers_missing_new_base_price");
  }
  const fromPrice = lowestBasePrice(tiers, input.baseCurrency) ?? 0;

  await runBatch(db, [
    db.update(tours).set({ ...tourValues(input), fromPriceMinor: fromPrice }).where(eq(tours.id, id)),
    db.delete(tourDestinations).where(eq(tourDestinations.tourId, id)),
    db.insert(tourDestinations).values(destinationLinkRows(id, input)),
  ]);
}

export async function deleteTour(db: Db, id: number): Promise<void> {
  const [row] = await db.select({ n: count() }).from(bookings).where(eq(bookings.tourId, id));
  if ((row?.n ?? 0) > 0) throw conflict("tour_has_bookings", "Unpublish the tour instead of deleting it.");
  const deleted = await db.delete(tours).where(eq(tours.id, id)).returning({ id: tours.id });
  if (deleted.length === 0) throw notFound();
}

/** Deep copy (content, destinations, itinerary, pricing) as an unpublished draft. Departures are not copied. */
export async function duplicateTour(db: Db, id: number): Promise<number> {
  const source = await getTourAdmin(db, id);
  if (!source) throw notFound();

  let slug = `${source.slug}-copy`.slice(0, 110);
  for (let n = 2; ; n++) {
    const [taken] = await db.select({ id: tours.id }).from(tours).where(eq(tours.slug, slug)).limit(1);
    if (!taken) break;
    slug = `${source.slug}-copy-${n}`.slice(0, 120);
  }

  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    destinationLinks,
    itinerary,
    priceTiers,
    departures: _d,
    ...content
  } = source;
  const [row] = await db
    .insert(tours)
    .values({
      ...content,
      slug,
      title: { en: `${content.title.en} (copy)`, uz: `${content.title.uz} (nusxa)`, ru: `${content.title.ru} (копия)` },
      isPublished: false,
      isFeatured: false,
      ratingAvg: 0,
      ratingCount: 0,
    })
    .returning({ id: tours.id });
  if (!row) throw new Error("Tour insert returned no row");

  await runBatch(db, [
    ...(destinationLinks.length
      ? [db.insert(tourDestinations).values(destinationLinks.map((l) => ({ ...l, tourId: row.id })))]
      : []),
    ...(itinerary.length
      ? [db.insert(tourItineraryDays).values(itinerary.map(({ id: _i, ...d }) => ({ ...d, tourId: row.id })))]
      : []),
    ...(priceTiers.length
      ? [db.insert(tourPriceTiers).values(priceTiers.map(({ id: _i, ...t }) => ({ ...t, tourId: row.id })))]
      : []),
  ]);
  return row.id;
}

export async function replaceItinerary(db: Db, tourId: number, days: ItineraryInput): Promise<void> {
  const [tour] = await db.select({ durationDays: tours.durationDays }).from(tours).where(eq(tours.id, tourId)).limit(1);
  if (!tour) throw notFound();
  if (days.some((d) => d.dayNumber > tour.durationDays)) throw unprocessable("day_exceeds_duration");
  await runBatch(db, [
    db.delete(tourItineraryDays).where(eq(tourItineraryDays.tourId, tourId)),
    ...(days.length ? [db.insert(tourItineraryDays).values(days.map((d) => ({ ...d, tourId })))] : []),
  ]);
}

export async function getTourBaseCurrency(db: Db, tourId: number): Promise<Currency> {
  const [tour] = await db.select({ baseCurrency: tours.baseCurrency }).from(tours).where(eq(tours.id, tourId)).limit(1);
  if (!tour) throw notFound();
  return tour.baseCurrency;
}

export async function replacePricing(
  db: Db,
  tourId: number,
  baseCurrency: Currency,
  tiers: PriceTierLike[],
): Promise<void> {
  const fromPrice = lowestBasePrice(tiers, baseCurrency) ?? 0;
  await runBatch(db, [
    db.delete(tourPriceTiers).where(eq(tourPriceTiers.tourId, tourId)),
    db.insert(tourPriceTiers).values(tiers.map((t) => ({ ...t, tourId }))),
    db.update(tours).set({ fromPriceMinor: fromPrice }).where(eq(tours.id, tourId)),
  ]);
}

// ── Departures ─────────────────────────────────────────────────────────────

export async function createDeparture(db: Db, tourId: number, input: DepartureInput): Promise<number> {
  const [tour] = await db.select({ id: tours.id }).from(tours).where(eq(tours.id, tourId)).limit(1);
  if (!tour) throw notFound();
  const [dup] = await db
    .select({ id: tourDepartures.id })
    .from(tourDepartures)
    .where(and(eq(tourDepartures.tourId, tourId), eq(tourDepartures.startDate, input.startDate)))
    .limit(1);
  if (dup) throw conflict("departure_exists");
  const [row] = await db.insert(tourDepartures).values({ ...input, tourId }).returning({ id: tourDepartures.id });
  return row!.id;
}

export async function updateDeparture(db: Db, tourId: number, depId: number, input: DepartureInput): Promise<void> {
  const [dep] = await db
    .select()
    .from(tourDepartures)
    .where(and(eq(tourDepartures.id, depId), eq(tourDepartures.tourId, tourId)))
    .limit(1);
  if (!dep) throw notFound();
  if (input.seatsTotal < dep.seatsBooked) throw unprocessable("seats_below_booked");
  if (input.startDate !== dep.startDate) {
    const [dup] = await db
      .select({ id: tourDepartures.id })
      .from(tourDepartures)
      .where(and(eq(tourDepartures.tourId, tourId), eq(tourDepartures.startDate, input.startDate)))
      .limit(1);
    if (dup) throw conflict("departure_exists");
  }
  await db.update(tourDepartures).set(input).where(eq(tourDepartures.id, depId));
}

export async function deleteDeparture(db: Db, tourId: number, depId: number): Promise<void> {
  const [active] = await db
    .select({ n: count() })
    .from(bookings)
    .where(and(eq(bookings.departureId, depId), inArray(bookings.status, ["pending", "confirmed"])));
  if ((active?.n ?? 0) > 0) throw conflict("departure_has_bookings", "Set the departure to cancelled instead.");
  const deleted = await db
    .delete(tourDepartures)
    .where(and(eq(tourDepartures.id, depId), eq(tourDepartures.tourId, tourId)))
    .returning({ id: tourDepartures.id });
  if (deleted.length === 0) throw notFound();
}

/** Upcoming departures across all tours (admin dashboard). */
export async function upcomingDepartures(db: Db, days = 30) {
  const from = todayTashkent();
  const to = todayTashkent(new Date(Date.now() + days * 86400_000));
  return db
    .select({
      id: tourDepartures.id,
      tourId: tours.id,
      tourTitle: tours.title,
      startDate: tourDepartures.startDate,
      seatsTotal: tourDepartures.seatsTotal,
      seatsBooked: tourDepartures.seatsBooked,
      status: tourDepartures.status,
    })
    .from(tourDepartures)
    .innerJoin(tours, eq(tours.id, tourDepartures.tourId))
    .where(and(gte(tourDepartures.startDate, from), sql`${tourDepartures.startDate} <= ${to}`, ne(tourDepartures.status, "cancelled")))
    .orderBy(asc(tourDepartures.startDate));
}

/** Minimal data needed to price a booking (used by /quote and /api/bookings). */
export async function getTourForQuote(db: Db, slug: string, departureId?: number) {
  const [tour] = await db
    .select({
      id: tours.id,
      slug: tours.slug,
      title: tours.title,
      audience: tours.audience,
      primaryDestinationId: tours.primaryDestinationId,
      baseCurrency: tours.baseCurrency,
      childPricePercent: tours.childPricePercent,
      minGroup: tours.minGroup,
      maxGroup: tours.maxGroup,
    })
    .from(tours)
    .where(and(eq(tours.slug, slug), eq(tours.isPublished, true)))
    .limit(1);
  if (!tour) return null;
  const tiers = await db.select().from(tourPriceTiers).where(eq(tourPriceTiers.tourId, tour.id));
  let departure: typeof tourDepartures.$inferSelect | null = null;
  if (departureId) {
    const [dep] = await db
      .select()
      .from(tourDepartures)
      .where(and(eq(tourDepartures.id, departureId), eq(tourDepartures.tourId, tour.id)))
      .limit(1);
    departure = dep ?? null;
  }
  return { ...tour, tiers, departure };
}

/** Distinct guide languages offered on published tours (ISO 639-1), for "Why travel with us". */
export async function publishedGuideLanguages(db: Db): Promise<string[]> {
  const rows = await db.all<{ lang: string }>(
    sql`SELECT DISTINCT j.value AS lang FROM tours t, json_each(t.guide_languages) j WHERE t.is_published = 1 ORDER BY j.value`,
  );
  return rows.map((r) => r.lang);
}
