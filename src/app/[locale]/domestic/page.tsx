import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { GirihPattern, IkatDivider, SuzaniMedallion } from "@/components/ornament";
import { TourCard } from "@/components/tours/tour-card";
import { buttonVariants } from "@/components/ui/button";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hubs" });
  return pageMetadata({ locale, href: "/domestic", title: t("domesticMetaTitle"), description: t("domesticText") });
}

/** Domestic hub: prices in so'm unless the visitor chose another currency; weekend and family trips first. */
export default async function DomesticHub({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale, "domestic");
  const all = await listPublishedTours(db(), { audience: "domestic", sort: "price_asc", currency, page: 1, pageSize: 48 }, await exchangeRates());
  const shortBreaks = all.items.filter((x) => x.category === "weekend" || x.category === "family" || x.badges.includes("weekend_trip") || x.badges.includes("family_friendly"));
  const others = all.items.filter((x) => !shortBreaks.includes(x));
  return (
    <>
      <section className="relative overflow-hidden bg-sand">
        <GirihPattern className="absolute inset-0" tone="pomegranate" opacity={0.14} />
        <div className="container-page relative flex flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pomegranate" lang="uz">{t("hubs.domesticEyebrow")}</p>
            <h1 className="mt-3 text-5xl text-lapis-deep">{t("hubs.domesticTitle")}</h1>
            <p className="mt-5 text-lg text-ink">{t("hubs.domesticText")}</p>
            <Link href={{ pathname: "/tours", query: { audience: "domestic" } }} className={buttonVariants({ size: "lg", className: "mt-8" })}>
              {t("tours.results", { count: all.total })} →
            </Link>
          </div>
          <SuzaniMedallion size={200} className="hidden md:block" />
        </div>
        <IkatDivider height={12} />
      </section>
      {shortBreaks.length > 0 && (
        <section className="container-page py-16" aria-labelledby="short-breaks">
          <SectionHeading id="short-breaks" title={t("hubs.domesticWeekendTitle")} />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shortBreaks.map((tour, i) => (
              <li key={tour.id}>
                <TourCard tour={tour} locale={locale} priority={i < 2} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <section className="container-page pb-16" aria-labelledby="all-domestic">
          <SectionHeading id="all-domestic" title={t("hubs.domesticAllTitle")} />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((tour) => (
              <li key={tour.id}>
                <TourCard tour={tour} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="container-page" aria-labelledby="corporate">
        <div className="on-dark relative overflow-hidden rounded-[var(--radius-card)] bg-lapis-deep p-8 text-ivory sm:p-12">
          <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.25} />
          <div className="relative max-w-2xl">
            <h2 id="corporate" className="text-3xl text-ivory">{t("hubs.domesticCorporateTitle")}</h2>
            <p className="mt-3 text-lg text-sand">{t("hubs.domesticCorporateText")}</p>
            <Link href="/services/tailor-made" className={buttonVariants({ variant: "saffron", className: "mt-6" })}>
              {t("hubs.domesticCorporateCta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
