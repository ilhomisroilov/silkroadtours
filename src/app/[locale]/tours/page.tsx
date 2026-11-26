import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { Pagination } from "@/components/common/pagination";
import { SectionHeading } from "@/components/common/section";
import { FiltersShell } from "@/components/tours/filters-shell";
import { TourCard } from "@/components/tours/tour-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPublishedTours } from "@/db/queries/tours";
import { TOUR_CATEGORIES, type Locale } from "@/db/types";
import { getPathname, Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";
import { filterValuesFrom, parseTourSearchParams } from "@/lib/tour-query";
import { TOUR_SORTS } from "@/validators/public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "tours" });
  // Filtered variants point their canonical at the clean listing and are not indexed separately.
  const filtered = Object.keys(sp).length > 0;
  return pageMetadata({ locale, href: "/tours", title: t("metaTitle"), description: t("intro"), noIndex: filtered });
}

const SORT_LABEL: Record<(typeof TOUR_SORTS)[number], string> = {
  featured: "sortFeatured",
  price_asc: "sortPriceAsc",
  price_desc: "sortPriceDesc",
  duration_asc: "sortDurationAsc",
  duration_desc: "sortDurationDesc",
  rating: "sortRating",
};

export default async function ToursPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const query = parseTourSearchParams(await searchParams, currency);
  const rates = await exchangeRates();
  const [result, destinations] = await Promise.all([listPublishedTours(db(), query, rates), listPublishedDestinations(db())]);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const values = filterValuesFrom(query);

  return (
    <div className="container-page py-10">
      <Breadcrumbs
        label={t("nav.breadcrumb")}
        base={`${siteUrl()}/${locale}`}
        items={[
          { name: t("nav.home"), href: "/" },
          { name: t("tours.title"), href: "/tours" },
        ]}
      />
      <div className="mb-10 mt-6">
        <SectionHeading as="h1" title={t("tours.title")} text={t("tours.intro")} />
      </div>
      <ClientMessages namespaces={["tours"]}>
        <FiltersShell
          action={getPathname({ locale, href: "/tours" })}
          values={values}
          resultsLabel={t("tours.results", { count: result.total })}
          options={{
            audiences: [
              { value: "inbound", label: t("audience.inbound") },
              { value: "domestic", label: t("audience.domestic") },
            ],
            destinations: destinations.map((d) => ({ value: d.slug, label: localize(d.name, locale) })),
            categories: TOUR_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
            months: Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`months.${i + 1}` as never) })),
            durations: [2, 4, 7, 10].map((d) => ({ value: String(d), label: t("tours.durationUpTo", { count: d }) })),
            sorts: TOUR_SORTS.map((s) => ({ value: s, label: t(`tours.${SORT_LABEL[s]}` as never) })),
          }}
        >
          {result.items.length === 0 ? (
            <EmptyState
              title={t("tours.emptyTitle")}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/tours" className={buttonVariants({ variant: "outline" })}>{t("tours.resetFilters")}</Link>
                  <Link href="/services/tailor-made" className={buttonVariants({ variant: "primary" })}>{t("tours.emptyCta")}</Link>
                </div>
              }
            >
              {t("tours.emptyText")}
            </EmptyState>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="tour-results">
              {result.items.map((tour, i) => (
                <li key={tour.id}>
                  <TourCard tour={tour} locale={locale} priority={i < 2} />
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={result.page}
            pageCount={pageCount}
            pathname="/tours"
            query={{ ...values }}
            labels={{
              nav: t("tours.pagination"),
              previous: t("tours.previous"),
              next: t("tours.next"),
              page: (n) => t("tours.page", { page: n }),
            }}
          />
        </FiltersShell>
      </ClientMessages>
    </div>
  );
}
