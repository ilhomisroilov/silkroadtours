import "server-only";
import { eq, inArray } from "drizzle-orm";
import { findTier, tierPriceIn } from "@/lib/pricing";
import type { Db } from "../client";
import { destinations, tourDestinations, tourPriceTiers, tours } from "../schema";
import type { ExchangeRates } from "../types";

/** Group sizes the builder prices separately; bigger groups use the last value. */
export const BUILDER_MAX_PAX = 8;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Typical price per person per day (USD) at each destination for groups of 1…BUILDER_MAX_PAX, taken from the
 * published tours that visit it: for every tour, the private-tour price tier for that group size divided by the
 * tour's days; then the median over the tours. Feeds the tour builder's indicative budget.
 */
export async function builderDailyRates(db: Db, rates: ExchangeRates): Promise<{ bySlug: Record<string, number[]>; overall: number[] }> {
  const published = await db
    .select({ id: tours.id, days: tours.durationDays, base: tours.baseCurrency, primary: tours.primaryDestinationId })
    .from(tours)
    .where(eq(tours.isPublished, true));
  if (published.length === 0) return { bySlug: {}, overall: [] };
  const ids = published.map((t) => t.id);
  const [tiers, links, dests] = await Promise.all([
    db.select().from(tourPriceTiers).where(inArray(tourPriceTiers.tourId, ids)),
    db.select({ tourId: tourDestinations.tourId, destinationId: tourDestinations.destinationId }).from(tourDestinations).where(inArray(tourDestinations.tourId, ids)),
    db.select({ id: destinations.id, slug: destinations.slug }).from(destinations),
  ]);
  const slugOf = new Map(dests.map((d) => [d.id, d.slug]));

  // perDay[tourId][pax-1] in USD
  const perDay = new Map<number, (number | null)[]>();
  for (const t of published) {
    const own = tiers.filter((x) => x.tourId === t.id);
    const row: (number | null)[] = [];
    for (let pax = 1; pax <= BUILDER_MAX_PAX; pax++) {
      const tier = findTier(own, "private", pax) ?? findTier(own, "group", pax);
      let v: number | null = null;
      if (tier && t.days > 0) {
        try {
          v = tierPriceIn(tier, "USD", t.base, rates).amountMinor / 100 / t.days;
        } catch {
          v = null;
        }
      }
      row.push(v);
    }
    perDay.set(t.id, row);
  }

  const toursAt = new Map<string, Set<number>>();
  const link = (destId: number | null, tourId: number) => {
    const slug = destId != null ? slugOf.get(destId) : undefined;
    if (!slug) return;
    const set = toursAt.get(slug) ?? new Set<number>();
    set.add(tourId);
    toursAt.set(slug, set);
  };
  for (const t of published) link(t.primary, t.id);
  for (const l of links) link(l.destinationId, l.tourId);

  const series = (tourIds: Iterable<number>): number[] => {
    const out: number[] = [];
    for (let i = 0; i < BUILDER_MAX_PAX; i++) {
      const xs = [...tourIds].map((id) => perDay.get(id)?.[i]).filter((v): v is number => v != null);
      const m = median(xs);
      out.push(m == null ? (out[i - 1] ?? 0) : Math.round(m));
    }
    // A bigger group never pays more per person than a smaller one.
    for (let i = 1; i < out.length; i++) if (out[i]! > out[i - 1]! && out[i - 1]! > 0) out[i] = out[i - 1]!;
    return out;
  };

  const bySlug: Record<string, number[]> = {};
  for (const [slug, set] of toursAt) {
    const s = series(set);
    if (s.some((v) => v > 0)) bySlug[slug] = s;
  }
  return { bySlug, overall: series(published.map((t) => t.id)) };
}
