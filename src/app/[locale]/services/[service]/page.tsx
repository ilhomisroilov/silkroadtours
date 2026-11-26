import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { GirihPattern, IkatDivider } from "@/components/ornament";
import { SERVICE_SLUGS, ServiceCards, type ServiceSlug } from "@/components/services/service-cards";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, pageMetadata, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; service: string }> };
const isService = (s: string): s is ServiceSlug => (SERVICE_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, service } = await params;
  if (!isService(service)) return {};
  const t = await getTranslations({ locale, namespace: "services" });
  return pageMetadata({ locale, href: `/services/${service}`, title: t(`${service}.title`), description: t(`${service}.metaDescription`) });
}

export default async function ServicePage({ params }: Props) {
  const { locale, service } = await params;
  if (!isService(service)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const destinations = await listPublishedDestinations(db());
  return (
    <>
      <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
        <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.28} />
        <div className="container-page relative py-10 md:py-14">
          <Breadcrumbs
            tone="dark"
            label={t("nav.breadcrumb")}
            base={`${siteUrl()}/${locale}`}
            items={[
              { name: t("nav.home"), href: "/" },
              { name: t("services.title"), href: "/services" },
              { name: t(`services.${service}.title`), href: `/services/${service}` },
            ]}
          />
          <h1 className="mt-5 text-5xl text-ivory">{t(`services.${service}.title`)}</h1>
          <p className="mt-4 max-w-2xl text-lg text-sand">{t(`services.${service}.short`)}</p>
        </div>
        <IkatDivider height={12} />
      </section>
      <div className="container-page py-12">
        <div className="max-w-3xl">
          <ClientMessages namespaces={["services", "booking", "errors", "forms"]}>
            <ServiceRequestForm kind={service} destinations={destinations.map((d) => ({ slug: d.slug, name: localize(d.name, locale) }))} />
          </ClientMessages>
        </div>
        <div className="mt-20">
          <h2 className="mb-6 text-3xl text-lapis-deep">{t("hubs.inboundServicesTitle")}</h2>
          <ServiceCards locale={locale} exclude={service} />
        </div>
      </div>
    </>
  );
}
