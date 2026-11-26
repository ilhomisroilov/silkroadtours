import { ArrowRight, BedDouble, Headset, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PhotoHero } from "@/components/common/photo-hero";
import { PlaceCard } from "@/components/places/place-card";
import { PlaceFilters, type FilterField } from "@/components/places/place-filters";
import { EmptyState } from "@/components/ui/misc";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPlaces } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { AMENITIES, type HotelInfo } from "@/lib/places/extras";
import { all, first, matchesText, num, sortPlaces, type SearchParams } from "@/lib/places/query";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hotels" });
  return pageMetadata({ locale, href: "/hotels", title: t("metaTitle"), description: t("metaDescription"), image: null });
}

export default async function HotelsPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [t, tc, tn] = await Promise.all([
    getTranslations({ locale, namespace: "hotels" }),
    getTranslations({ locale, namespace: "placeCommon" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const [hotels, destinations, currency, rates] = await Promise.all([
    listPlaces(db(), { kind: "hotel" }),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));

  const destination = first(sp.destination);
  const q = first(sp.q);
  const min = num(sp.min);
  const max = num(sp.max);
  const stars = num(sp.stars);
  const amenities = all(sp.amenity);
  const sort = first(sp.sort);

  const items = sortPlaces(
    hotels.filter((h) => {
      const d = h.details as HotelInfo;
      if (destination && h.destinationSlug !== destination) return false;
      if (min != null && (h.priceFromUsd ?? 0) < min) return false;
      if (max != null && (h.priceFromUsd ?? 0) > max) return false;
      if (stars != null && (d.stars ?? 0) < stars) return false;
      if (amenities.some((a) => !d.amenities.includes(a))) return false;
      return matchesText(h, q, locale);
    }),
    sort,
  );

  const usedDest = [...new Set(hotels.map((h) => h.destinationSlug).filter((s): s is string => !!s))];
  const usedAmenities = AMENITIES.filter((a) => hotels.some((h) => (h.details as HotelInfo).amenities.includes(a)));
  const fields: FilterField[] = [
    { kind: "search", name: "q", label: tc("search"), placeholder: t("searchPlaceholder") },
    {
      kind: "select",
      name: "destination",
      label: tc("destination"),
      any: tc("anyDestination"),
      options: usedDest.map((s) => ({ value: s, label: destName.get(s) ?? s })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    },
    { kind: "range", min: "min", max: "max", label: t("priceRange"), minLabel: tc("min"), maxLabel: tc("max") },
    { kind: "chips", name: "stars", label: t("starsFilter"), any: tc("any"), options: [3, 4, 5].map((n) => ({ value: String(n), label: t("starsAndUp", { count: n }) })) },
    { kind: "checks", name: "amenity", label: tc("amenitiesTitle"), options: usedAmenities.map((a) => ({ value: a, label: tc(`amenities.${a}`) })) },
  ];

  const trust = [
    { icon: BedDouble, text: t("trust1") },
    { icon: ShieldCheck, text: t("trust2") },
    { icon: Headset, text: t("trust3") },
  ];

  return (
    <>
      <PhotoHero
        locale={locale}
        image="/images/destinations/bukhara/4.jpg"
        crumbLabel={tn("breadcrumb")}
        crumbs={[
          { name: tn("home"), href: "/" },
          { name: t("title"), href: "/hotels" },
        ]}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      >
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/90">
          {trust.map((x) => (
            <li key={x.text} className="inline-flex items-center gap-2">
              <x.icon aria-hidden="true" className="size-4 text-saffron" /> {x.text}
            </li>
          ))}
        </ul>
      </PhotoHero>

      <div className="container-page py-10 lg:py-14">
        <PlaceFilters
          fields={fields}
          values={sp}
          sort={{
            name: "sort",
            label: tc("sort"),
            options: [
              { value: "recommended", label: tc("sortOptions.recommended") },
              { value: "price_asc", label: tc("sortOptions.price_asc") },
              { value: "price_desc", label: tc("sortOptions.price_desc") },
              { value: "rating", label: tc("sortOptions.rating") },
            ],
          }}
          labels={{ title: tc("filters"), apply: tc("apply"), reset: tc("reset"), show: tc("showFilters") }}
          resultsLabel={t("results", { count: items.length })}
        >
          {items.length === 0 ? (
            <EmptyState
              title={tc("emptyTitle")}
              action={
                <Link href="/hotels" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                  {t("showAll")}
                </Link>
              }
            >
              {tc("emptyText")}
            </EmptyState>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="hotel-list">
              {items.map((h) => (
                <li key={h.slug}>
                  <PlaceCard
                    place={h}
                    locale={locale}
                    headingLevel="h2"
                    destinationName={h.destinationSlug ? destName.get(h.destinationSlug) : undefined}
                    price={h.priceFromUsd != null ? formatUsdIn(h.priceFromUsd, currency, rates, locale) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-sm text-ink-muted">{tc("priceNote")}</p>
        </PlaceFilters>

        <section className="bg-girih-dark on-dark mt-14 overflow-hidden rounded-[1.75rem] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10" aria-labelledby="hotels-cta">
          <div className="max-w-2xl">
            <h2 id="hotels-cta" className="text-3xl text-white">
              {t("ctaTitle")}
            </h2>
            <p className="mt-3 text-lg text-white/80">{t("ctaText")}</p>
          </div>
          <Link href="/services/accommodation" className="mt-6 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft lg:mt-0">
            {t("ctaButton")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
