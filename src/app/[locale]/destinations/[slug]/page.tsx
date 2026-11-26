import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { ReviewList } from "@/components/common/reviews";
import { SectionHeading } from "@/components/common/section";
import { SmartImage } from "@/components/common/smart-image";
import { LazyMap } from "@/components/maps/lazy-map";
import { ArchFrame, GirihPattern, IkatDivider } from "@/components/ornament";
import { JsonLd } from "@/components/seo/json-ld";
import nextDynamic from "next/dynamic";
import { TourCard } from "@/components/tours/tour-card";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { listPublishedReviews } from "@/db/queries/reviews";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
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
  const [tours, reviews] = await Promise.all([
    listPublishedTours(db(), { destination: slug, sort: "featured", currency, page: 1, pageSize: 48 }, await exchangeRates()),
    listPublishedReviews(db(), { destinationSlug: slug, limit: 6 }),
  ]);
  const name = localize(d.name, locale);
  const gallery = d.gallery.filter((g) => g.type === "image" && imageExists(g.url)).map((g) => ({ src: g.url, alt: localize(g.alt, locale) }));
  const pins = d.attractions.filter((a) => a.lat != null && a.lng != null);

  return (
    <ClientMessages namespaces={[]}>
      <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
        <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.25} />
        <div className="container-page relative grid items-center gap-10 py-10 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-7">
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
            <h1 className="mt-6 text-5xl text-ivory">{name}</h1>
            <p className="mt-4 max-w-xl text-xl text-sand">{localize(d.tagline, locale)}</p>
            <p className="mt-6 font-semibold text-saffron">{t("destinations.toursCount", { count: tours.total })}</p>
          </div>
          <div className="relative mx-auto w-full max-w-xs lg:col-span-5">
            <div className="relative aspect-[5/7]">
              <div className="arch-mask absolute inset-0">
                <SmartImage src={d.heroImage} alt={name} label={name} priority sizes="(min-width: 1024px) 20rem, 80vw" />
              </div>
              <ArchFrame className="-inset-2.5 h-[calc(100%+1.25rem)] w-[calc(100%+1.25rem)]" />
            </div>
          </div>
        </div>
        <IkatDivider height={12} />
      </section>

      <div className="container-page space-y-20 py-14">
        <section aria-labelledby="about-destination" className="grid gap-10 lg:grid-cols-12">
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
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
              <Link href="/services/tailor-made" className="text-cobalt underline">{t("tours.emptyCta")}</Link>
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
          containedInPlace: { "@type": "Country", name: "Uzbekistan" },
          includesAttraction: d.attractions.map((a) => ({ "@type": "TouristAttraction", name: localize(a.name, locale) })),
        }}
      />
    </ClientMessages>
  );
}
