import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/common/page-hero";
import { ExperienceCard } from "@/components/content/experience-card";
import { EmptyState } from "@/components/ui/misc";
import { listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/experiences", title: t("nt.expPage.title"), description: t("nt.expPage.lead") });
}

export default async function ExperiencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; place?: string }>;
}) {
  const { locale } = await params;
  const { category, place } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [all, destinations, currency, rates] = await Promise.all([
    listContent(db(), "experience"),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const placeName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const categories = [...new Set(all.map((e) => e.category).filter((c): c is string => !!c))];
  const items = all.filter((e) => (!category || e.category === category) && (!place || e.destinationSlug === place));
  const chip = "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition";
  const catLabel = (c: string) => (t.has(`nt.expPage.cat.${c}` as never) ? t(`nt.expPage.cat.${c}` as never) : c);
  const query = (c?: string) => ({ pathname: "/experiences" as const, query: { ...(c ? { category: c } : {}), ...(place ? { place } : {}) } });

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.expPage.title"), href: "/experiences" },
        ]}
        eyebrow={t("nt.exp.eyebrow")}
        title={t("nt.expPage.title")}
        lead={t("nt.expPage.lead")}
      >
        <nav aria-label={t("nt.expPage.filter")} className="mt-8 flex flex-wrap gap-2">
          <Link href={query()} aria-current={!category ? "page" : undefined} className={`${chip} ${!category ? "bg-lapis text-white" : "bg-white text-ink hover:bg-sky"}`}>
            {t("nt.expPage.all")}
          </Link>
          {categories.map((c) => (
            <Link key={c} href={query(c)} aria-current={category === c ? "page" : undefined} className={`${chip} ${category === c ? "bg-lapis text-white" : "bg-white text-ink hover:bg-sky"}`}>
              {catLabel(c)}
            </Link>
          ))}
        </nav>
        {place && placeName.has(place) && (
          <p className="mt-4 text-sm text-ink-muted">
            {t("nt.expPage.inPlace", { place: placeName.get(place)! })}{" "}
            <Link href={{ pathname: "/experiences", query: category ? { category } : {} }} className="font-semibold text-cobalt underline">
              {t("nt.expPage.anyPlace")}
            </Link>
          </p>
        )}
      </PageHero>
      <div className="container-page py-12">
        {items.length === 0 ? (
          <EmptyState
            title={t("nt.expPage.emptyTitle")}
            action={
              <Link href="/experiences" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                {t("nt.expPage.all")}
              </Link>
            }
          >
            {t("nt.expPage.empty")}
          </EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((e) => (
              <li key={e.slug}>
                <ExperienceCard
                  item={e}
                  locale={locale}
                  headingLevel="h2"
                  place={e.destinationSlug ? placeName.get(e.destinationSlug) : undefined}
                  hours={e.durationHours != null ? t("nt.exp.hours", { count: e.durationHours }) : undefined}
                  price={e.priceFromUsd != null ? t("nt.exp.from", { price: formatUsdIn(e.priceFromUsd, currency, rates, locale) }) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-sm text-ink-muted">{t("nt.expPage.priceNote")}</p>
      </div>
    </>
  );
}
