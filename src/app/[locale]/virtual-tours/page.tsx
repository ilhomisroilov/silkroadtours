import { ArrowRight, ArrowUpRight, Camera, Compass, Hand, Map as MapIcon, Route } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Reveal } from "@/components/common/motion";
import { SectionHeading } from "@/components/common/section";
import { PanoramaBand } from "@/components/virtual/panorama-band";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { localize } from "@/lib/localize";
import { db, pageMetadata, siteUrl } from "@/lib/server/site";
import { panoramaTours, stopCount, VIRTUAL_TOURS } from "@/data/virtual-tours";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "virtualTours.meta" });
  const cover = panoramaTours()[0]?.scenes[0]?.thumb;
  return pageMetadata({ locale, href: "/virtual-tours", title: t("title"), description: t("description"), image: cover ? `${siteUrl()}${cover}` : null });
}

export default async function VirtualToursPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const v = await getTranslations({ locale, namespace: "virtualTours" });
  const destinations = await listPublishedDestinations(db());
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const pano = panoramaTours();
  const lead = pano[0];
  const sceneTotal = pano.reduce((n, tour) => n + tour.scenes.length, 0);
  const cities = new Set(VIRTUAL_TOURS.map((tour) => tour.destinationSlug)).size;
  const steps = [
    { icon: Hand, title: v("hub.how1Title"), text: v("hub.how1Text") },
    { icon: MapIcon, title: v("hub.how2Title"), text: v("hub.how2Text") },
    { icon: Route, title: v("hub.how3Title"), text: v("hub.how3Text") },
  ];

  return (
    <>
      <section className="on-dark relative isolate overflow-hidden bg-lapis-night text-white" aria-labelledby="vt-hub-title">
        {lead && <PanoramaBand src={lead.band} eager className="-z-10 opacity-90" duration={170} />}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,31,54,0.94)_0%,rgba(11,31,54,0.78)_42%,rgba(11,31,54,0.25)_100%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-lapis-night/80 to-transparent" />
        <div className="container-page flex min-h-[34rem] flex-col pb-14 pt-8 lg:min-h-[38rem] lg:pb-12 lg:pt-10">
          <Breadcrumbs
            tone="dark"
            label={t("nav.breadcrumb")}
            base={`${siteUrl()}/${locale}`}
            items={[
              { name: t("nav.home"), href: "/" },
              { name: v("hub.eyebrow"), href: "/virtual-tours" },
            ]}
          />
          <div className="animate-fade-up mt-auto max-w-2xl pt-14">
            <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em] text-saffron">
              <span className="rounded-full bg-saffron px-2.5 py-0.5 text-xs tracking-normal text-lapis-deep">360°</span>
              {v("hub.eyebrow")}
            </p>
            <h1 id="vt-hub-title" className="mt-4 text-[clamp(2.3rem,1.5rem+3.4vw,4rem)] leading-[1.05] text-white">
              {v("hub.title")}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">{v("hub.lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {lead && (
                <Link
                  href={`/virtual-tours/${lead.slug}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep transition hover:bg-saffron-soft"
                >
                  <Compass aria-hidden="true" className="size-5" /> {v("hub.start")}
                </Link>
              )}
              <a href="#vt-tours" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/12 px-6 font-bold text-white ring-1 ring-white/35 backdrop-blur transition hover:bg-white/20">
                {v("hub.browse")} <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-white/85">
              <li>{v("hub.statTours", { count: VIRTUAL_TOURS.length })}</li>
              <li>{v("hub.statScenes", { count: sceneTotal })}</li>
              <li>{v("hub.statCities", { count: cities })}</li>
            </ul>
          </div>
        </div>
        {lead && (
          <p className="absolute bottom-3 right-4 max-w-[calc(100%-2rem)] truncate text-[0.68rem] text-white/75">
            {v("viewer.credit", { author: lead.bandCredit.author, license: lead.bandCredit.license })} ·{" "}
            <a href={lead.bandCredit.source} target="_blank" rel="noopener noreferrer" className="underline">
              Wikimedia Commons
            </a>
          </p>
        )}
      </section>

      <section id="vt-tours" aria-labelledby="vt-list-title" className="container-page scroll-mt-24 py-14">
        <SectionHeading id="vt-list-title" eyebrow={v("hub.eyebrow")} title={v("hub.listTitle")} text={v("hub.listLead")} />
        <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-12">
          {VIRTUAL_TOURS.map((tour, i) => {
            const is360 = tour.mode === "360";
            const image = tour.cover;
            const name = destName.get(tour.destinationSlug) ?? localize(tour.title, locale);
            const wide = is360 && i < 2;
            return (
              <Reveal as="li" key={tour.slug} delay={(i % 3) * 0.05} className={cn(wide ? "lg:col-span-6" : "lg:col-span-3")}>
                <Link
                  href={`/virtual-tours/${tour.slug}`}
                  className="group relative block h-full overflow-hidden rounded-[1.5rem] bg-lapis-night shadow-card transition hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className={cn("relative", wide ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-[4/5] md:aspect-[4/3] lg:aspect-[3/4]")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized still */}
                    <img
                      src={image}
                      alt=""
                      width={1280}
                      height={720}
                      loading={i < 2 ? "eager" : "lazy"}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,31,54,0.97)_0%,rgba(11,31,54,0.82)_38%,rgba(11,31,54,0.25)_70%,rgba(11,31,54,0)_100%)]" />
                    <span
                      className={cn(
                        "absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                        is360 ? "bg-saffron text-lapis-deep" : "bg-white/90 text-lapis",
                      )}
                    >
                      {is360 ? <Compass aria-hidden="true" className="size-3.5" /> : <Camera aria-hidden="true" className="size-3.5" />}
                      {is360 ? v("hub.mode360") : v("hub.modePhoto")}
                    </span>
                    <span aria-hidden="true" className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-lapis transition group-hover:bg-saffron">
                      <ArrowUpRight className="size-5" />
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-saffron">{name}</p>
                      <h3 className={cn("mt-1 leading-tight text-white", wide ? "text-2xl" : "text-xl")}>{localize(tour.title, locale)}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-white/85">{localize(tour.intro, locale)}</p>
                      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                          {is360 ? v("hub.scenes", { count: stopCount(tour) }) : v("hub.photos", { count: stopCount(tour) })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-white/90">
                          {v("hub.open")} <ArrowRight aria-hidden="true" className="size-3.5" />
                        </span>
                      </p>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="vt-how-title" className="container-page pb-20">
        <div className="bg-girih-dark on-dark relative overflow-hidden rounded-[1.75rem] px-6 py-10 text-white sm:px-10">
          <h2 id="vt-how-title" className="text-3xl text-white">{v("hub.howTitle")}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-saffron/60">
                  <s.icon className="size-5 text-saffron" />
                </span>
                <div>
                  <h3 className="text-lg text-white">
                    <span className="mr-2 text-saffron">{i + 1}.</span>
                    {s.title}
                  </h3>
                  <p className="mt-1 text-white/80">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/trip-builder" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft">
              {v("detail.plan")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/ai-guide" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/12 px-6 font-bold text-white ring-1 ring-white/35 hover:bg-white/20">
              {v("detail.ask")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
