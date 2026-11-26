import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PlannerClient } from "@/components/ai/planner-client";
import { PLANNER_STRINGS } from "@/components/ai/planner-strings";
import { RobotIllustration } from "@/components/ai/robot";
import { ClientMessages } from "@/components/common/client-messages";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { db, pageMetadata } from "@/lib/server/site";

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
  const places = (await listPublishedDestinations(db())).map((d) => ({ slug: d.slug, names: [d.name.en, d.name.uz, d.name.ru, d.slug.replace(/-/g, " ")] }));
  return (
    <>
      <section className="bg-ai-soft relative overflow-hidden">
        <div className="container-page relative grid items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_16rem] lg:py-14">
          <div className="animate-fade-up max-w-3xl">
            <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-cobalt">
              {t.eyebrow}
              <span aria-hidden="true" className="h-px w-10 bg-cobalt/40" />
            </p>
            <h1 className="mt-3 text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] leading-[1.08] text-lapis">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-ink/75">{t.intro}</p>
          </div>
          <RobotIllustration className="mx-auto hidden w-48 drop-shadow-[0_18px_24px_rgba(36,91,168,0.25)] motion-safe:animate-[float_5s_ease-in-out_infinite] lg:block" />
        </div>
      </section>
      <div className="container-page py-12 lg:py-14">
        <ClientMessages namespaces={["services", "booking", "errors", "forms"]}>
          <PlannerClient locale={locale} initialId={initialId} places={places} />
        </ClientMessages>
      </div>
    </>
  );
}
