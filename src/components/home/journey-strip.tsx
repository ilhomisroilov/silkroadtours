import { CalendarCheck, Compass, Map, Orbit, Route, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";

const STEPS = [
  { key: "discover", href: "/destinations", icon: Compass },
  { key: "explore", href: "/virtual-tours", icon: Orbit },
  { key: "plan", href: "/trip-builder", icon: Route },
  { key: "book", href: "/hotels", icon: CalendarCheck },
  { key: "navigate", href: "/navigator", icon: Map },
  { key: "experience", href: "/ai-guide", icon: Sparkles },
] as const;

/** DISCOVER → EXPLORE → PLAN → BOOK → NAVIGATE → EXPERIENCE, each step linking to the module that does it. */
export async function JourneyStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "eco.home.journey" });
  return (
    <section className="container-page pt-20" aria-labelledby="journey-title">
      <div className="relative overflow-hidden rounded-[2rem] bg-lapis-night px-5 py-10 text-white sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-saffron/20" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full border border-saffron/15" />
        <p className="eyebrow text-saffron">{t("eyebrow")}</p>
        <h2 id="journey-title" className="mt-3 max-w-2xl text-[clamp(1.8rem,1.2rem+2vw,2.6rem)] leading-tight text-white">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-2xl text-white/75">{t("lead")}</p>
        <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-0">
          {STEPS.map(({ key, href, icon: Icon }, i) => (
            <li key={key} className="relative lg:px-3 lg:first:pl-0 lg:last:pr-0">
              {i > 0 && <span aria-hidden="true" className="absolute left-0 top-6 hidden h-px w-3 bg-saffron/40 lg:block" />}
              <Link
                href={href}
                className="group flex h-full gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-saffron/50 hover:bg-white/[0.08] lg:flex-col lg:gap-3"
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-saffron/15 text-saffron">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white/75">0{i + 1}</span>
                  <span className="mt-0.5 block font-display text-lg text-white group-hover:text-saffron">{t(`steps.${key}.title`)}</span>
                  <span className="mt-1 block text-sm leading-snug text-white/70">{t(`steps.${key}.text`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
