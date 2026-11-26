import type { Currency } from "../db/types";
import { tourListQuerySchema, type TourListQuery } from "../validators/public";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Turns /tours?… search params into a validated listing query. Invalid or empty values are
 * dropped (a bad bookmark shows all tours rather than an error). The currency always comes
 * from the visitor's preference, never from the URL.
 */
export function parseTourSearchParams(raw: RawParams, currency: Currency, pageSize = 12): TourListQuery {
  const obj: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const value = Array.isArray(v) ? v[v.length - 1] : v;
    if (value !== undefined && value.trim() !== "" && k !== "currency" && k !== "pageSize") obj[k] = value.trim();
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const r = tourListQuerySchema.safeParse({ ...obj, currency, pageSize });
    if (r.success) return r.data;
    const bad = new Set(r.error.issues.map((i) => String(i.path[0])));
    if (bad.size === 0) break;
    for (const k of bad) delete obj[k];
  }
  return tourListQuerySchema.parse({ currency, pageSize });
}

/** The filter values to show in the form (only those that survived validation). */
export function filterValuesFrom(q: TourListQuery) {
  return {
    audience: q.audience,
    destination: q.destination,
    category: q.category,
    month: q.month?.toString(),
    guests: q.guests?.toString(),
    maxDays: q.maxDays?.toString(),
    q: q.q,
    sort: q.sort === "featured" ? undefined : q.sort,
  };
}
