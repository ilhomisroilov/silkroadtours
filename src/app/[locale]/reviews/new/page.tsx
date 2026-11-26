import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { SectionHeading } from "@/components/common/section";
import { ReviewForm } from "@/components/services/review-form";
import type { Locale } from "@/db/types";
import { pageMetadata } from "@/lib/server/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reviewForm" });
  return pageMetadata({ locale, href: "/reviews/new", title: t("metaTitle"), description: t("intro"), noIndex: true });
}

export default async function NewReviewPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ ref?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "reviewForm" });
  const { ref } = await searchParams;
  return (
    <div className="container-page max-w-3xl py-12">
      <SectionHeading as="h1" title={t("title")} text={t("intro")} />
      <div className="mt-10">
        <ClientMessages namespaces={["reviewForm", "booking", "errors", "forms"]}>
          <ReviewForm initialReference={ref?.slice(0, 20)} />
        </ClientMessages>
      </div>
    </div>
  );
}
