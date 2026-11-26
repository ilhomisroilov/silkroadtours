import { ArrowRight, BedDouble, CalendarDays, Clock, MapPin, Plane, Search, TrainFront, Users, UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPlaces, type Place } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { getPathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { localize } from "@/lib/localize";
import type { TransportInfo } from "@/lib/places/extras";
import { ratingOf } from "@/lib/places/query";
import { cityKeyOf, connectedCities, tashkentDate, type CityKey } from "@/lib/places/schedule";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, requestCurrency } from "@/lib/server/site";
import { PlaceCard } from "./place-card";

/** Best-rated places, one per destination, in catalogue order. */
function pick(list: Place[], n: number): Place[] {
  const out: Place[] = [];
  for (const p of [...list].sort((a, b) => ratingOf(b) - ratingOf(a))) {
    if (out.length >= n) break;
    if (!out.some((o) => o.destinationSlug === p.destinationSlug)) out.push(p);
  }
  return out;
}

/**
 * Homepage block: a few featured hotels and restaurants with links to /hotels and /restaurants.
 * Self-contained; pass `className` to change the outer spacing (defaults to a homepage section).
 */
export async function HotelsRestaurantsPreview({ locale, className = "container-page pt-20" }: { locale: Locale; className?: string }) {
  const [t, hotels, restaurants, destinations, currency, rates] = await Promise.all([
    getTranslations({ locale, namespace: "placeCommon" }),
    listPlaces(db(), { kind: "hotel" }),
    listPlaces(db(), { kind: "restaurant" }),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  if (hotels.length === 0 && restaurants.length === 0) return null;
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const items = [...pick(hotels, 2), ...pick(restaurants, 2)];
  const link = "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold transition-colors";

  return (
    <section className={className} aria-labelledby="stay-eat-title">
      <SectionHeading
        id="stay-eat-title"
        eyebrow={t("preview.eyebrow")}
        title={t("preview.title")}
        text={t("preview.text")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hotels" className={cn(link, "bg-lapis-deep text-white hover:bg-cobalt")}>
              <BedDouble aria-hidden="true" className="size-4" /> {t("preview.allHotels")}
            </Link>
            <Link href="/restaurants" className={cn(link, "border border-lapis-deep text-lapis-deep hover:bg-lapis-deep hover:text-white")}>
              <UtensilsCrossed aria-hidden="true" className="size-4" /> {t("preview.allRestaurants")}
            </Link>
          </div>
        }
      />
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <li key={`${p.kind}-${p.slug}`}>
            <PlaceCard
              place={p}
              locale={locale}
              compact
              destinationName={p.destinationSlug ? destName.get(p.destinationSlug) : undefined}
              price={p.priceFromUsd != null ? formatUsdIn(p.priceFromUsd, currency, rates, locale) : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const POPULAR: [CityKey, CityKey][] = [
  ["tashkent", "samarkand"],
  ["samarkand", "bukhara"],
  ["tashkent", "khiva"],
];

/**
 * Homepage block: a compact flights & trains search (plain GET form to /transport, no JavaScript needed)
 * and three popular routes with indicative fares.
 */
export async function TransportPreview({ locale, className = "container-page pt-20" }: { locale: Locale; className?: string }) {
  const [t, places, currency, rates] = await Promise.all([
    getTranslations({ locale, namespace: "transportSearch" }),
    listPlaces(db(), { kind: "transport" }),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const routes = places
    .map((p) => ({ p, d: p.details as TransportInfo }))
    .map(({ p, d }) => ({ p, d, from: cityKeyOf(d.from), to: cityKeyOf(d.to) }))
    .filter((r): r is typeof r & { from: CityKey; to: CityKey } => !!r.from && !!r.to && r.from !== r.to && ["train", "flight", "bus", "shared_taxi", "car"].includes(r.d.mode));
  if (routes.length === 0) return null;
  const cities = connectedCities(routes.map((r) => ({ slug: r.p.slug, mode: "train", from: r.from, to: r.to, durationMin: 0, name: "", operator: "", note: "", image: null, classes: [] })));
  const serves = (key: CityKey, wanted: CityKey) => key === wanted || (key === "urgench" && wanted === "khiva");
  const popular = POPULAR.map(([a, b]) => {
    const options = routes.filter((r) => (serves(r.from, a) && serves(r.to, b)) || (serves(r.from, b) && serves(r.to, a)));
    if (options.length === 0) return null;
    const cheapest = Math.min(...options.map((r) => Math.min(...(r.d.classes ?? []).map((c) => c.priceFromUsd), r.p.priceFromUsd ?? Infinity)));
    const fastest = Math.min(...options.map((r) => r.d.durationMin));
    const flight = options.some((r) => r.d.mode === "flight");
    return { a, b, cheapest, fastest, flight };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const date = tashkentDate(1);
  const dur = (min: number) => t("duration", { h: Math.floor(min / 60), m: String(min % 60).padStart(2, "0") });
  const field = "block min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-field bg-white px-3.5 text-[0.95rem] font-semibold text-ink focus-visible:border-cobalt";
  const label = "mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted";

  return (
    <section className={className} aria-labelledby="transport-preview-title">
      <div className="grid gap-6 overflow-hidden rounded-[1.75rem] bg-lapis-deep p-5 text-white shadow-lift sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-saffron">
            {t("eyebrow")}
            <span aria-hidden="true" className="h-px w-10 bg-saffron/50" />
          </p>
          <h2 id="transport-preview-title" className="mt-3 text-3xl text-white">
            {t("previewTitle")}
          </h2>
          <p className="mt-2 text-white/80">{t("previewText")}</p>
          <form action={getPathname({ locale, href: "/transport" })} method="get" role="search" aria-label={t("formLabel")} className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-ink">
            <label className="block">
              <span className={label}>
                <MapPin aria-hidden="true" className="size-3.5" /> {t("from")}
              </span>
              <select name="from" defaultValue="tashkent" className={field}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {t(`cities.${c}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>
                <MapPin aria-hidden="true" className="size-3.5" /> {t("to")}
              </span>
              <select name="to" defaultValue="samarkand" className={field}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {t(`cities.${c}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>
                <CalendarDays aria-hidden="true" className="size-3.5" /> {t("date")}
              </span>
              <input type="date" name="date" defaultValue={date} min={tashkentDate(0)} className={field} />
            </label>
            <label className="block">
              <span className={label}>
                <Users aria-hidden="true" className="size-3.5" /> {t("passengers")}
              </span>
              <select name="pax" defaultValue="2" className={field}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft">
              <Search aria-hidden="true" className="size-5" /> {t("search")}
            </button>
          </form>
        </div>
        <div className="min-w-0">
          <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-white/70">{t("popularTitle")}</h3>
          <ul className="mt-3 space-y-3">
            {popular.map((r) => (
              <li key={`${r.a}-${r.b}`}>
                <Link
                  href={{ pathname: "/transport", query: { from: r.a, to: r.b, date } }}
                  className="group flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-saffron">
                    {r.flight ? <Plane aria-hidden="true" className="size-5" /> : <TrainFront aria-hidden="true" className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-white">
                      {t(`cities.${r.a}` as never)} → {t(`cities.${r.b}` as never)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-white/75">
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden="true" className="size-3.5" /> {t("fromDuration", { duration: dur(r.fastest) })}
                      </span>
                      {Number.isFinite(r.cheapest) && <span>{t("fromFare", { price: formatUsdIn(r.cheapest, currency, rates, locale) })}</span>}
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-white/70">{t("previewNote")}</p>
        </div>
      </div>
    </section>
  );
}
