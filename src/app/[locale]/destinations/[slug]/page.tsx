import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { ReviewList } from "@/components/common/reviews";
import { SectionHeading } from "@/components/common/section";
import { SmartImage } from "@/components/common/smart-image";
import { LazyMap } from "@/components/maps/lazy-map";
import { AskAssistantButton } from "@/components/ai/ask-button";
import { ExperienceCard } from "@/components/content/experience-card";
import { JsonLd } from "@/components/seo/json-ld";
import nextDynamic from "next/dynamic";
import { TourCard } from "@/components/tours/tour-card";
import { buttonVariants } from "@/components/ui/button";
import { listContent } from "@/db/queries/content";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { listPublishedReviews } from "@/db/queries/reviews";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import { formatUsdIn } from "@/lib/pricing";
import { absoluteUrl, db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

/** Carousel + lightbox code is downloaded only on pages that actually have photos. */
const Gallery = nextDynamic(() => import("@/components/tours/gallery").then((m) => m.Gallery));

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await getPublishedDestinationBySlug(db(), slug);
  if (!d) return {};
  return pageMetadata({
    locale,
    href: `/destinations/${slug}`,
    title: localize(d.seoTitle, locale) || localize(d.name, locale),
    description: localize(d.seoDescription, locale) || localize(d.tagline, locale),
    image: d.heroImage,
  });
}

export default async function DestinationPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = await getPublishedDestinationBySlug(db(), slug);
  if (!d) notFound();
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const rates = await exchangeRates();
  const [tours, reviews, experiences] = await Promise.all([
    listPublishedTours(db(), { destination: slug, sort: "featured", currency, page: 1, pageSize: 48 }, rates),
    listPublishedReviews(db(), { destinationSlug: slug, limit: 6 }),
    listContent(db(), "experience", { destination: slug, limit: 4 }),
  ]);
  const name = localize(d.name, locale);
  const gallery = d.gallery.filter((g) => g.type === "image" && imageExists(g.url)).map((g) => ({ src: g.url, alt: localize(g.alt, locale) }));
  const pins = d.attractions.filter((a) => a.lat != null && a.lng != null);

  return (
    <ClientMessages namespaces={[]}>
      <section className="relative isolate overflow-hidden bg-lapis-deep text-white">
        <div className="absolute inset-0 -z-10">
          <SmartImage src={d.heroImage} alt="" label={name} priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-lapis-deep/90 via-lapis-deep/55 to-lapis-deep/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-lapis-deep/70 to-transparent" />
        </div>
        <div className="container-page flex min-h-[26rem] flex-col py-10 lg:min-h-[32rem] lg:py-14">
          <Breadcrumbs
            tone="dark"
            label={t("nav.breadcrumb")}
            base={`${siteUrl()}/${locale}`}
            items={[
              { name: t("nav.home"), href: "/" },
              { name: t("destinations.title"), href: "/destinations" },
              { name, href: `/destinations/${slug}` },
            ]}
          />
          <div className="mt-auto pt-12">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-saffron">{d.country ? localize(d.country, locale) : t("nt.dest.country")}</p>
            <h1 className="mt-2 text-[clamp(2.4rem,1.6rem+3vw,4rem)] leading-[1.05] text-white">{name}</h1>
            <p className="mt-3 max-w-2xl text-xl text-white/85">{localize(d.tagline, locale)}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#destination-tours" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-5 text-sm font-bold text-lapis-deep hover:bg-[#e6b55a]">
                {t("destinations.toursCount", { count: tours.total })}
              </a>
              <AskAssistantButton label={t("nt.destPage.ask")} question={t("nt.destPage.askQuestion", { name })} className="bg-white/15 backdrop-blur hover:bg-white/25" />
            </div>
          </div>
        </div>
      </section>

      <div className="container-page space-y-20 py-14">
        <section aria-labelledby="about-destination" className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading id="about-destination" title={t("destinations.overview", { name })} />
            <div className="prose-silk mt-6 text-lg">
              {localize(d.overview, locale).split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <aside className="rounded-[var(--radius-card)] bg-sand-soft p-6 lg:col-span-5" aria-labelledby="best-time">
            <h2 id="best-time" className="text-2xl text-lapis-deep">{t("destinations.bestTime")}</h2>
            <p className="mt-3">{localize(d.bestTime, locale)}</p>
            <h3 className="mt-5 font-sans text-sm font-bold uppercase tracking-wide text-ink-muted">{t("destinations.bestMonths")}</h3>
            <ul className="mt-3 grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const best = d.bestMonths.includes(m);
                return (
                  <li
                    key={m}
                    className={cn(
                      "rounded-sm py-1.5 text-center text-sm font-semibold",
                      best ? "bg-turquoise-ink text-white" : "bg-white text-ink-muted",
                    )}
                  >
                    <abbr title={t(`months.${m}` as never)} className="no-underline">{t(`monthsShort.${m}` as never)}</abbr>
                    {best && <span className="sr-only"> ✓</span>}
                  </li>
                );
              })}
            </ul>
            <Link href={{ pathname: "/tours", query: { destination: slug } }} className={buttonVariants({ variant: "secondary", className: "mt-6 w-full" })}>
              {t("destinations.explore", { name })}
            </Link>
          </aside>
        </section>

        {d.attractions.length > 0 && (
          <section aria-labelledby="attractions">
            <SectionHeading id="attractions" title={t("destinations.attractions")} />
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ol className="space-y-5">
                {d.attractions.map((a, i) => (
                  <li key={i} className="flex gap-4">
                    <span aria-hidden="true" className="flex size-10 shrink-0 rotate-45 items-center justify-center rounded-sm border-2 border-saffron bg-lapis font-bold text-white">
                      <span className="-rotate-45">{i + 1}</span>
                    </span>
                    <div>
                      <h3 className="text-2xl text-lapis-deep">{localize(a.name, locale)}</h3>
                      <p className="text-ink-muted">{localize(a.description, locale)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {pins.length > 0 && (
                <LazyMap
                  className="h-80 lg:h-full lg:min-h-96"
                  label={t("destinations.attractions")}
                  loadingLabel={t("common.mapLoading")}
                  attribution={t("common.mapAttribution")}
                  points={d.attractions
                    .map((a, i) => ({ a, i }))
                    .filter(({ a }) => a.lat != null && a.lng != null)
                    .map(({ a, i }) => ({ lat: a.lat!, lng: a.lng!, label: localize(a.name, locale), number: i + 1 }))}
                />
              )}
            </div>
          </section>
        )}

        {gallery.length > 0 && <Gallery images={gallery} title={t("destinations.gallery")} />}

        <section aria-labelledby="destination-tours">
          <SectionHeading id="destination-tours" title={t("destinations.tours", { name })} />
          {tours.items.length === 0 ? (
            <p className="mt-6 text-ink-muted">
              {t("destinations.noTours")}{" "}
              <Link href="/custom-tour" className="text-cobalt underline">{t("tours.emptyCta")}</Link>
            </p>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tours.items.map((tour) => (
                <li key={tour.id}>
                  <TourCard tour={tour} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {experiences.length > 0 && (
          <section aria-labelledby="destination-experiences">
            <SectionHeading id="destination-experiences" eyebrow={t("nt.exp.eyebrow")} title={t("nt.destPage.experiences", { name })} />
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {experiences.map((e) => (
                <li key={e.slug}>
                  <ExperienceCard
                    item={e}
                    locale={locale}
                    hours={e.durationHours != null ? t("nt.exp.hours", { count: e.durationHours }) : undefined}
                    price={e.priceFromUsd != null ? t("nt.exp.from", { price: formatUsdIn(e.priceFromUsd, currency, rates, locale) }) : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviews.total > 0 && (
          <section aria-labelledby="destination-reviews">
            <SectionHeading id="destination-reviews" title={t("destinations.reviews", { name })} />
            <ReviewList locale={locale} reviews={reviews} className="mt-6" />
          </section>
        )}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristDestination",
          name,
          description: localize(d.tagline, locale),
          url: absoluteUrl(locale, `/destinations/${slug}`),
          geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lng },
          containedInPlace: { "@type": "Country", name: d.country ? localize(d.country, "en") : "Uzbekistan" },
          includesAttraction: d.attractions.map((a) => ({ "@type": "TouristAttraction", name: localize(a.name, locale) })),
        }}
      />
    </ClientMessages>
  );
}
