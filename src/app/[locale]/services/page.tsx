import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { SectionHeading } from "@/components/common/section";
import { ServiceCards } from "@/components/services/service-cards";
import type { Locale } from "@/db/types";
import { pageMetadata, siteUrl } from "@/lib/server/site";

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
    <div className="container-page py-10">
      <Breadcrumbs
        label={t("nav.breadcrumb")}
        base={`${siteUrl()}/${locale}`}
        items={[
          { name: t("nav.home"), href: "/" },
          { name: t("services.title"), href: "/services" },
        ]}
      />
      <div className="mt-6 mb-12">
        <SectionHeading as="h1" title={t("services.title")} text={t("services.intro")} />
      </div>
      <ServiceCards locale={locale} />
    </div>
  );
}
