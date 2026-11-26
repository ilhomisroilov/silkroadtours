import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TourBuilder } from "@/components/builder/tour-builder";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { builderDailyRates } from "@/db/queries/builder";
import { listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/custom-tour", title: t("nt.builderPage.title"), description: t("nt.builderPage.lead") });
}

export default async function CustomTourPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const rates = await exchangeRates();
  const [destinations, daily, experiences, currency] = await Promise.all([
    listPublishedDestinations(db()),
    builderDailyRates(db(), rates),
    listContent(db(), "experience"),
    requestCurrency(locale),
  ]);
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.builderPage.title"), href: "/custom-tour" },
        ]}
        eyebrow={t("nt.builderPage.eyebrow")}
        title={t("nt.builderPage.title")}
        lead={t("nt.builderPage.lead")}
      />
      <div className="container-page py-10">
        <ClientMessages namespaces={["nt", "services", "booking", "errors", "forms"]}>
          <TourBuilder
            places={destinations.map((d) => ({
              slug: d.slug,
              name: localize(d.name, locale),
              country: d.country ? localize(d.country, locale) : null,
              image: d.heroImage,
              rates: daily.bySlug[d.slug] ?? null,
            }))}
            overall={daily.overall}
            experiences={experiences
              .filter((e) => e.destinationSlug && e.priceFromUsd != null)
              .map((e) => ({ slug: e.slug, title: localize(e.title, locale), place: e.destinationSlug!, priceUsd: e.priceFromUsd! }))}
            currency={currency}
            rates={rates}
          />
        </ClientMessages>
      </div>
    </>
  );
}
