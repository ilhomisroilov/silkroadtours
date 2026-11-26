import { ArrowRight, Compass } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/common/page-hero";
import { ServiceCards } from "@/components/services/service-cards";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return pageMetadata({ locale, href: "/services", title: t("metaTitle"), description: t("intro") });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("services.title"), href: "/services" },
        ]}
        eyebrow={t("nt.servicesPage.eyebrow")}
        title={t("services.title")}
        lead={t("nt.servicesPage.lead")}
      />
      <div className="container-page py-12">
        <ServiceCards locale={locale} />
        <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.5rem] bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-sky"><Compass aria-hidden="true" className="size-6 text-cobalt" /></span>
            <div>
              <h2 className="text-xl text-lapis">{t("nt.builder.title")}</h2>
              <p className="text-ink-muted">{t("nt.builder.text")}</p>
            </div>
          </div>
          <Link href="/custom-tour" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
            {t("nt.builder.cta")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
