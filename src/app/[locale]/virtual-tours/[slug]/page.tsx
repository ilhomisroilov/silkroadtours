import { ArrowRight, ArrowUpRight, CalendarDays, Camera, Compass, MapPin, Sparkles, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { SectionHeading } from "@/components/common/section";
import { LazyMap } from "@/components/maps/lazy-map";
import { TourCard } from "@/components/tours/tour-card";
import { PanoramaViewer } from "@/components/virtual/panorama-viewer";
import { PhotoTour } from "@/components/virtual/photo-tour";
import type { PhotoSlideView, ViewerScene } from "@/components/virtual/types";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import { db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";
import photoCredits from "../../../../../public/images/credits.json";
import { getVirtualTour, stopCount, tourPoints, VIRTUAL_TOURS, type MediaCredit, type PhotoSlide } from "@/data/virtual-tours";

export const dynamic = "force-dynamic";

/** Carousel + lightbox code is downloaded only when the page has photos. */
const Gallery = nextDynamic(() => import("@/components/tours/gallery").then((m) => m.Gallery));

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = getVirtualTour(slug);
  if (!tour) return {};
  const t = await getTranslations({ locale, namespace: "virtualTours.meta" });
  const d = await getPublishedDestinationBySlug(db(), tour.destinationSlug);
  const name = d ? localize(d.name, locale) : localize(tour.title, locale);
  const image = tour.mode === "360" ? tour.scenes[0]!.thumb : tour.cover;
  return pageMetadata({
    locale,
    href: `/virtual-tours/${slug}`,
    title: localize(tour.title, locale) || t("tourTitle", { name }),
    description: localize(tour.intro, locale) || t("tourDescription", { name }),
    image: `${siteUrl()}${image}`,
  });
}

export default async function VirtualTourPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = getVirtualTour(slug);
  if (!tour) notFound();
  const d = await getPublishedDestinationBySlug(db(), tour.destinationSlug);
  const t = await getTranslations({ locale });
  const v = await getTranslations({ locale, namespace: "virtualTours" });
  const [currency, rates] = await Promise.all([requestCurrency(locale), exchangeRates()]);
  const tours = d
    ? await listPublishedTours(db(), { destination: tour.destinationSlug, sort: "featured", currency, page: 1, pageSize: 3 }, rates)
    : { items: [], total: 0 };

  const name = d ? localize(d.name, locale) : localize(tour.title, locale);
  const is360 = tour.mode === "360";
  const summary = d ? localize(d.overview, locale).split(/\n{2,}/)[0] : "";
  const sights = (d?.attractions ?? []).slice(0, 4);
  const points = tourPoints(tour, locale);

  const slideView = (s: PhotoSlide): PhotoSlideView => ({ image: s.image, title: localize(s.title, locale), caption: localize(s.caption, locale), credit: s.credit });
  const scenes: ViewerScene[] =
    tour.mode === "360"
      ? tour.scenes.map((s) => ({
          id: s.id,
          title: localize(s.title, locale),
          caption: localize(s.caption, locale),
          image: s.image,
          thumb: s.thumb,
          yaw: s.yaw,
          pitch: s.pitch,
          hfov: s.hfov,
          credit: s.credit,
          hotspots: s.hotspots.map((h) => ({
            id: h.id,
            kind: h.kind,
            pitch: h.pitch,
            yaw: h.yaw,
            label: localize(h.label, locale),
            text: h.text ? localize(h.text, locale) : undefined,
            target: h.target,
          })),
        }))
      : [];
  const stops = tour.mode === "360" ? tour.scenes.map((s) => ({ title: s.title, caption: s.caption })) : tour.gallery.map((s) => ({ title: s.title, caption: s.caption }));

  // Gallery: the tour's own photos (360° tours) plus the destination's photos not already in the photo tour.
  const inSlideshow = new Set(tour.mode === "photo" ? tour.gallery.map((g) => g.image) : []);
  const dbPhotos = (d?.gallery ?? [])
    .filter((g) => g.type === "image" && imageExists(g.url) && !inSlideshow.has(g.url))
    .map((g) => ({ src: g.url, alt: localize(g.alt, locale) || name }));
  const galleryItems = [...(tour.mode === "360" ? tour.gallery.map((g) => ({ src: g.image, alt: localize(g.title, locale) })) : []), ...dbPhotos].filter(
    (g, i, all) => all.findIndex((x) => x.src === g.src) === i,
  );

  const credits: { title: string; credit: MediaCredit }[] = [
    ...(tour.mode === "360" ? tour.scenes.map((s) => ({ title: `360° · ${localize(s.title, locale)}`, credit: s.credit })) : []),
    ...tour.gallery.map((g) => ({ title: localize(g.title, locale), credit: g.credit })),
  ];
  const known = new Set(credits.map((c) => c.credit.source));
  for (const g of dbPhotos) {
    const c = (photoCredits as Record<string, { author: string; license: string; source: string }>)[g.src.replace(/^\/images\//, "")];
    if (c && !known.has(c.source)) {
      known.add(c.source);
      credits.push({ title: g.alt, credit: { author: c.author, license: c.license, licenseUrl: "", source: c.source } });
    }
  }
  const related = VIRTUAL_TOURS.filter((x) => x.slug !== tour.slug);
  const askQuestion = v("detail.askQuestion", { name });

  return (
    <ClientMessages namespaces={["virtualTours"]}>
      <section className="bg-ai-soft relative overflow-hidden" aria-labelledby="vt-title">
        <div className="container-page pb-8 pt-6">
          <Breadcrumbs
            label={t("nav.breadcrumb")}
            base={`${siteUrl()}/${locale}`}
            items={[
              { name: t("nav.home"), href: "/" },
              { name: v("hub.eyebrow"), href: "/virtual-tours" },
              { name, href: `/virtual-tours/${tour.slug}` },
            ]}
          />
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="animate-fade-up max-w-3xl">
              <p className="flex flex-wrap items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-cobalt">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs tracking-normal",
                    is360 ? "bg-saffron text-lapis-deep" : "bg-lapis text-white",
                  )}
                >
                  {is360 ? <Compass aria-hidden="true" className="size-3.5" /> : <Camera aria-hidden="true" className="size-3.5" />}
                  {is360 ? v("hub.mode360") : v("hub.modePhoto")}
                </span>
                {is360 ? v("hub.scenes", { count: stopCount(tour) }) : v("hub.photos", { count: stopCount(tour) })}
              </p>
              <h1 id="vt-title" className="mt-3 text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] leading-[1.08] text-lapis">
                {localize(tour.title, locale)}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-ink/75">{localize(tour.intro, locale)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={{ pathname: "/trip-builder", query: { destination: tour.destinationSlug } }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lapis-deep px-5 font-bold text-white transition hover:bg-cobalt"
              >
                <Wand2 aria-hidden="true" className="size-4" /> {v("detail.plan")}
              </Link>
              <Link
                href={{ pathname: "/ai-guide", query: { q: askQuestion } }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-lapis ring-1 ring-lapis/20 transition hover:ring-lapis"
              >
                <Sparkles aria-hidden="true" className="size-4 text-cobalt" /> {v("detail.ask")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page -mt-1 pt-2">
        {tour.mode === "360" ? (
          <PanoramaViewer key={tour.slug} scenes={scenes} title={localize(tour.title, locale)} />
        ) : (
          <PhotoTour key={tour.slug} slides={tour.gallery.map(slideView)} title={localize(tour.title, locale)} />
        )}
      </div>

      <div className="container-page space-y-16 py-14">
        <section aria-labelledby="vt-about" className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading id="vt-about" title={v("detail.about", { name })} />
            {summary && <p className="mt-5 text-lg text-ink/85">{summary}</p>}
            <h3 className="mt-8 font-sans text-sm font-bold uppercase tracking-wide text-ink-muted">{v("detail.stops")}</h3>
            <ol className="mt-4 space-y-4">
              {stops.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden="true" className="flex size-9 shrink-0 rotate-45 items-center justify-center rounded-sm border-2 border-saffron bg-lapis text-sm font-bold text-white">
                    <span className="-rotate-45">{i + 1}</span>
                  </span>
                  <div>
                    <p className="text-lg font-bold text-lapis-deep">{localize(s.title, locale)}</p>
                    <p className="text-ink-muted">{localize(s.caption, locale)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="space-y-5 lg:col-span-5" aria-label={v("detail.bestTime")}>
            {d && (
              <div className="rounded-[var(--radius-card)] bg-sand-soft p-6">
                <h2 className="flex items-center gap-2 text-2xl text-lapis-deep">
                  <CalendarDays aria-hidden="true" className="size-6 text-cobalt" /> {v("detail.bestTime")}
                </h2>
                <p className="mt-3">{localize(d.bestTime, locale)}</p>
                <h3 className="mt-5 font-sans text-sm font-bold uppercase tracking-wide text-ink-muted">{v("detail.bestMonths")}</h3>
                <ul className="mt-3 grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const best = d.bestMonths.includes(m);
                    return (
                      <li key={m} className={cn("rounded-sm py-1.5 text-center text-sm font-semibold", best ? "bg-turquoise-ink text-white" : "bg-white text-ink-muted")}>
                        <abbr title={t(`months.${m}` as never)} className="no-underline">
                          {t(`monthsShort.${m}` as never)}
                        </abbr>
                        {best && <span className="sr-only"> ✓</span>}
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={`/destinations/${tour.destinationSlug}`}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis"
                >
                  {v("detail.destination")} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            )}
            <div className="bg-girih-dark on-dark rounded-[var(--radius-card)] p-6 text-white">
              <h2 className="text-2xl text-white">{v("detail.ctaTitle")}</h2>
              <p className="mt-2 text-white/80">{v("detail.ctaText")}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={{ pathname: "/trip-builder", query: { destination: tour.destinationSlug } }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-5 text-sm font-bold text-lapis-deep hover:bg-saffron-soft"
                >
                  <Wand2 aria-hidden="true" className="size-4" /> {v("detail.plan")}
                </Link>
                <Link
                  href={{ pathname: "/ai-guide", query: { q: askQuestion } }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-sm font-bold text-white ring-1 ring-white/35 hover:bg-white/20"
                >
                  <Sparkles aria-hidden="true" className="size-4 text-saffron" /> {v("detail.ask")}
                </Link>
              </div>
            </div>
          </aside>
        </section>

        {(points.length > 0 || sights.length > 0) && (
          <section aria-labelledby="vt-map" className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <SectionHeading id="vt-map" title={v("detail.mapTitle")} text={v("detail.mapLead", { name })} />
              {sights.length > 0 && (
                <>
                  <h3 className="mt-8 font-sans text-sm font-bold uppercase tracking-wide text-ink-muted">{v("detail.topSights", { name })}</h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {sights.map((a, i) => (
                      <li key={i} className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">
                        <p className="flex items-start gap-2 font-bold text-lapis-deep">
                          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cobalt" /> {localize(a.name, locale)}
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{localize(a.description, locale)}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {points.length > 0 && (
              <LazyMap
                className="h-80 lg:h-full lg:min-h-[26rem]"
                label={v("detail.mapTitle")}
                loadingLabel={t("common.mapLoading")}
                attribution={t("common.mapAttribution")}
                points={points}
              />
            )}
          </section>
        )}

        {galleryItems.length > 0 && (
          <section aria-labelledby="vt-gallery">
            <SectionHeading id="vt-gallery" title={v("detail.galleryTitle", { name })} />
            <div className="mt-6">
              <Gallery images={galleryItems} title={v("detail.galleryTitle", { name })} />
            </div>
          </section>
        )}

        {tours.items.length > 0 && (
          <section aria-labelledby="vt-tours">
            <SectionHeading
              id="vt-tours"
              title={v("detail.tours", { name })}
              action={
                <Link href={{ pathname: "/tours", query: { destination: tour.destinationSlug } }} className="inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis">
                  {v("detail.allTours")} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              }
            />
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tours.items.map((item) => (
                <li key={item.id}>
                  <TourCard tour={item} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section aria-labelledby="vt-related">
            <SectionHeading
              id="vt-related"
              title={v("detail.related")}
              action={
                <Link href="/virtual-tours" className="inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis">
                  {v("hub.browse")} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              }
            />
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => {
                const r360 = r.mode === "360";
                return (
                  <li key={r.slug}>
                    <Link href={`/virtual-tours/${r.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-lapis-night shadow-card">
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized still */}
                      <img
                        src={r.mode === "360" ? r.scenes[0]!.thumb : r.cover}
                        alt=""
                        width={640}
                        height={480}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-lapis-night/90 via-lapis-night/20 to-transparent" />
                      <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold", r360 ? "bg-saffron text-lapis-deep" : "bg-white/90 text-lapis")}>
                        {r360 ? v("hub.mode360") : v("hub.modePhoto")}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
                        <span className="min-w-0">
                          <span className="block font-bold leading-tight">{localize(r.title, locale)}</span>
                          <span className="block text-xs text-white/80">
                            {r360 ? v("hub.scenes", { count: stopCount(r) }) : v("hub.photos", { count: stopCount(r) })}
                          </span>
                        </span>
                        <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 transition group-hover:bg-white group-hover:text-lapis">
                          <ArrowUpRight className="size-4" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="vt-credits" className="border-t border-line pt-8">
          <h2 id="vt-credits" className="text-xl text-lapis">{v("detail.creditsTitle")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{v("detail.creditsLead")}</p>
          <ul className="mt-4 grid gap-x-8 gap-y-1.5 text-sm text-ink-muted md:grid-cols-2">
            {credits.map((c, i) => (
              <li key={i}>
                <a href={c.credit.source} target="_blank" rel="noopener noreferrer" className="hover:text-cobalt hover:underline">
                  {v("detail.creditItem", { title: c.title, author: c.credit.author, license: c.credit.license })}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ClientMessages>
  );
}
