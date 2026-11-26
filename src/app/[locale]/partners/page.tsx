import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Compass,
  HeartHandshake,
  Languages,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Navigation,
  Percent,
  Repeat,
  Route,
  Sparkles,
  Star,
  Ticket,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/common/page-hero";
import { SectionHeading } from "@/components/common/section";
import { PartnerCard } from "@/components/partners/partner-card";
import { PARTNER_TYPE_ICONS } from "@/components/partners/icons";
import { toCardData } from "@/components/partners/view";
import { EmptyState } from "@/components/ui/misc";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listApprovedPartners } from "@/db/queries/partners";
import type { Locale, PartnerType } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { localize } from "@/lib/localize";
import { PARTNER_TYPE_LIST } from "@/lib/partners";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnersPage" });
  return pageMetadata({ locale, href: "/partners", title: t("metaTitle"), description: t("metaDescription") });
}

const ECO = [
  { key: "discover", icon: Sparkles },
  { key: "explore", icon: MapIcon },
  { key: "plan", icon: CalendarRange },
  { key: "book", icon: Ticket },
  { key: "navigate", icon: Navigation },
  { key: "experience", icon: HeartHandshake },
] as const;
const BENEFITS = [
  { key: "b1", icon: UsersRound },
  { key: "b2", icon: Languages },
  { key: "b3", icon: ClipboardCheck },
  { key: "b4", icon: Route },
  { key: "b5", icon: LayoutDashboard },
  { key: "b6", icon: MapPin },
] as const;
const MODELS = [
  { key: "commission", icon: Percent },
  { key: "featured", icon: Star },
  { key: "subscription", icon: Repeat },
  { key: "advertising", icon: Megaphone },
  { key: "insights", icon: BarChart3 },
] as const;

export default async function PartnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ type?: string; city?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [t, tr, all, destinations, currency, rates] = await Promise.all([
    getTranslations({ locale, namespace: "partnersPage" }),
    getTranslations({ locale }),
    listApprovedPartners(db()),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const type = (PARTNER_TYPE_LIST as readonly string[]).includes(sp.type ?? "") ? (sp.type as PartnerType) : undefined;
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const citySlugs = [...new Set(all.map((p) => p.destinationSlug).filter((s): s is string => !!s && destName.has(s)))].sort((a, b) => destName.get(a)!.localeCompare(destName.get(b)!, locale));
  const city = sp.city && citySlugs.includes(sp.city) ? sp.city : undefined;
  const items = all.filter((p) => (!type || p.type === type) && (!city || p.destinationSlug === city));
  const countByType = new Map<PartnerType, number>();
  for (const p of all) countByType.set(p.type, (countByType.get(p.type) ?? 0) + 1);
  const ctx = { currency, rates, locale };

  const chip = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition";
  const chipCls = (on: boolean) => cn(chip, on ? "bg-lapis text-white" : "bg-white text-ink ring-1 ring-line hover:bg-sky");
  const href = (next: { type?: string; city?: string }) => ({
    pathname: "/partners" as const,
    query: Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>,
    hash: "directory",
  });
  const ctaPrimary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-lapis px-6 font-bold text-white shadow-[0_10px_24px_-12px_rgb(23_61_102/0.8)] transition hover:bg-cobalt";
  const ctaSecondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-lapis ring-1 ring-lapis-mist transition hover:bg-sky";

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={tr("nav.breadcrumb")}
        crumbs={[
          { name: tr("nav.home"), href: "/" },
          { name: t("crumb"), href: "/partners" },
        ]}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/partners/apply" className={ctaPrimary} data-testid="partners-apply-cta">
            {t("ctaApply")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={href({})} className={ctaSecondary}>
            {t("ctaDirectory")}
          </Link>
        </div>
        {all.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-lapis">
            <li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-saffron" />{t("stats.partners", { count: all.length })}</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-saffron" />{t("stats.cities", { count: new Set(all.map((p) => p.destinationSlug ?? p.city)).size })}</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-saffron" />{t("stats.types", { count: countByType.size })}</li>
          </ul>
        )}
      </PageHero>

      {/* ── Who can join ───────────────────────────────────── */}
      <section className="container-page pt-16" aria-labelledby="who-title">
        <SectionHeading id="who-title" eyebrow={t("eyebrow")} title={t("whoTitle")} text={t("whoText")} />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {PARTNER_TYPE_LIST.map((ty) => {
            const Icon = PARTNER_TYPE_ICONS[ty];
            const n = countByType.get(ty) ?? 0;
            return (
              <li key={ty} className="min-w-0">
                <Link href={href({ type: ty })} className="group flex h-full flex-col rounded-[1.25rem] bg-white p-4 shadow-card ring-1 ring-line/60 transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-sky ring-1 ring-lapis-mist">
                    <Icon aria-hidden="true" className="size-5 text-cobalt" />
                  </span>
                  <span className="mt-3 text-base font-bold leading-tight text-lapis [overflow-wrap:anywhere] group-hover:text-cobalt sm:mt-4 sm:text-lg">{t(`typeGroups.${ty}`)}</span>
                  <span className="mt-1.5 text-sm text-ink-muted">{t(`typeText.${ty}`)}</span>
                  <span className="mt-auto pt-4 text-xs font-bold uppercase tracking-[0.08em] text-saffron-ink">{t("typeCount", { count: n })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Ecosystem ──────────────────────────────────────── */}
      <section className="container-page pt-20" aria-labelledby="eco-title">
        <div className="bg-girih-dark on-dark relative overflow-hidden rounded-[1.75rem] px-5 py-10 text-white sm:px-10 sm:py-12">
          <SectionHeading id="eco-title" tone="dark" eyebrow={t("ecoEyebrow")} title={t("ecoTitle")} text={t("ecoText")} />
          <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
            <svg aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-7 hidden h-2 w-[calc(100%-3rem)] lg:block" preserveAspectRatio="none" viewBox="0 0 100 2">
              <line x1="0" y1="1" x2="100" y2="1" stroke="var(--color-saffron)" strokeWidth="0.6" strokeDasharray="0.6 2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {ECO.map(({ key, icon: Icon }, i) => (
              <li key={key} className="relative flex gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/15 lg:flex-col lg:gap-3 lg:bg-transparent lg:p-0 lg:ring-0">
                <span className="relative z-10 inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-lapis-deep ring-2 ring-saffron/70">
                  <Icon aria-hidden="true" className="size-6 text-saffron" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-saffron">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-0.5 block text-lg font-extrabold uppercase tracking-[0.06em] text-white">{t(`eco.${key}`)}</span>
                  <span className="mt-1 block text-sm text-white/75">{t(`eco.${key}Text`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────────── */}
      <section className="container-page pt-20" aria-labelledby="benefits-title">
        <SectionHeading id="benefits-title" title={t("benefitsTitle")} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-4 rounded-[1.25rem] bg-white p-5 shadow-card">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-saffron-soft">
                <Icon aria-hidden="true" className="size-5 text-saffron-ink" />
              </span>
              <span>
                <span className="block font-bold text-lapis">{t(`benefits.${key}`)}</span>
                <span className="mt-1 block text-sm text-ink-muted">{t(`benefits.${key}Text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="container-page pt-20" aria-labelledby="how-title">
        <SectionHeading
          id="how-title"
          title={t("howTitle")}
          action={
            <Link href="/partners/apply" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
              {t("ctaApply")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
        />
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {(["s1", "s2", "s3", "s4"] as const).map((s, i) => (
            <li key={s} className="relative rounded-[1.25rem] border border-line bg-white p-5">
              <span className="font-display text-4xl font-extrabold text-saffron/80" aria-hidden="true">{i + 1}</span>
              <span className="sr-only">{t("step", { n: i + 1 })}</span>
              <h3 className="mt-2 text-lg text-lapis">{t(`how.${s}`)}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t(`how.${s}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Directory ──────────────────────────────────────── */}
      <section id="directory" className="container-page scroll-mt-24 pt-20" aria-labelledby="directory-title">
        <SectionHeading id="directory-title" eyebrow={t("directoryEyebrow")} title={t("directoryTitle")} />
        <nav aria-label={t("filterType")} className="mt-6 flex flex-wrap gap-2">
          <Link href={href({ city })} aria-current={!type ? "page" : undefined} className={chipCls(!type)}>
            {t("all")}
          </Link>
          {PARTNER_TYPE_LIST.filter((ty) => countByType.has(ty)).map((ty) => {
            const Icon = PARTNER_TYPE_ICONS[ty];
            return (
              <Link key={ty} href={href({ type: ty, city })} aria-current={type === ty ? "page" : undefined} className={chipCls(type === ty)} data-testid={`filter-type-${ty}`}>
                <Icon aria-hidden="true" className="size-4" /> {t(`typeGroups.${ty}`)}
              </Link>
            );
          })}
        </nav>
        {citySlugs.length > 1 && (
          <nav aria-label={t("filterCity")} className="mt-3 flex flex-wrap gap-2">
            <Link href={href({ type })} aria-current={!city ? "page" : undefined} className={cn(chipCls(!city), "min-h-9 px-3.5")}>
              {t("allCities")}
            </Link>
            {citySlugs.map((c) => (
              <Link key={c} href={href({ type, city: c })} aria-current={city === c ? "page" : undefined} className={cn(chipCls(city === c), "min-h-9 px-3.5")} data-testid={`filter-city-${c}`}>
                <MapPin aria-hidden="true" className="size-3.5" /> {destName.get(c)}
              </Link>
            ))}
          </nav>
        )}
        <p className="mt-5 text-sm font-semibold text-ink-muted" aria-live="polite">{t("resultCount", { count: items.length })}</p>
        {items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={t("emptyTitle")}
              action={
                <Link href={href({})} className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                  {t("showAll")}
                </Link>
              }
            >
              {t("emptyText")}
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.id} className="min-w-0">
                <PartnerCard partner={toCardData(t, p, destName, ctx)} cta={t("viewProfile")} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-ink-muted">{t("profile.priceNote")}</p>
      </section>

      {/* ── Business models (planned) ──────────────────────── */}
      <section className="container-page pt-20" aria-labelledby="models-title">
        <SectionHeading id="models-title" eyebrow={t("modelsEyebrow")} title={t("modelsTitle")} text={t("modelsText")} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {MODELS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col rounded-[1.25rem] border border-dashed border-lapis/25 bg-sand-soft/70 p-5" data-testid="business-model">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white ring-1 ring-lapis-mist">
                  <Icon aria-hidden="true" className="size-5 text-cobalt" />
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-saffron-ink ring-1 ring-saffron/40">{t("planned")}</span>
              </div>
              <h3 className="mt-4 text-lg leading-snug text-lapis">{t(`models.${key}`)}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{t(`models.${key}Text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="container-page py-20">
        <div className="bg-girih-dark on-dark relative overflow-hidden rounded-[1.75rem] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-saffron">
              <Compass aria-hidden="true" className="size-4" /> {t("eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl text-white">{t("ctaTitle")}</h2>
            <p className="mt-3 text-lg text-white/80">{t("ctaText")}</p>
          </div>
          <Link href="/partners/apply" className="mt-6 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-[#e6b55a] lg:mt-0">
            {t("ctaApply")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
