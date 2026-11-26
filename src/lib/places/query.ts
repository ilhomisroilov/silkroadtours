import "server-only";
import type { Place } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import type { PlaceExtras } from "./extras";

export type SearchParams = Record<string, string | string[] | undefined>;

export const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
export const all = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
export const num = (v: string | string[] | undefined): number | undefined => {
  const n = Number(first(v));
  return first(v) !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Free-text match on the name, summary, area and tags in the visitor's language and in English. */
export function matchesText(p: Place, q: string | undefined, locale: Locale): boolean {
  const needle = q?.trim().toLowerCase();
  if (!needle) return true;
  const d = p.details as { area?: Record<Locale, string>; cuisine?: string[] };
  const hay = [
    localize(p.name, locale),
    p.name.en,
    localize(p.summary, locale),
    d.area ? localize(d.area, locale) : "",
    d.area?.en ?? "",
    p.destinationSlug ?? "",
    ...p.tags,
    ...(d.cuisine ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export const ratingOf = (p: Place): number => (p.details as PlaceExtras).rating?.score ?? 0;

export function sortPlaces(list: Place[], sort: string | undefined): Place[] {
  const out = [...list];
  if (sort === "price_asc") out.sort((a, b) => (a.priceFromUsd ?? 1e9) - (b.priceFromUsd ?? 1e9));
  else if (sort === "price_desc") out.sort((a, b) => (b.priceFromUsd ?? -1) - (a.priceFromUsd ?? -1));
  else if (sort === "rating") out.sort((a, b) => ratingOf(b) - ratingOf(a));
  return out;
}
