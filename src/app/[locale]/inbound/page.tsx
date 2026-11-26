import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { GirihPattern, IkatDivider, SuzaniMedallion } from "@/components/ornament";
import { ServiceCards } from "@/components/services/service-cards";
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
  return pageMetadata({ locale, href: "/inbound", title: t("inboundMetaTitle"), description: t("inboundText") });
}

export default async function InboundHub({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const tours = await listPublishedTours(db(), { audience: "inbound", sort: "featured", currency, page: 1, pageSize: 48 }, await exchangeRates());
  return (
    <>
      <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
        <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.3} />
        <div className="container-page relative flex flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-saffron">{t("hubs.inboundEyebrow")}</p>
            <h1 className="mt-3 text-5xl text-ivory" lang="en">{t("hubs.inboundTitle")}</h1>
            <p className="mt-5 text-lg text-sand">{t("hubs.inboundText")}</p>
            <Link href={{ pathname: "/tours", query: { audience: "inbound" } }} className={buttonVariants({ variant: "saffron", size: "lg", className: "mt-8" })}>
              {t("tours.results", { count: tours.total })} →
            </Link>
          </div>
          <SuzaniMedallion size={200} palette="night" className="hidden md:block" />
        </div>
        <IkatDivider height={12} />
      </section>
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
      <section className="bg-sand-soft py-16" aria-labelledby="inbound-services">
        <div className="container-page">
          <SectionHeading id="inbound-services" title={t("hubs.inboundServicesTitle")} text={t("services.intro")} />
          <div className="mt-10">
            <ServiceCards locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
