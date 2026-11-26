import { BedDouble, CalendarRange, Compass, Languages, MapPinned, ShieldCheck, Sparkles, TrainFront, Wallet, Wand2, Landmark, Database } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { GuideChat } from "@/components/ai/guide-chat";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { getDb } from "@/db/client";
import type { Locale } from "@/db/types";
import { getAiSettings } from "@/lib/ai/agent";
import { pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/ai-guide", title: t("aiGuide.meta.title"), description: t("aiGuide.meta.description") });
}

const CAN = [
  { key: "recommend", icon: Sparkles },
  { key: "itinerary", icon: CalendarRange },
  { key: "stay", icon: BedDouble },
  { key: "transport", icon: TrainFront },
  { key: "nearby", icon: MapPinned },
  { key: "culture", icon: Landmark },
  { key: "phrases", icon: Languages },
  { key: "budget", icon: Wallet },
  { key: "modify", icon: Wand2 },
] as const;

export default async function AiGuidePage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const ai = await getAiSettings(getDb()).catch(() => null);
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("aiGuide.meta.title"), href: "/ai-guide" },
        ]}
        eyebrow={t("aiGuide.hero.eyebrow")}
        title={t("aiGuide.hero.title")}
        lead={t("aiGuide.hero.lead")}
      />
      <div className="container-page -mt-4 pb-14">
        <ClientMessages namespaces={["aiGuide"]}>
          <Suspense>
            <GuideChat locale={locale} enabled={ai?.enabled ?? true} initialQuestion={q?.slice(0, 500)} />
          </Suspense>
        </ClientMessages>

        <section className="mt-14" aria-labelledby="guide-can">
          <h2 id="guide-can" className="text-2xl text-lapis sm:text-3xl">{t("aiGuide.can.title")}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAN.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4 rounded-[1.25rem] border border-lapis/10 bg-white p-5 shadow-card">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky text-cobalt">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="text-[1.05rem] text-lapis-deep">{t(`aiGuide.can.items.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{t(`aiGuide.can.items.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-[1.5rem] bg-lapis-deep p-6 text-white sm:p-8" aria-labelledby="guide-trust">
          <h2 id="guide-trust" className="text-2xl text-white">{t("aiGuide.trust.title")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {([
              ["catalogue", Database],
              ["honest", Compass],
              ["private", ShieldCheck],
            ] as const).map(([key, Icon]) => (
              <div key={key} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-saffron" />
                <div>
                  <h3 className="text-base font-bold text-white">{t(`aiGuide.trust.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-white/80">{t(`aiGuide.trust.${key}.text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
