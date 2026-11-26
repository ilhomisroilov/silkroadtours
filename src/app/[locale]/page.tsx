import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gem,
  Globe2,
  Headset,
  HeartHandshake,
  MapPin,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import credits from "../../../public/images/credits.json";
import { Reveal } from "@/components/common/motion";
import { SectionHeading } from "@/components/common/section";
import { SmartImage } from "@/components/common/smart-image";
import { ExperienceCard } from "@/components/content/experience-card";
import { HomeAiCard } from "@/components/home/home-ai-card";
import { Testimonials } from "@/components/home/testimonials";
import { TourCard } from "@/components/tours/tour-card";
import { listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPublishedReviews } from "@/db/queries/reviews";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { getPathname, Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, href: "/", title: t("defaultTitle"), absoluteTitle: true });
}

const HOME_DESTINATIONS = ["samarkand", "bukhara", "tashkent", "dubai", "istanbul", "khiva"];

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const rates = await exchangeRates();
  const [destinations, featured, reviews, experiences, guides] = await Promise.all([
    listPublishedDestinations(db()),
    listPublishedTours(db(), { featured: "1", sort: "featured", currency, page: 1, pageSize: 6 }, rates),
    listPublishedReviews(db(), { limit: 8 }),
    listContent(db(), "experience", { limit: 4 }),
    listContent(db(), "guide", { limit: 3 }),
  ]);

  const hero = destinations.find((d) => d.slug === "samarkand") ?? destinations[0];
  const heroCredit = hero?.heroImage
    ? (credits as Record<string, { author: string; license: string; source: string }>)[hero.heroImage.replace(/^\/images\//, "")]
    : undefined;
  const plannerImage = "/images/destinations/chimgan-charvak/3.jpg";
  const top = HOME_DESTINATIONS.map((s) => destinations.find((d) => d.slug === s)).filter((d): d is NonNullable<typeof d> => !!d).slice(0, 5);
  const country = (d: { country: Record<Locale, string> | null }) => (d.country ? localize(d.country, locale) : t("nt.dest.country"));

  const trust = [
    { icon: Plane, title: t("nt.trust.t1"), text: t("nt.trust.s1") },
    { icon: ShieldCheck, title: t("nt.trust.t2"), text: t("nt.trust.s2") },
    { icon: Headset, title: t("nt.trust.t3"), text: t("nt.trust.s3") },
    { icon: Globe2, title: t("nt.trust.t4", { count: destinations.length }), text: t("nt.trust.s4") },
    reviews.total > 0
      ? { icon: Star, title: t("nt.trust.t5r"), text: t("nt.trust.s5r", { avg: reviews.average.toFixed(1), count: reviews.total }), star: true }
      : { icon: Star, title: t("nt.trust.t5"), text: t("nt.trust.s5"), star: true },
  ];
  const why = [
    { icon: Globe2, title: t("nt.why.t1"), text: t("nt.why.s1", { count: destinations.length }) },
    { icon: Gem, title: t("nt.why.t2"), text: t("nt.why.s2") },
    { icon: Headset, title: t("nt.why.t3"), text: t("nt.why.s3") },
    { icon: HeartHandshake, title: t("nt.why.t4"), text: t("nt.why.s4") },
  ];
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: t(`months.${i + 1}` as never) }));
  const segment = "flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 sm:px-5";
  const segSelect =
    "w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[0.95rem] font-semibold text-ink focus:outline-none";

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate -mt-[72px] overflow-hidden" aria-labelledby="hero-title">
        <SmartImage
          src={hero?.heroImage}
          alt={hero ? localize(hero.name, locale) : ""}
          label={hero ? localize(hero.name, locale) : t("meta.siteName")}
          priority
          sizes="100vw"
          className="absolute inset-0 -z-10"
          imgClassName="object-cover object-[62%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(248,250,253,0.95)_0%,rgba(248,250,253,0.82)_48%,rgba(248,250,253,0.25)_100%)] lg:bg-[linear-gradient(90deg,rgba(248,250,253,0.97)_0%,rgba(248,250,253,0.86)_30%,rgba(248,250,253,0.25)_58%,rgba(248,250,253,0)_75%)]"
        />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-white/70 to-transparent" />
        <div className="container-page flex min-h-[640px] flex-col justify-center pb-28 pt-[calc(72px+2.5rem)] lg:min-h-[700px]">
          <div className="animate-fade-up max-w-[40rem]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 text-sm font-semibold text-saffron-ink shadow-[0_4px_14px_-8px_rgb(23_61_102/0.4)]">
              <Star aria-hidden="true" className="size-4 fill-saffron text-saffron" />
              {t("nt.hero.chip")}
            </p>
            <h1 id="hero-title" className="mt-5 text-[clamp(2.55rem,1.6rem+4vw,4.4rem)] leading-[1.03] text-ink">
              {t.rich("nt.hero.title", { b: (c) => <span className="text-cobalt">{c}</span> })}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink/80 sm:text-xl">{t("nt.hero.text")}</p>
          </div>

          <form
            action={getPathname({ locale, href: "/tours" })}
            method="get"
            role="search"
            aria-label={t("home.searchTitle")}
            className="animate-fade-up mt-8 flex max-w-[46rem] flex-col rounded-[1.75rem] bg-white p-2 shadow-lift [animation-delay:120ms] sm:flex-row sm:items-center sm:rounded-full"
          >
            <label className={`${segment} sm:flex-[1.35]`}>
              <MapPin aria-hidden="true" className="size-5 shrink-0 text-lapis" />
              <span className="relative min-w-0 flex-1">
                <span className="block text-xs font-medium text-ink-muted">{t("nt.hero.destination")}</span>
                <select name="destination" defaultValue="" className={segSelect}>
                  <option value="">{t("nt.hero.anyDestination")}</option>
                  {destinations.map((d) => (
                    <option key={d.slug} value={d.slug}>{localize(d.name, locale)}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-1 right-0 size-4 text-ink-muted" />
              </span>
            </label>
            <span aria-hidden="true" className="mx-4 h-px bg-line sm:mx-0 sm:h-9 sm:w-px" />
            <label className={segment}>
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-lapis" />
              <span className="relative min-w-0 flex-1">
                <span className="block text-xs font-medium text-ink-muted">{t("nt.hero.when")}</span>
                <select name="month" defaultValue="" className={segSelect}>
                  <option value="">{t("nt.hero.anyDate")}</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-1 right-0 size-4 text-ink-muted" />
              </span>
            </label>
            <span aria-hidden="true" className="mx-4 h-px bg-line sm:mx-0 sm:h-9 sm:w-px" />
            <label className={segment}>
              <Users aria-hidden="true" className="size-5 shrink-0 text-lapis" />
              <span className="relative min-w-0 flex-1">
                <span className="block text-xs font-medium text-ink-muted">{t("nt.hero.travelers")}</span>
                <select name="guests" defaultValue="2" className={segSelect}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{t("nt.hero.people", { count: n })}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-1 right-0 size-4 text-ink-muted" />
              </span>
            </label>
            <button
              type="submit"
              className="mt-2 inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-lapis-deep px-7 font-bold text-white transition-colors hover:bg-cobalt sm:mt-0"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              {t("nt.hero.submit")}
            </button>
          </form>
        </div>
        {heroCredit && (
          <p className="absolute bottom-16 right-4 hidden text-[0.68rem] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] lg:block">
            {t("home.photoBy")} {heroCredit.author} · {heroCredit.license} ·{" "}
            <a href={heroCredit.source} className="underline" rel="noopener noreferrer" target="_blank">Wikimedia Commons</a>
          </p>
        )}
      </section>

      {/* ── Trust bar ───────────────────────────────────────── */}
      <div className="container-page relative z-10 -mt-12">
        <ul className="grid grid-cols-2 gap-y-4 rounded-[1.5rem] bg-white px-4 py-5 shadow-lift sm:grid-cols-3 lg:grid-cols-5 lg:px-2">
          {trust.map((item, i) => (
            <li key={item.title} className={`flex items-center gap-3 px-3 lg:justify-center ${i > 0 ? "lg:border-l lg:border-line" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
              <item.icon aria-hidden="true" className={`size-7 shrink-0 ${"star" in item ? "fill-saffron text-saffron" : "text-cobalt"}`} />
              <span className="min-w-0">
                <span className="block text-[0.95rem] font-bold leading-tight text-lapis">{item.title}</span>
                <span className="block text-sm text-ink-muted">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Destinations + AI assistant ─────────────────────── */}
      <section className="container-page grid gap-8 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6" aria-labelledby="dest-title">
        <div className="min-w-0">
          <SectionHeading
            id="dest-title"
            eyebrow={t("nt.dest.eyebrow")}
            title={t("nt.dest.title")}
            action={
              <Link href="/destinations" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
                {t("nt.dest.viewAll")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          <ul className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-5 xl:gap-2.5">
            {top.map((d, i) => (
              <Reveal as="li" key={d.slug} delay={i * 0.05} className="w-[68%] shrink-0 snap-start sm:w-auto">
                <Link
                  href={`/destinations/${d.slug}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-[1.25rem] shadow-card"
                >
                  <SmartImage
                    src={d.heroImage}
                    alt=""
                    label={localize(d.name, locale)}
                    compact
                    sizes="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 70vw"
                    imgClassName="transition-transform duration-700 group-hover:scale-110"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-lapis-night/85 via-lapis-night/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1.5 p-3.5 text-white">
                    <span className="min-w-0">
                      <span className="block text-[1.05rem] font-bold leading-tight [overflow-wrap:anywhere]">{localize(d.name, locale)}</span>
                      <span className="block text-[0.8rem] text-white/80">{country(d)}</span>
                    </span>
                    <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur transition group-hover:bg-white group-hover:text-lapis">
                      <ArrowRight className="size-4" />
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
        <HomeAiCard
          labels={{
            title: t("nt.ai.title"),
            text: t("nt.ai.text"),
            placeholder: t("nt.ai.placeholder"),
            send: t("nt.ai.send"),
            chips: [
              { label: t("nt.ai.c1"), question: t("nt.ai.q1") },
              { label: t("nt.ai.c2"), question: t("nt.ai.q2") },
              { label: t("nt.ai.c3"), question: t("nt.ai.q3") },
            ],
          }}
        />
      </section>

      {/* ── Planner banner + why + testimonials ─────────────── */}
      <section className="container-page grid gap-6 pt-12 lg:grid-cols-12" aria-label={t("nt.why.title")}>
        <div className="relative isolate overflow-hidden rounded-[1.5rem] shadow-card lg:col-span-5">
          <SmartImage src={plannerImage} alt="" label={t("nt.planner.title")} sizes="(min-width: 1024px) 40vw, 100vw" className="absolute inset-0 -z-10" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(11,31,54,0.85)_0%,rgba(11,31,54,0.55)_50%,rgba(11,31,54,0.15)_100%)]" />
          <div className="flex h-full flex-col gap-6 p-6 text-white sm:flex-row sm:items-end sm:p-7">
            <div className="flex-1">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/30 backdrop-blur">
                <Sparkles aria-hidden="true" className="size-4 text-saffron" /> {t("nt.planner.chip")}
              </p>
              <h2 className="mt-4 text-[1.9rem] leading-tight text-white">{t("nt.planner.title")}</h2>
              <p className="mt-3 max-w-sm text-white/85">{t("nt.planner.text")}</p>
              <Link href="/planner" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-lapis transition hover:bg-saffron-soft">
                <Wand2 aria-hidden="true" className="size-4" /> {t("nt.planner.cta")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <ul className="space-y-2.5 rounded-2xl bg-white/12 p-4 text-[0.95rem] ring-1 ring-white/25 backdrop-blur-md">
              {[t("nt.planner.b1"), t("nt.planner.b2"), t("nt.planner.b3")].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="size-5 fill-white text-lapis" /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-4">
          <SectionHeading eyebrow={t("nt.why.eyebrow")} title={t("nt.why.title")} />
          <ul className="mt-6 grid grid-cols-2 gap-3">
            {why.map((w, i) => (
              <Reveal as="li" key={w.title} delay={i * 0.05} className="flex flex-col items-center rounded-[1.25rem] bg-white p-4 text-center shadow-card">
                <span className="inline-flex size-14 items-center justify-center rounded-full bg-sky ring-1 ring-lapis-mist">
                  <w.icon aria-hidden="true" className="size-6 text-cobalt" />
                </span>
                <span className="mt-3 font-bold leading-tight text-lapis">{w.title}</span>
                <span className="mt-1 text-sm text-ink-muted">{w.text}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          {reviews.items.length > 0 ? (
            <Testimonials
              items={reviews.items.map((r) => ({ id: r.id, author: r.authorName, country: r.authorCountry, rating: r.rating, body: r.body, tour: r.tour?.title ? localize(r.tour.title, locale) : null }))}
              labels={{ prev: t("nt.reviews.prev"), next: t("nt.reviews.next"), from: t.raw("nt.reviews.from") as string, title: t("nt.reviews.title") }}
            />
          ) : (
            <div className="flex h-full flex-col justify-between rounded-[1.5rem] bg-white p-6 shadow-card">
              <div>
                <span aria-hidden="true" className="flex gap-1">
                  {Array.from({ length: 5 }, (_, k) => <Star key={k} className="size-5 fill-saffron text-saffron" />)}
                </span>
                <h2 className="mt-4 text-2xl text-lapis">{t("nt.reviews.emptyTitle")}</h2>
                <p className="mt-2 text-ink-muted">{t("nt.reviews.emptyText")}</p>
              </div>
              <Link href="/reviews/new" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                {t("nt.reviews.emptyCta")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Featured tours ──────────────────────────────────── */}
      {featured.items.length > 0 && (
        <section className="container-page pt-20" aria-labelledby="featured-title">
          <SectionHeading
            id="featured-title"
            eyebrow={t("nt.featured.eyebrow")}
            title={t("nt.featured.title")}
            action={
              <Link href="/tours" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
                {t("nt.featured.viewAll")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((tour, i) => (
              <Reveal as="li" key={tour.id} delay={i * 0.04}>
                <TourCard tour={tour} locale={locale} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {/* ── Experiences ─────────────────────────────────────── */}
      {experiences.length > 0 && (
        <section className="container-page pt-20" aria-labelledby="exp-title">
          <SectionHeading
            id="exp-title"
            eyebrow={t("nt.exp.eyebrow")}
            title={t("nt.exp.title")}
            action={
              <Link href="/experiences" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
                {t("nt.exp.viewAll")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {experiences.map((e) => (
              <li key={e.slug}>
                <ExperienceCard
                  item={e}
                  locale={locale}
                  place={e.destinationSlug ? destinations.find((d) => d.slug === e.destinationSlug)?.name[locale] : undefined}
                  hours={e.durationHours != null ? t("nt.exp.hours", { count: e.durationHours }) : undefined}
                  price={e.priceFromUsd != null ? t("nt.exp.from", { price: formatUsdIn(e.priceFromUsd, currency, rates, locale) }) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Tour builder band ───────────────────────────────── */}
      <section className="container-page pt-20">
        <div className="bg-girih-dark on-dark relative overflow-hidden rounded-[1.75rem] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl text-white">{t("nt.builder.title")}</h2>
            <p className="mt-3 text-lg text-white/80">{t("nt.builder.text")}</p>
          </div>
          <Link href="/custom-tour" className="mt-6 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-[#e6b55a] lg:mt-0">
            {t("nt.builder.cta")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      {/* ── Travel guide ────────────────────────────────────── */}
      {guides.length > 0 && (
        <section className="container-page pt-20" aria-labelledby="guides-title">
          <SectionHeading
            id="guides-title"
            eyebrow={t("nt.guides.eyebrow")}
            title={t("nt.guides.title")}
            action={
              <Link href="/travel-guide" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
                {t("nt.guides.viewAll")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/travel-guide/${g.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="aspect-[16/9] overflow-hidden">
                    <SmartImage src={g.image} alt="" label={localize(g.title, locale)} compact sizes="(min-width: 768px) 33vw, 100vw" imgClassName="transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {g.readingMinutes != null && <p className="text-sm text-ink-muted">{t("nt.guides.minutes", { count: g.readingMinutes })}</p>}
                    <h3 className="mt-1 text-xl leading-snug text-lapis group-hover:text-cobalt">{localize(g.title, locale)}</h3>
                    <p className="mt-2 line-clamp-3 text-ink-muted">{localize(g.excerpt, locale)}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-cobalt">
                      {t("nt.guides.read")} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
