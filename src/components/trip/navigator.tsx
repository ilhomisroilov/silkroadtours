"use client";

import { GlassSelect } from "@/components/ui/glass-select";
import { Crosshair, List, Loader2, LocateFixed, MapPin, Route } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import type { Currency, ExchangeRates, Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatUsdIn } from "@/lib/pricing";
import { dayColor, distanceKm, itemHref, KIND_COLORS, orderedItems, type CatalogEntry, type DestinationPoint } from "@/lib/trip-helpers";
import type { TripItem } from "@/lib/trip-store";
import { AddToTripButton } from "./add-to-trip-button";
import type { AtlasMarker, AtlasRoute } from "./atlas-map";
import { usePriceLabel } from "./builder-catalogue";
import { KindIcon } from "./kind-icon";
import { LazyAtlasMap } from "./lazy-atlas-map";
import { useCatalog } from "./use-catalog";
import { useTrip } from "./use-trip";

type Layer = "hotel" | "restaurant" | "attraction" | "transport" | "trip";
const LAYERS: Layer[] = ["attraction", "hotel", "restaurant", "transport", "trip"];
const layerOf = (e: CatalogEntry): Layer => (e.kind === "hotel" ? "hotel" : e.kind === "restaurant" ? "restaurant" : e.kind === "attraction" ? "attraction" : "transport");
const LAYER_COLOR: Record<Layer, string> = { hotel: KIND_COLORS.hotel, restaurant: KIND_COLORS.restaurant, attraction: KIND_COLORS.attraction, transport: KIND_COLORS.transport, trip: "#d9a441" };
type Geo = "idle" | "locating" | "ok" | "denied" | "unavailable" | "picking" | "picked";
type Point = { lat: number; lng: number };
const located = <T extends { lat?: number; lng?: number }>(x: T): x is T & Point => typeof x.lat === "number" && typeof x.lng === "number";
const strip = ({ tab: _t, summary: _s, href: _h, ...item }: CatalogEntry): TripItem => item;

export function Navigator({
  destinations,
  currency,
  rates,
  initialDestination,
  initialFocus,
}: {
  destinations: DestinationPoint[];
  currency: Currency;
  rates: ExchangeRates;
  initialDestination: string | null;
  initialFocus: string | null;
}) {
  const t = useTranslations("navigator");
  const tk = useTranslations("tripBuilder.catalogue.kind");
  const locale = useLocale() as Locale;
  const { entries, loading, error, retry } = useCatalog(locale, destinations, { withProducts: false });
  const { trip } = useTrip();
  const [destination, setDestination] = useState<string>(initialDestination ?? "");
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set(LAYERS));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geo>("idle");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const money = useCallback((usd: number) => formatUsdIn(Math.round(usd), currency, rates, locale), [currency, rates, locale]);
  const priceLabel = usePriceLabel(money);
  const destName = useMemo(() => new Map(destinations.map((d) => [d.slug, d.name])), [destinations]);
  const centre = destinations.find((d) => d.slug === destination && d.lat != null && d.lng != null);
  const fmtKm = (km: number) => (km < 1 ? t("meters", { m: Math.max(10, Math.round((km * 1000) / 10) * 10) }) : t("km", { km: km < 10 ? km.toFixed(1) : Math.round(km) }));

  // Keep ?destination= in the address bar so the view can be shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (destination) url.searchParams.set("destination", destination);
    else url.searchParams.delete("destination");
    if (!focusId) url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  }, [destination, focusId]);

  // Deep link ?focus=<kind:slug> once the catalogue is in.
  useEffect(() => {
    if (!initialFocus || entries.length === 0) return;
    const [kind, ref] = initialFocus.split(":");
    const hit = entries.find((e) => e.id === initialFocus) ?? entries.find((e) => e.refSlug === ref && (e.kind === kind || layerOf(e) === kind));
    if (hit && located(hit)) {
      if (!initialDestination && hit.destinationSlug) setDestination(hit.destinationSlug);
      setFocusId(hit.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  const inTrip = useMemo(() => new Set(trip.items.map((i) => i.id)), [trip.items]);
  const visible = useMemo(
    () => entries.filter((e) => located(e) && layers.has(layerOf(e)) && (!destination || e.destinationSlug === destination)),
    [entries, layers, destination],
  );
  const tripItems = useMemo(() => (layers.has("trip") ? orderedItems(trip.items).filter(located) : []), [trip.items, layers]);
  const ref: Point | null = origin ?? (centre ? { lat: centre.lat!, lng: centre.lng! } : null);
  const nearby = useMemo(() => {
    if (!ref) return visible.slice(0, 40).map((e) => ({ e, km: null as number | null }));
    return visible
      .map((e) => ({ e, km: distanceKm(ref, e as Point) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 40);
  }, [visible, ref?.lat, ref?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const popup = (e: TripItem & { href?: string }, km: number | null) => {
    const href = e.href ?? itemHref(e);
    const price = priceLabel(e);
    return (
      <div className="space-y-1.5 font-sans [&_p]:my-0!">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {tk(e.kind)}
          {e.destinationSlug && ` · ${destName.get(e.destinationSlug) ?? e.destinationSlug}`}
        </p>
        <p className="text-sm font-extrabold leading-snug text-lapis">{e.title}</p>
        {e.meta && <p className="text-xs text-ink-muted">{e.meta}</p>}
        {(price || km != null) && (
          <p className="text-xs font-semibold text-saffron-ink">
            {[price, km != null ? t("away", { distance: fmtKm(km) }) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <AddToTripButton {...e} size="sm" />
          {href && (
            <Link href={href} className="text-sm font-semibold text-cobalt underline">
              {t("details")}
            </Link>
          )}
        </div>
      </div>
    );
  };

  const markers: AtlasMarker[] = [];
  const tripIds = new Set(tripItems.map((i) => i.id));
  for (const e of visible) {
    if (tripIds.has(e.id)) continue;
    markers.push({ id: e.id, lat: e.lat!, lng: e.lng!, color: KIND_COLORS[e.kind], label: e.title, glyph: e.kind, highlight: inTrip.has(e.id), popup: popup(e, ref ? distanceKm(ref, e as Point) : null) });
  }
  for (const i of tripItems) {
    markers.push({ id: i.id, lat: i.lat, lng: i.lng, color: dayColor(i.day), label: `${i.title} · ${t("myTrip")}`, badge: i.day ? String(i.day) : undefined, glyph: i.kind, highlight: true, popup: popup(i, ref ? distanceKm(ref, i) : null) });
  }
  const routes: AtlasRoute[] = [];
  if (tripItems.length > 1) {
    const days = [...new Set(tripItems.map((i) => i.day ?? 0))];
    let prev: [number, number] | null = null;
    for (const d of days) {
      const pts = tripItems.filter((i) => (i.day ?? 0) === d).map((i) => [i.lat, i.lng] as [number, number]);
      if (prev && pts[0]) routes.push({ id: `link-${d}`, positions: [prev, pts[0]], color: "#8a94a6", dashed: true });
      routes.push({ id: `day-${d}`, positions: pts, color: dayColor(d || undefined), dashed: !d });
      prev = pts.at(-1) ?? prev;
    }
  }

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo("ok");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
  const onMapClick = (p: Point) => {
    if (geo !== "picking") return;
    setOrigin(p);
    setGeo("picked");
  };
  const toggleLayer = (l: Layer) =>
    setLayers((s) => {
      const n = new Set(s);
      if (n.has(l)) n.delete(l);
      else n.add(l);
      return n;
    });
  // With a destination chosen, frame what is in town (a train's departure station elsewhere should not zoom the map out).
  const fitTo = centre ? markers.filter((m) => distanceKm({ lat: centre.lat!, lng: centre.lng! }, m) < 60) : undefined;
  const far = origin && nearby[0]?.km != null && nearby[0].km > 300;
  const fitKey = `${destination}|${[...layers].sort().join(",")}|${loading ? 0 : 1}|${geo === "ok" || geo === "picked" ? `${origin?.lat},${origin?.lng}` : ""}`;

  const renderList = (inSheet: boolean) => (
    <div>
      <h2 className={cn("flex items-center justify-between gap-2 text-base font-extrabold text-lapis", inSheet && "pr-12")}>
        {ref ? t("nearbyTitle") : t("listTitle")}
        <span className="text-sm font-semibold text-ink-muted">{visible.length}</span>
      </h2>
      <p className="text-xs text-ink-muted">
        {origin ? (geo === "picked" ? t("fromPicked") : t("fromYou")) : centre ? t("fromCentre", { place: centre.name }) : t("pickDestination")}
      </p>
      {loading ? (
        <ul className="mt-3 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="skeleton h-16" />
          ))}
        </ul>
      ) : error ? (
        <div role="alert" className="mt-3 rounded-xl bg-sky p-3 text-sm">
          {t("error")}{" "}
          <button type="button" onClick={retry} className="font-bold text-cobalt underline">
            {t("retry")}
          </button>
        </div>
      ) : nearby.length === 0 ? (
        <p className="mt-3 rounded-xl bg-sand-soft p-4 text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {nearby.map(({ e, km }) => (
            <li key={e.id} className={cn("flex items-center gap-2.5 rounded-2xl border bg-white p-2.5", focusId === e.id ? "border-cobalt ring-2 ring-cobalt/20" : "border-line")}>
              <KindIcon kind={e.kind} />
              <button
                type="button"
                onClick={() => {
                  setFocusId(null);
                  setTimeout(() => setFocusId(e.id), 0);
                  setSheetOpen(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-bold text-lapis">{e.title}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {[km != null ? fmtKm(km) : null, e.destinationSlug ? destName.get(e.destinationSlug) : null, priceLabel(e)].filter(Boolean).join(" · ")}
                </span>
                <span className="sr-only">{t("showOnMap")}</span>
              </button>
              <AddToTripButton {...strip(e)} size="sm" compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const geoMessage =
    geo === "locating" ? t("locating") : geo === "denied" ? t("denied") : geo === "unavailable" ? t("unavailable") : geo === "picking" ? t("picking") : far ? t("far") : null;

  return (
    <section className="relative flex h-[calc(100dvh-72px)] min-h-[34rem] flex-col lg:flex-row" aria-labelledby="nav-title">
      <div className="z-10 shrink-0 border-b border-line bg-ivory lg:flex lg:w-[25rem] lg:flex-col lg:border-b-0 lg:border-r">
        <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-5">
          <div className="hidden lg:block">
            <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
            <h1 id="nav-title" className="mt-1.5 text-2xl text-lapis">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{t("lead")}</p>
          </div>
          <h1 className="sr-only lg:hidden">{t("title")}</h1>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("destination")}</span>
              <GlassSelect
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setFocusId(null);
                }}
                className="min-h-11 w-full rounded-full border border-field bg-white px-4 text-sm font-semibold text-lapis focus-visible:border-cobalt"
              >
                <option value="">{t("allDestinations")}</option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </GlassSelect>
            </label>
            <button
              type="button"
              onClick={locate}
              disabled={geo === "locating"}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-lapis px-4 text-sm font-bold text-white hover:bg-cobalt disabled:opacity-60"
            >
              {geo === "locating" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="size-4" />}
              {t("nearMe")}
            </button>
          </div>
          <div role="group" aria-label={t("layers")} className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {LAYERS.map((l) => {
              const on = layers.has(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLayer(l)}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                    on ? "bg-white text-lapis ring-lapis/40" : "bg-transparent text-ink-muted ring-line hover:bg-white",
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2.5 rounded-full", !on && "opacity-40")} style={{ background: LAYER_COLOR[l] }} />
                  {l === "trip" ? (
                    <>
                      <Route aria-hidden="true" className="size-4" /> {t("layer.trip")} <span className="text-xs text-ink-muted">({trip.items.length})</span>
                    </>
                  ) : (
                    t(`layer.${l}`)
                  )}
                </button>
              );
            })}
          </div>
          <div aria-live="polite" className="empty:hidden">
            {geoMessage && (
              <div className="rounded-xl bg-saffron-soft px-3 py-2 text-sm text-ink">
                <p>{geoMessage}</p>
                {(geo === "denied" || geo === "unavailable") && (
                  <button type="button" onClick={() => setGeo("picking")} className="mt-1.5 inline-flex min-h-10 items-center gap-1.5 font-bold text-cobalt underline">
                    <Crosshair aria-hidden="true" className="size-4" /> {t("pickOnMap")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 overflow-y-auto border-t border-line p-5 [scrollbar-width:thin] lg:block">{renderList(false)}</div>
      </div>

      <div className={cn("relative min-h-0 flex-1", geo === "picking" && "[&_.leaflet-container]:cursor-crosshair")}>
        <LazyAtlasMap
          eager
          label={t("mapLabel")}
          loadingLabel={t("loading")}
          attribution={t("attribution")}
          markers={markers}
          routes={routes}
          focusId={focusId}
          user={origin}
          userLabel={geo === "picked" ? t("pickedPoint") : t("you")}
          onMapClick={onMapClick}
          fitKey={fitKey}
          fitTo={fitTo}
          className="absolute inset-0"
        />
        <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="absolute bottom-4 left-1/2 z-20 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white shadow-lift hover:bg-cobalt lg:hidden"
            >
              <List aria-hidden="true" className="size-4" />
              {ref ? t("nearbyButton", { count: visible.length }) : t("listButton", { count: visible.length })}
            </button>
          </DialogTrigger>
          <SheetContent side="bottom" closeLabel={t("close")} className="p-4 pt-5">
            <DialogTitle className="sr-only">{t("listTitle")}</DialogTitle>
            {renderList(true)}
          </SheetContent>
        </Dialog>
        {!loading && visible.length === 0 && tripItems.length === 0 && (
          <p className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">
            <MapPin aria-hidden="true" className="mr-1 inline size-4 text-cobalt" />
            {t("emptyMap")}
          </p>
        )}
      </div>
    </section>
  );
}
