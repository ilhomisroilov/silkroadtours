import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientMessages } from "@/components/common/client-messages";
import { Markdown } from "@/components/common/markdown";
import { PageHero } from "@/components/common/page-hero";
import { SERVICE_ICONS, SERVICE_SLUGS, ServiceCards, type ServiceSlug } from "@/components/services/service-cards";
import { ServiceRequestForm, type ServiceKind } from "@/components/services/service-request-form";
import { getPublishedContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; service: string }> };
const isFormPage = (s: string): s is ServiceSlug => (SERVICE_SLUGS as readonly string[]).includes(s);
const FORM_FOR_TYPE: Record<string, ServiceKind> = {
  airport_transfer: "airport-transfer",
  accommodation: "accommodation",
  guide: "guides",
  custom_tour: "tailor-made",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, service } = await params;
  if (isFormPage(service)) {
    const t = await getTranslations({ locale, namespace: "services" });
    return pageMetadata({ locale, href: `/services/${service}`, title: t(`${service}.title`), description: t(`${service}.metaDescription`) });
  }
  const s = await getPublishedContent(db(), "service", service);
  if (!s) return {};
  return pageMetadata({ locale, href: `/services/${service}`, title: localize(s.title, locale), description: localize(s.excerpt, locale) });
}

export default async function ServicePage({ params }: Props) {
  const { locale, service } = await params;
  setRequestLocale(locale);
  const item = isFormPage(service) ? null : await getPublishedContent(db(), "service", service);
  if (!isFormPage(service) && !item) notFound();
  const t = await getTranslations({ locale });
  const destinations = (await listPublishedDestinations(db())).map((d) => ({ slug: d.slug, name: localize(d.name, locale) }));

  const title = item ? localize(item.title, locale) : t(`services.${service as ServiceSlug}.title`);
  const lead = item ? localize(item.excerpt, locale) : t(`services.${service as ServiceSlug}.short`);
  const kind: ServiceKind = item ? (FORM_FOR_TYPE[item.requestType ?? ""] ?? "inquiry") : (service as ServiceSlug);
  const Icon = (item?.icon && SERVICE_ICONS[item.icon]) || Sparkles;
  const form = (
    <ClientMessages namespaces={["services", "booking", "errors", "forms", "common"]}>
      <ServiceRequestForm
        kind={kind}
        destinations={destinations}
        inquiry={kind === "inquiry" && item ? { topic: "service", subject: title, refSlug: item.slug } : undefined}
        compact={!!item}
      />
    </ClientMessages>
  );

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("services.title"), href: "/services" },
          { name: title, href: `/services/${service}` },
        ]}
        eyebrow={t("nt.servicesPage.eyebrow")}
        title={title}
        lead={lead}
      >
        <span aria-hidden="true" className="absolute right-8 top-16 hidden size-24 items-center justify-center rounded-[2rem] bg-white/70 text-cobalt shadow-card lg:inline-flex">
          <Icon className="size-11" />
        </span>
      </PageHero>
      {item ? (
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <article>
            <Markdown source={localize(item.body, locale)} locale={locale} />
          </article>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div id="request" className="rounded-[1.5rem] bg-white p-6 shadow-card">
              <p className="mb-4 text-sm text-ink-muted">{t("nt.servicesPage.requestText")}</p>
              {form}
            </div>
          </aside>
        </div>
      ) : (
        <div className="container-page py-10">
          <div className="max-w-3xl rounded-[1.5rem] bg-white p-6 shadow-card sm:p-8">{form}</div>
        </div>
      )}
      <section className="container-page pb-16" aria-labelledby="more-services">
        <h2 id="more-services" className="mb-6 text-2xl text-lapis">{t("nt.servicesPage.more")}</h2>
        <ServiceCards locale={locale} exclude={service} limit={4} />
      </section>
    </>
  );
}
