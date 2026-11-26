import { ClipboardList, KeyRound, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { PartnerApplyForm } from "@/components/partners/apply-form";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale, PartnerType } from "@/db/types";
import { localize } from "@/lib/localize";
import { PARTNER_TYPE_LIST } from "@/lib/partners";
import { db, pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnersPage" });
  return pageMetadata({ locale, href: "/partners/apply", title: t("apply.metaTitle"), description: t("apply.lead") });
}

export default async function PartnerApplyPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ type?: string }> }) {
  const { locale } = await params;
  const { type } = await searchParams;
  setRequestLocale(locale);
  const [t, tr, destinations] = await Promise.all([
    getTranslations({ locale, namespace: "partnersPage" }),
    getTranslations({ locale }),
    listPublishedDestinations(db()),
  ]);
  // Partners are businesses in Uzbekistan; destinations abroad (with a country) are left out.
  const local = destinations.filter((d) => !d.country).map((d) => ({ slug: d.slug, name: localize(d.name, locale) }));
  const initialType = (PARTNER_TYPE_LIST as readonly string[]).includes(type ?? "") ? (type as PartnerType) : undefined;
  const steps = [
    { icon: KeyRound, text: t("apply.side1") },
    { icon: ClipboardList, text: t("apply.side2") },
    { icon: Rocket, text: t("apply.side3") },
  ];

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={tr("nav.breadcrumb")}
        crumbs={[
          { name: tr("nav.home"), href: "/" },
          { name: t("crumb"), href: "/partners" },
          { name: t("apply.metaTitle"), href: "/partners/apply" },
        ]}
        eyebrow={t("eyebrow")}
        title={t("apply.title")}
        lead={t("apply.lead")}
      />
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 rounded-[1.5rem] bg-white p-5 shadow-card sm:p-8">
          <ClientMessages namespaces={["partnersPage", "booking", "errors", "forms"]}>
            <PartnerApplyForm destinations={local} initialType={initialType} />
          </ClientMessages>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.5rem] border border-line bg-sand-soft/70 p-6">
            <h2 className="text-xl text-lapis">{t("apply.sideTitle")}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-lapis-mist">
                    <Icon aria-hidden="true" className="size-4 text-cobalt" />
                  </span>
                  <span className="text-sm text-ink/85">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
