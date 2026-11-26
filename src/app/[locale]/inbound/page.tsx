import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { PhotoHero } from "@/components/common/photo-hero";
import { ServiceCards } from "@/components/services/service-cards";
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
  return pageMetadata({ locale, href: "/inbound", title: t("inboundMetaTitle"), description: t("inboundText") });
}

export default async function InboundHub({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const [tours, destinations] = await Promise.all([
    listPublishedTours(db(), { audience: "inbound", sort: "featured", currency, page: 1, pageSize: 48 }, await exchangeRates()),
    listPublishedDestinations(db()),
  ]);
  const image = destinations.find((d) => d.slug === "khiva")?.heroImage ?? destinations[0]?.heroImage ?? "";
  return (
    <>
      <PhotoHero
        locale={locale}
        image={image}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("hubs.inboundTitle"), href: "/inbound" },
        ]}
        eyebrow={t("hubs.inboundEyebrow")}
        title={t("hubs.inboundTitle")}
        lead={t("hubs.inboundText")}
      >
        <Link href={{ pathname: "/tours", query: { audience: "inbound" } }} className={buttonVariants({ variant: "saffron", size: "lg", className: "mt-7" })}>
          {t("tours.results", { count: tours.total })} →
        </Link>
      </PhotoHero>
      <section className="container-page py-16" aria-labelledby="inbound-tours">
        <SectionHeading id="inbound-tours" title={t("hubs.inboundToursTitle")} />
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.items.map((tour, i) => (
            <li key={tour.id}>
              <TourCard tour={tour} locale={locale} priority={i < 2} />
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-sky/50 py-16" aria-labelledby="inbound-services">
        <div className="container-page">
          <SectionHeading id="inbound-services" title={t("hubs.inboundServicesTitle")} text={t("services.intro")} />
          <div className="mt-10">
            <ServiceCards locale={locale} limit={8} />
          </div>
        </div>
      </section>
    </>
  );
}
