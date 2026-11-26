"use client";

import { ListChecks, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Currency, ExchangeRates, Locale } from "@/db/types";
import { formatUsdIn } from "@/lib/pricing";
import { autoArrange, estimateBudget, MAX_TRIP_DESTINATIONS, tripDayCount, type DestinationPoint } from "@/lib/trip-helpers";
import { loadTrip, type TripState } from "@/lib/trip-store";
import { BuilderAi } from "./builder-ai";
import { BuilderBudget } from "./builder-budget";
import { BuilderCatalogue, usePriceLabel } from "./builder-catalogue";
import { BuilderItinerary } from "./builder-itinerary";
import { BuilderMap } from "./builder-map";
import { BuilderSetup } from "./builder-setup";
import { BuilderInquiry, BuilderShare, useTripSaving } from "./builder-share";
import { useCatalog } from "./use-catalog";
import { useTrip } from "./use-trip";

export interface SharedTrip {
  id: string;
  trip: TripState;
  includeMeals: boolean;
}

const QUICK_START = [
  { key: "classic", slugs: ["samarkand", "bukhara", "khiva"] },
  { key: "short", slugs: ["tashkent", "samarkand"] },
  { key: "valley", slugs: ["fergana-valley", "margilan", "kokand"] },
];

/** The Trip Constructor: inputs, service catalogue, day-by-day itinerary, map, budget, AI draft, share link and booking request. */
export function TripBuilder({
  destinations,
  currency,
  rates,
  prefill,
  shared,
  sharedMissing = false,
}: {
  destinations: DestinationPoint[];
  currency: Currency;
  rates: ExchangeRates;
  prefill?: string | null;
  shared?: SharedTrip | null;
  sharedMissing?: boolean;
}) {
  const t = useTranslations("tripBuilder");
  const locale = useLocale() as Locale;
  const { trip, ready, update, replace } = useTrip();
  const { entries, loading, error, retry } = useCatalog(locale, destinations);
  const [includeMeals, setIncludeMeals] = useState(true);
  const [view, setView] = useState<"catalogue" | "trip">("catalogue");
  const [pendingShared, setPendingShared] = useState<SharedTrip | null>(null);
  const [notice, setNotice] = useState<string | null>(sharedMissing ? t("shared.missing") : null);
  const saving = useTripSaving(trip, includeMeals, update);
  const boot = useRef(false);

  const byName = useMemo(() => new Map(destinations.map((d) => [d.slug, d.name])), [destinations]);
  const destinationName = useCallback((slug: string) => byName.get(slug) ?? slug.replace(/-/g, " "), [byName]);
  const centres = useMemo(
    () => Object.fromEntries(destinations.filter((d) => d.lat != null && d.lng != null).map((d) => [d.slug, { lat: d.lat!, lng: d.lng! }])),
    [destinations],
  );
  const money = useCallback((usd: number) => formatUsdIn(Math.round(usd), currency, rates, locale), [currency, rates, locale]);
  const priceLabel = usePriceLabel(money);

  const openShared = (s: SharedTrip) => {
    replace(s.trip);
    saving.markSaved(s.trip, s.id);
    setIncludeMeals(s.includeMeals);
    setPendingShared(null);
    setNotice(t("shared.loaded"));
    setView("trip");
  };

  useEffect(() => {
    if (!ready || boot.current) return;
    boot.current = true;
    if (shared) {
      const local = loadTrip();
      if ((local.items.length === 0 && local.destinations.length === 0) || local.savedId === shared.id) openShared(shared);
      else setPendingShared(shared);
      return;
    }
    if (prefill && byName.has(prefill)) {
      update((s) => (s.destinations.includes(prefill) || s.destinations.length >= MAX_TRIP_DESTINATIONS ? s : { ...s, destinations: [...s.destinations, prefill] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const dayCount = tripDayCount(trip);
  const budget = useMemo(() => estimateBudget(trip, { includeMeals: includeMeals && trip.items.length > 0 }), [trip, includeMeals]);
  const onAutoArrange = () => update((s) => ({ ...s, items: autoArrange(s, centres) }));
  const onQuickStart = (slugs: string[]) =>
    update((s) => ({ ...s, destinations: [...new Set([...s.destinations, ...slugs.filter((x) => byName.has(x))])].slice(0, MAX_TRIP_DESTINATIONS) }));
  const quickStart = QUICK_START.filter((q) => q.slugs.every((s) => byName.has(s)));

  const segBtn = (key: "catalogue" | "trip", label: string, Icon: typeof Store, extra?: string) => (
    <button
      type="button"
      aria-pressed={view === key}
      onClick={() => {
        setView(key);
        document.getElementById("tb-views")?.scrollIntoView({ block: "start" });
      }}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-bold transition ${view === key ? "bg-lapis text-white" : "text-lapis"}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
      {extra && <span className={`rounded-full px-1.5 text-xs ${view === key ? "bg-white/20" : "bg-sky"}`}>{extra}</span>}
    </button>
  );

  return (
    <div className="space-y-6 pb-4">
      <BuilderSetup trip={trip} destinations={destinations} update={update} />

      {(notice || pendingShared) && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-saffron-soft px-4 py-3 text-sm text-ink ring-1 ring-saffron/40">
          <span>{pendingShared ? t("shared.pending") : notice}</span>
          {pendingShared ? (
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openShared(pendingShared)} className="inline-flex min-h-10 items-center rounded-full bg-lapis px-4 font-bold text-white hover:bg-cobalt">
                {t("shared.open")}
              </button>
              <button type="button" onClick={() => setPendingShared(null)} className="inline-flex min-h-10 items-center rounded-full bg-white px-4 font-bold text-lapis ring-1 ring-line hover:bg-sky">
                {t("shared.keep")}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setNotice(null)} className="inline-flex min-h-10 items-center rounded-full px-3 font-semibold text-lapis hover:bg-white/60">
              {t("shared.dismiss")}
            </button>
          )}
        </div>
      )}

      <div id="tb-views" className="sticky top-[72px] z-30 -mx-4 scroll-mt-[72px] bg-ivory/95 px-4 py-2 backdrop-blur lg:hidden">
        <div role="group" aria-label={t("views")} className="flex gap-1 rounded-full bg-white p-1 shadow-card">
          {segBtn("catalogue", t("viewCatalogue"), Store)}
          {segBtn("trip", t("viewTrip"), ListChecks, String(trip.items.length))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className={view === "catalogue" ? "min-w-0" : "hidden min-w-0 lg:block"}>
          <BuilderCatalogue
            entries={entries}
            loading={loading}
            error={error}
            retry={retry}
            tripDestinations={trip.destinations}
            destinationName={destinationName}
            money={money}
          />
        </div>
        <div className={`${view === "trip" ? "min-w-0" : "hidden min-w-0 lg:block"} lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-104px)] lg:overflow-y-auto lg:rounded-[var(--radius-card)] lg:[scrollbar-width:thin]`}>
          {ready ? (
            <BuilderItinerary
              trip={trip}
              dayCount={dayCount}
              update={update}
              priceLabel={priceLabel}
              destinationName={destinationName}
              onAutoArrange={onAutoArrange}
              onQuickStart={onQuickStart}
              quickStart={quickStart}
            />
          ) : (
            <div className="card space-y-3 p-5" aria-busy="true">
              <div className="skeleton h-8 w-1/2" />
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
            </div>
          )}
        </div>
      </div>

      <div className={`${view === "trip" ? "grid" : "hidden lg:grid"} gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start`}>
        <BuilderMap trip={trip} dayCount={dayCount} />
        <BuilderBudget budget={budget} money={money} includeMeals={includeMeals} setIncludeMeals={setIncludeMeals} startDate={trip.startDate} />
      </div>

      <div className={view === "trip" ? "block" : "hidden lg:block"}>
        <BuilderAi trip={trip} dayCount={dayCount} entries={entries} destinations={destinations} destinationName={destinationName} />
      </div>

      <div className={`${view === "trip" ? "grid" : "hidden lg:grid"} gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start`}>
        <BuilderShare saving={saving} />
        <BuilderInquiry trip={trip} budget={budget} money={money} saving={saving} destinationName={destinationName} />
      </div>
    </div>
  );
}
