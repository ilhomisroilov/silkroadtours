import { CalendarRange, Compass, Languages, ShieldCheck, Wallet, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AssistantLaunchpad } from "@/components/ai/assistant-launchpad";
import { RobotIllustration } from "@/components/ai/robot";
import { PageHero } from "@/components/common/page-hero";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/server/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/assistant", title: t("nt.assistantPage.title"), description: t("nt.assistantPage.lead") });
}

export default async function AssistantPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const can = [
    { icon: Compass, key: "tours" },
    { icon: CalendarRange, key: "plan" },
    { icon: Wallet, key: "budget" },
    { icon: Languages, key: "languages" },
  ] as const;
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.assistantPage.title"), href: "/assistant" },
        ]}
        eyebrow={t("nt.ai.eyebrow")}
        title={t("nt.assistantPage.title")}
        lead={t("nt.assistantPage.lead")}
      >
        <div className="mt-8 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <AssistantLaunchpad start={t("nt.assistantPage.start")} examples={[0, 1, 2, 3].map((i) => t(`nt.assistantPage.examples.${i}` as never))} />
          <RobotIllustration className="mx-auto hidden w-44 drop-shadow-[0_18px_24px_rgba(36,91,168,0.25)] motion-safe:animate-[float_5s_ease-in-out_infinite] lg:block" />
        </div>
      </PageHero>
      <div className="container-page py-12">
        <h2 className="text-2xl text-lapis">{t("nt.assistantPage.canTitle")}</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {can.map((c) => (
            <li key={c.key} className="rounded-[1.25rem] bg-white p-6 shadow-card">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-sky text-cobalt"><c.icon aria-hidden="true" className="size-6" /></span>
              <h3 className="mt-4 text-lg text-lapis">{t(`nt.assistantPage.can.${c.key}.title` as never)}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t(`nt.assistantPage.can.${c.key}.text` as never)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="flex items-start gap-4 rounded-[1.25rem] bg-white p-6 shadow-card">
            <ShieldCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-cobalt" />
            <div>
              <h2 className="text-lg text-lapis">{t("nt.assistantPage.privacyTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("nt.assistantPage.privacyText")}{" "}
                <Link href="/privacy" className="font-semibold text-cobalt underline">{t("nt.legal.privacy.title")}</Link>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-[1.25rem] bg-lapis p-6 text-white shadow-card">
            <Wand2 aria-hidden="true" className="mt-1 size-6 shrink-0 text-saffron" />
            <div>
              <h2 className="text-lg text-white">{t("nt.assistantPage.plannerTitle")}</h2>
              <p className="mt-1 text-sm text-white/80">{t("nt.assistantPage.plannerText")}</p>
              <Link href="/planner" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-saffron px-5 text-sm font-bold text-lapis-deep hover:bg-[#e6b55a]">{t("nav.planner")}</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
