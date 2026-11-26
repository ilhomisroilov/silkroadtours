import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { PhotoHero } from "@/components/common/photo-hero";
import { TourCard } from "@/components/tours/tour-card";
import { buttonVariants } from "@/components/ui/button";
import { listPublishedDestinations } from "@/db/queries/destinations";
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
  const [all, destinations] = await Promise.all([
    listPublishedTours(db(), { audience: "domestic", sort: "price_asc", currency, page: 1, pageSize: 48 }, await exchangeRates()),
    listPublishedDestinations(db()),
  ]);
  const image = destinations.find((d) => d.slug === "chimgan-charvak")?.heroImage ?? destinations[0]?.heroImage ?? "";
  const shortBreaks = all.items.filter((x) => x.category === "weekend" || x.category === "family" || x.badges.includes("weekend_trip") || x.badges.includes("family_friendly"));
  const others = all.items.filter((x) => !shortBreaks.includes(x));
  return (
    <>
      <PhotoHero
        locale={locale}
        image={image}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("hubs.domesticTitle"), href: "/domestic" },
        ]}
        eyebrow={t("hubs.domesticEyebrow")}
        title={t("hubs.domesticTitle")}
        lead={t("hubs.domesticText")}
      >
        <Link href={{ pathname: "/tours", query: { audience: "domestic" } }} className={buttonVariants({ variant: "saffron", size: "lg", className: "mt-7" })}>
          {t("tours.results", { count: all.total })} →
        </Link>
      </PhotoHero>
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
        <div className="relative overflow-hidden rounded-[2rem] bg-lapis p-8 text-white sm:p-12">
          <div className="relative max-w-2xl">
            <h2 id="corporate" className="text-3xl text-white">{t("hubs.domesticCorporateTitle")}</h2>
            <p className="mt-3 text-lg text-white/80">{t("hubs.domesticCorporateText")}</p>
            <Link href="/custom-tour" className={buttonVariants({ variant: "saffron", className: "mt-6" })}>
              {t("hubs.domesticCorporateCta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
