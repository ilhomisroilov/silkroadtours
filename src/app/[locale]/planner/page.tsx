import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PlannerClient } from "@/components/ai/planner-client";
import { PLANNER_STRINGS } from "@/components/ai/planner-strings";
import type { Locale } from "@/db/types";
import { pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = PLANNER_STRINGS[locale] ?? PLANNER_STRINGS.en;
  return pageMetadata({ locale, href: "/planner", title: t.eyebrow, description: t.intro });
}

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { locale } = await params;
  const { plan } = await searchParams;
  setRequestLocale(locale);
  const t = PLANNER_STRINGS[locale] ?? PLANNER_STRINGS.en;
  const initialId = plan && /^p_[a-z0-9]{16}$/.test(plan) ? plan : undefined;
  return (
    <>
      <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
        <div className="bg-girih-dark absolute inset-0 opacity-40" aria-hidden />
        <div className="container-page relative py-10 lg:py-14">
          <p className="eyebrow text-saffron">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl text-ivory">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-sand">{t.intro}</p>
          <div className="route-line mt-8 max-w-xl" aria-hidden />
        </div>
      </section>
      <div className="container-page py-12 lg:py-16">
        <PlannerClient locale={locale} initialId={initialId} />
      </div>
    </>
  );
}
