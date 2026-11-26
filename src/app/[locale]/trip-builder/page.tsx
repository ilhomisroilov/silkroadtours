import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { TripBuilder } from "@/components/trip/trip-builder";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";
import { getTripSnapshot } from "@/lib/server/trips";
import { TRIP_ID_RE } from "@/validators/trip";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tripBuilder.page" });
  return pageMetadata({ locale, href: "/trip-builder", title: t("title"), description: t("lead") });
}

export default async function TripBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ destination?: string; trip?: string }>;
}) {
  const { locale } = await params;
  const { destination, trip } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [destinations, currency, rates, snapshot] = await Promise.all([
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
    trip && TRIP_ID_RE.test(trip) ? getTripSnapshot(db(), trip) : Promise.resolve(null),
  ]);
  const prefill = destination && /^[a-z0-9-]{1,80}$/.test(destination) ? destination : null;
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("tripBuilder.page.title"), href: "/trip-builder" },
        ]}
        eyebrow={t("tripBuilder.page.eyebrow")}
        title={t("tripBuilder.page.title")}
        lead={t("tripBuilder.page.lead")}
      />
      <div className="container-page pb-16">
        <ClientMessages namespaces={["tripBuilder", "tripButton", "services", "booking", "errors", "forms"]}>
          <TripBuilder
            destinations={destinations.map((d) => ({ slug: d.slug, name: localize(d.name, locale), lat: d.lat, lng: d.lng, abroad: !!d.country }))}
            currency={currency}
            rates={rates}
            prefill={prefill}
            shared={snapshot ? { id: snapshot.id, trip: snapshot.trip, includeMeals: snapshot.includeMeals } : null}
            sharedMissing={!!trip && !snapshot}
          />
        </ClientMessages>
      </div>
    </>
  );
}
