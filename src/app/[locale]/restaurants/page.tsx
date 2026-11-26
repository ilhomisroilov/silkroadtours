import { ArrowRight, Salad, ShieldCheck, UtensilsCrossed } from "lucide-react";
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
import { CUISINES, DIETARY, priceLevelSymbol, type RestaurantInfo } from "@/lib/places/extras";
import { all, first, matchesText, num, sortPlaces, type SearchParams } from "@/lib/places/query";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "restaurants" });
  return pageMetadata({ locale, href: "/restaurants", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function RestaurantsPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [t, tc, tn] = await Promise.all([
    getTranslations({ locale, namespace: "restaurants" }),
    getTranslations({ locale, namespace: "placeCommon" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const [restaurants, destinations, currency, rates] = await Promise.all([
    listPlaces(db(), { kind: "restaurant" }),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));

  const destination = first(sp.destination);
  const q = first(sp.q);
  const cuisine = first(sp.cuisine);
  const price = num(sp.price);
  const dietary = all(sp.dietary);
  const sort = first(sp.sort);

  const items = sortPlaces(
    restaurants.filter((r) => {
      const d = r.details as RestaurantInfo;
      if (destination && r.destinationSlug !== destination) return false;
      if (cuisine && !d.cuisine.includes(cuisine)) return false;
      if (price != null && (r.priceLevel ?? 1) !== price) return false;
      if (dietary.some((x) => !d.dietary.includes(x))) return false;
      return matchesText(r, q, locale);
    }),
    sort,
  );

  const usedDest = [...new Set(restaurants.map((r) => r.destinationSlug).filter((s): s is string => !!s))];
  const usedCuisines = CUISINES.filter((c) => restaurants.some((r) => (r.details as RestaurantInfo).cuisine.includes(c)));
  const usedDietary = DIETARY.filter((x) => restaurants.some((r) => (r.details as RestaurantInfo).dietary.includes(x)));
  const fields: FilterField[] = [
    { kind: "search", name: "q", label: tc("search"), placeholder: t("searchPlaceholder") },
    {
      kind: "select",
      name: "destination",
      label: tc("destination"),
      any: tc("anyDestination"),
      options: usedDest.map((s) => ({ value: s, label: destName.get(s) ?? s })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    },
    { kind: "select", name: "cuisine", label: t("cuisineFilter"), any: t("anyCuisine"), options: usedCuisines.map((c) => ({ value: c, label: tc(`cuisines.${c}`) })) },
    {
      kind: "chips",
      name: "price",
      label: t("priceFilter"),
      any: tc("any"),
      options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${priceLevelSymbol(n)} · ${tc(`priceLevels.${n}` as never)}` })),
    },
    { kind: "checks", name: "dietary", label: t("dietaryFilter"), options: usedDietary.map((x) => ({ value: x, label: tc(`dietary.${x}`) })) },
  ];

  const trust = [
    { icon: UtensilsCrossed, text: t("trust1") },
    { icon: Salad, text: t("trust2") },
    { icon: ShieldCheck, text: t("trust3") },
  ];

  return (
    <>
      <PhotoHero
        locale={locale}
        image="/images/experiences/plov-cooking-class-tashkent.jpg"
        crumbLabel={tn("breadcrumb")}
        crumbs={[
          { name: tn("home"), href: "/" },
          { name: t("title"), href: "/restaurants" },
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
                <Link href="/restaurants" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                  {t("showAll")}
                </Link>
              }
            >
              {tc("emptyText")}
            </EmptyState>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="restaurant-list">
              {items.map((r) => (
                <li key={r.slug}>
                  <PlaceCard
                    place={r}
                    locale={locale}
                    headingLevel="h2"
                    destinationName={r.destinationSlug ? destName.get(r.destinationSlug) : undefined}
                    price={r.priceFromUsd != null ? formatUsdIn(r.priceFromUsd, currency, rates, locale) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-sm text-ink-muted">{t("priceNote")}</p>
        </PlaceFilters>

        <section className="bg-girih-dark on-dark mt-14 overflow-hidden rounded-[1.75rem] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10" aria-labelledby="restaurants-cta">
          <div className="max-w-2xl">
            <h2 id="restaurants-cta" className="text-3xl text-white">
              {t("ctaTitle")}
            </h2>
            <p className="mt-3 text-lg text-white/80">{t("ctaText")}</p>
          </div>
          <Link href="/experiences" className="mt-6 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft lg:mt-0">
            {t("ctaButton")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
