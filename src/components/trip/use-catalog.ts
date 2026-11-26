"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/db/types";
import {
  attractionToEntry,
  experienceToEntry,
  placeToEntry,
  tourToEntry,
  type AttractionLike,
  type CatalogEntry,
  type CatalogExperience,
  type CatalogTour,
  type DestinationPoint,
  type MetaFormat,
  type PlaceLike,
} from "@/lib/trip-helpers";

type Raw = { places: PlaceLike[]; attractions: AttractionLike[]; experiences: CatalogExperience[]; tours: CatalogTour[] };

/** Translated duration fragments for catalogue meta lines (namespace "tripBuilder.units"). */
export function useMetaFormat(): MetaFormat {
  const t = useTranslations("tripBuilder.units");
  return useMemo<MetaFormat>(
    () => ({
      duration: (min) => {
        const h = Math.floor(min / 60);
        const m = Math.round(min % 60);
        return h && m ? t("durationHM", { h, m }) : h ? t("durationH", { h }) : t("durationM", { m });
      },
      hours: (n) => t("hours", { n }),
      days: (n) => t("days", { n }),
    }),
    [t],
  );
}

/**
 * The whole bookable catalogue (hotels, restaurants, transport and sights from GET /api/places; experiences and tours
 * from GET /api/trip-catalog), loaded once per page and filtered on the client.
 */
export function useCatalog(locale: Locale, destinations: DestinationPoint[], opts: { withProducts?: boolean } = {}) {
  const withProducts = opts.withProducts !== false;
  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fmt = useMetaFormat();

  useEffect(() => {
    let alive = true;
    setError(false);
    const get = async <T,>(url: string): Promise<T> => {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      return ((await r.json()) as { data: T }).data;
    };
    Promise.all([
      get<{ places: PlaceLike[]; attractions: AttractionLike[] }>("/api/places"),
      withProducts ? get<{ experiences: CatalogExperience[]; tours: CatalogTour[] }>(`/api/trip-catalog?locale=${locale}`) : Promise.resolve({ experiences: [], tours: [] }),
    ])
      .then(([p, c]) => alive && setRaw({ places: p.places ?? [], attractions: p.attractions ?? [], experiences: c.experiences ?? [], tours: c.tours ?? [] }))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [locale, withProducts, attempt]);

  const entries = useMemo<CatalogEntry[]>(() => {
    if (!raw) return [];
    const dest = new Map(destinations.map((d) => [d.slug, d]));
    return [
      ...raw.places.map((p) => placeToEntry(p, locale, fmt)),
      ...raw.attractions.map((a) => attractionToEntry(a, locale, dest.get(a.destinationSlug)?.name)),
      ...raw.experiences.map((e) => experienceToEntry(e, fmt, e.destinationSlug ? dest.get(e.destinationSlug) : undefined)),
      ...raw.tours.map((t) => tourToEntry(t, fmt, dest.get(t.destinationSlug))),
    ];
  }, [raw, destinations, locale, fmt]);

  return { entries, loading: !raw && !error, error, retry: () => setAttempt((n) => n + 1) };
}
