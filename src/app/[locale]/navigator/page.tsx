import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { Navigator } from "@/components/trip/navigator";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "navigator" });
  return pageMetadata({ locale, href: "/navigator", title: t("title"), description: t("lead") });
}

export default async function NavigatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ destination?: string; focus?: string }>;
}) {
  const { locale } = await params;
  const { destination, focus } = await searchParams;
  setRequestLocale(locale);
  const [destinations, currency, rates] = await Promise.all([listPublishedDestinations(db()), requestCurrency(locale), exchangeRates()]);
  const known = destination && destinations.some((d) => d.slug === destination) ? destination : null;
  const focusKey = focus && /^[a-z]{3,12}:[a-z0-9][a-z0-9-]{0,119}$/.test(focus) ? focus : null;
  return (
    <ClientMessages namespaces={["navigator", "tripBuilder", "tripButton"]}>
      <Navigator
        destinations={destinations.map((d) => ({ slug: d.slug, name: localize(d.name, locale), lat: d.lat, lng: d.lng, abroad: !!d.country }))}
        currency={currency}
        rates={rates}
        initialDestination={known}
        initialFocus={focusKey}
      />
    </ClientMessages>
  );
}
