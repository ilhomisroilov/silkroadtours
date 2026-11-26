import { BedDouble, Bus, CalendarDays, Footprints, Gauge, Languages, MapPin, Moon, Route, Users, Utensils } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { ReviewList, Stars } from "@/components/common/reviews";
import { SectionHeading } from "@/components/common/section";
import { SmartImage } from "@/components/common/smart-image";
import { LazyMap } from "@/components/maps/lazy-map";
import { ArchFrame, GirihPattern, IkatDivider } from "@/components/ornament";
import { JsonLd } from "@/components/seo/json-ld";
import { BookingCard, BookingProvider, MobileBookBar, type DepartureOption } from "@/components/tours/booking-card";
import nextDynamic from "next/dynamic";
import { ItineraryAccordion } from "@/components/tours/itinerary";
import { TourCard } from "@/components/tours/tour-card";
import { Badge } from "@/components/ui/misc";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/primitives";
import { listFaq } from "@/db/queries/faq";
import { listPublishedReviews } from "@/db/queries/reviews";
import { getPublishedTourBySlug, listPublishedTours, priceTable } from "@/db/queries/tours";
import type { BookingType, Locale } from "@/db/types";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import { formatDateLabel, monthRanges } from "@/lib/format";
import { formatMoney, quote, toMajor } from "@/lib/pricing";
import { absoluteUrl, db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

/** Carousel + lightbox code is downloaded only on pages that actually have photos. */
const Gallery = nextDynamic(() => import("@/components/tours/gallery").then((m) => m.Gallery));

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = await getPublishedTourBySlug(db(), slug);
  if (!tour) return {};
  return pageMetadata({
    locale,
    href: `/tours/${slug}`,
    title: localize(tour.seoTitle, locale) || localize(tour.title, locale),
    description: localize(tour.seoDescription, locale) || localize(tour.summary, locale),
    image: tour.heroImage,
  });
}

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = await getPublishedTourBySlug(db(), slug);
  if (!tour) notFound();

  const t = await getTranslations({ locale });
  const ms = (m: number) => t(`monthsShort.${m}` as never);
  const currency = await requestCurrency(locale, tour.audience === "domestic" ? "domestic" : undefined);
  const rates = await exchangeRates();
  const [related, reviews, faq] = await Promise.all([
    listPublishedTours(db(), { destination: tour.primaryDestination.slug, sort: "featured", currency, page: 1, pageSize: 4 }, rates),
    listPublishedReviews(db(), { tourSlug: slug, limit: 6 }),
    listFaq(db()),
  ]);

  const title = localize(tour.title, locale);
  const region = localize(tour.primaryDestination.name, locale);
  const prices = priceTable(tour, currency, rates);
  const types = (["group", "private"] as BookingType[]).filter((ty) => tour.priceTiers.some((p) => p.bookingType === ty));
  const defaultType = types[0] ?? "group";
  const adults = Math.min(tour.maxGroup, Math.max(tour.minGroup, 2));
  const departures: DepartureOption[] = tour.departures.map((d) => ({
    id: d.id,
    startDate: d.startDate,
    endDate: d.endDate,
    seatsTotal: d.seatsTotal,
    seatsBooked: d.seatsBooked,
    status: d.status,
    priceModifierPercent: d.priceModifierPercent,
  }));
  const initialQuote = quote({ tour, tiers: tour.priceTiers, bookingType: defaultType, adults, children: 0, currency, rates });
  const fromMinor = prices.length ? Math.min(...prices.map((p) => p.amountMinor)) : null;
  const fromLabel = fromMinor != null ? t("tour.fromPrice", { price: formatMoney(fromMinor, currency, locale) }) : t("tours.noPrice");
  const gallery = tour.gallery
    .filter((g) => g.type === "image" && imageExists(g.url))
    .map((g) => ({ src: g.url, alt: localize(g.alt, locale) }));
  const routePoints = tour.route.map((p, i) => ({ lat: p.lat, lng: p.lng, label: localize(p.label, locale), number: p.day ?? i + 1, caption: p.day ? t("tour.dayN", { day: p.day }) : undefined }));
  const season = monthRanges(tour.seasonMonths, ms) || t("tours.runsAllYear");
  const langNames = await getTranslations({ locale, namespace: "services.guideLanguages" });
  const guideLanguages = tour.guideLanguages.map((l) => (langNames.has(l as never) ? langNames(l as never) : l.toUpperCase())).join(", ");
  const faqItems = faq.filter((f) => (tour.audience === "domestic" ? ["general", "transport"] : ["visa", "currency", "general"]).includes(f.category)).slice(0, 5);
  const relatedTours = related.items.filter((r) => r.id !== tour.id).slice(0, 3);

  const facts = [
    { icon: CalendarDays, label: t("tour.duration"), value: `${t("common.days", { count: tour.durationDays })} · ${t("common.nights", { count: tour.durationNights })}` },
    { icon: Users, label: t("tour.groupSize"), value: t("common.groupSize", { min: tour.minGroup, max: tour.maxGroup }) },
    { icon: Gauge, label: t("difficulty.label"), value: t(`difficulty.${tour.difficulty}`) },
    { icon: CalendarDays, label: t("tour.season"), value: season },
    { icon: MapPin, label: t("tour.startsIn"), value: region },
    { icon: Languages, label: t("tour.guideLanguages"), value: guideLanguages },
  ];

  const offerPrice = fromMinor != null ? toMajor(fromMinor, currency) : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: title,
    description: localize(tour.summary, locale),
    url: absoluteUrl(locale, `/tours/${slug}`),
    ...(imageExists(tour.heroImage) ? { image: tour.heroImage.startsWith("http") ? tour.heroImage : `${siteUrl()}${tour.heroImage}` } : {}),
    touristType: tour.audience === "domestic" ? "Domestic travellers" : "International travellers",
    provider: { "@id": `${siteUrl()}/#agency` },
    itinerary: {
      "@type": "ItemList",
      itemListElement: tour.itinerary.map((d) => ({ "@type": "ListItem", position: d.dayNumber, name: localize(d.title, locale) })),
    },
    ...(offerPrice != null
      ? {
          offers: {
            "@type": "Offer",
            price: offerPrice,
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
            url: absoluteUrl(locale, `/book/${slug}`),
            ...(departures[0] ? { validFrom: departures[0].startDate } : {}),
          },
        }
      : {}),
    // Only real, published reviews feed the rating.
    ...(tour.ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: tour.ratingAvg, reviewCount: tour.ratingCount, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <ClientMessages namespaces={["tour", "monthsShort", "errors"]}>
      <BookingProvider
        slug={slug}
        currency={currency}
        types={types}
        minGroup={tour.minGroup}
        maxGroup={tour.maxGroup}
        departures={departures}
        initial={{ type: defaultType, adults, children: 0, departureId: null, date: null }}
        initialQuote={initialQuote.ok ? initialQuote : null}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
          <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.25} />
          <div className="container-page relative grid gap-8 py-10 lg:grid-cols-12 lg:py-14">
            <div className="lg:col-span-7">
              <Breadcrumbs
                tone="dark"
                label={t("nav.breadcrumb")}
                base={`${siteUrl()}/${locale}`}
                items={[
                  { name: t("nav.home"), href: "/" },
                  { name: t("nav.tours"), href: "/tours" },
                  { name: title, href: `/tours/${slug}` },
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone={tour.audience === "domestic" ? "saffron" : "turquoise"}>{t(tour.audience === "domestic" ? "audience.domesticShort" : "audience.inboundShort")}</Badge>
                <Badge tone="sand">{t(`categories.${tour.category}`)}</Badge>
                {tour.badges.map((b) => (
                  <Badge key={b} tone="sand">{t(`badges.${b}` as never)}</Badge>
                ))}
              </div>
              <h1 className="mt-4 text-5xl text-ivory">{title}</h1>
              <p className="mt-4 max-w-2xl text-lg text-sand">{localize(tour.summary, locale)}</p>
              {tour.ratingCount > 0 && (
                <p className="mt-4 flex items-center gap-2 text-sand">
                  <Stars rating={tour.ratingAvg} label={t("common.ratingOutOf", { rating: tour.ratingAvg.toFixed(1) })} />
                  <a href="#reviews" className="underline">{t("common.reviewsCount", { count: tour.ratingCount })}</a>
                </p>
              )}
              <p className="mt-6 text-2xl font-bold text-saffron">{fromLabel} <span className="text-base font-normal text-sand">{t("common.perPerson")}</span></p>
            </div>
            <div className="relative mx-auto w-full max-w-sm lg:col-span-5">
              <div className="relative aspect-[5/6]">
                <div className="arch-mask absolute inset-0">
                  <SmartImage src={tour.heroImage} alt={title} label={region} priority sizes="(min-width: 1024px) 24rem, 90vw" />
                </div>
                <ArchFrame className="-inset-2.5 h-[calc(100%+1.25rem)] w-[calc(100%+1.25rem)]" />
              </div>
            </div>
          </div>
          <IkatDivider height={12} />
        </section>

        {/* ── Key facts ────────────────────────────────────── */}
        <div className="border-b border-line bg-white">
          <dl className="container-page grid grid-cols-2 gap-x-6 gap-y-4 py-6 md:grid-cols-3 xl:grid-cols-6">
            {facts.map((f) => (
              <div key={f.label} className="relative pl-8">
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <f.icon aria-hidden="true" className="absolute left-0 top-0.5 size-5 text-turquoise-ink" />
                  {f.label}
                </dt>
                <dd className="font-semibold text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="container-page grid gap-12 py-12 pb-28 lg:grid-cols-[1fr_24rem] lg:pb-12">
          <div className="min-w-0 space-y-16">
            {gallery.length > 0 && <Gallery images={gallery} title={t("common.gallery")} />}

            <section aria-labelledby="overview">
              <SectionHeading id="overview" title={t("tour.overview")} />
              <div className="prose-silk mt-6 max-w-3xl text-lg">
                {paragraphs(localize(tour.description, locale)).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            {tour.itinerary.length > 0 && (
              <section aria-labelledby="itinerary">
                <SectionHeading id="itinerary" title={t("tour.itinerary")} />
                <div className="mt-6">
                  <ItineraryAccordion
                    days={tour.itinerary.map((d) => ({
                      value: `day-${d.dayNumber}`,
                      heading: (
                        <span key="heading" className="flex flex-col">
                          <span key="n" aria-hidden="true" className="absolute left-0 top-3 flex size-11 items-center justify-center rounded-full border-2 border-saffron bg-lapis-deep font-display text-lg font-bold text-ivory">
                            {d.dayNumber}
                          </span>
                          <span key="d" className="text-sm font-bold uppercase tracking-wide text-saffron-ink">{t("tour.dayN", { day: d.dayNumber })}</span>
                          <span key="t" className="font-display text-2xl font-semibold text-lapis-deep">{localize(d.title, locale)}</span>
                        </span>
                      ),
                      body: (
                        <div key="body" className="space-y-4">
                          {paragraphs(localize(d.description, locale)).map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
                            <li className="inline-flex items-center gap-1.5">
                              <Utensils aria-hidden="true" className="size-4 text-turquoise-ink" />
                              <span className="sr-only">{t("tour.meals")}: </span>
                              {d.meals.length ? d.meals.map((m) => t(`meals.${m}`)).join(" · ") : t("meals.none")}
                            </li>
                            {d.overnight && localize(d.overnight, locale) && (
                              <li className="inline-flex items-center gap-1.5">
                                <Moon aria-hidden="true" className="size-4 text-turquoise-ink" />
                                {t("tour.overnight")}: {localize(d.overnight, locale)}
                              </li>
                            )}
                            {d.distanceKm != null && d.distanceKm > 0 && (
                              <li className="inline-flex items-center gap-1.5">
                                <Route aria-hidden="true" className="size-4 text-turquoise-ink" />
                                {t("tour.distance", { km: d.distanceKm })}
                              </li>
                            )}
                            {d.walkingHours != null && d.walkingHours > 0 && (
                              <li className="inline-flex items-center gap-1.5">
                                <Footprints aria-hidden="true" className="size-4 text-turquoise-ink" />
                                {t("tour.walking", { hours: d.walkingHours })}
                              </li>
                            )}
                          </ul>
                        </div>
                      ),
                    }))}
                  />
                </div>
              </section>
            )}

            {(tour.accommodation.length > 0 || tour.transport.length > 0) && (
              <section aria-labelledby="stay" className="grid gap-6 md:grid-cols-2">
                {tour.accommodation.length > 0 && (
                  <div className="rounded-[var(--radius-card)] bg-sand-soft p-6">
                    <h2 id="stay" className="flex items-center gap-2 text-2xl text-lapis-deep">
                      <BedDouble aria-hidden="true" className="size-6 text-terracotta" /> {t("tour.stay")}
                    </h2>
                    <ul className="mt-4 space-y-4">
                      {tour.accommodation.map((a, i) => (
                        <li key={i}>
                          <p className="font-semibold">{localize(a.name, locale)}</p>
                          <p className="text-sm text-ink-muted">
                            {t(`accommodationTypes.${a.type}`)} · {t("tour.nightsCount", { count: a.nights })}
                            {a.tier && localize(a.tier, locale) ? ` · ${localize(a.tier, locale)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.transport.length > 0 && (
                  <div className="rounded-[var(--radius-card)] bg-sand-soft p-6">
                    <h2 className="flex items-center gap-2 text-2xl text-lapis-deep">
                      <Bus aria-hidden="true" className="size-6 text-terracotta" /> {t("tour.transport")}
                    </h2>
                    <ul className="mt-4 space-y-4">
                      {tour.transport.map((tr, i) => (
                        <li key={i}>
                          <p className="font-semibold">{t(`transportModes.${tr.mode}`)}</p>
                          <p className="text-sm text-ink-muted">{localize(tr.description, locale)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {(tour.included.length > 0 || tour.excluded.length > 0) && (
              <section className="grid gap-8 md:grid-cols-2" aria-label={`${t("tour.included")} / ${t("tour.excluded")}`}>
                <div>
                  <h2 className="text-2xl text-lapis-deep">{t("tour.included")}</h2>
                  <ul className="check-list mt-4 space-y-2.5">
                    {tour.included.map((it, i) => (
                      <li key={i}>{localize(it, locale)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="text-2xl text-lapis-deep">{t("tour.excluded")}</h2>
                  <ul className="cross-list mt-4 space-y-2.5">
                    {tour.excluded.map((it, i) => (
                      <li key={i}>{localize(it, locale)}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {routePoints.length > 0 && (
              <section aria-labelledby="route">
                <SectionHeading id="route" title={t("tour.routeMap")} text={t("tour.routeMapIntro")} />
                <LazyMap
                  className="mt-6 h-80 md:h-[28rem]"
                  route
                  points={routePoints}
                  label={t("tour.routeMap")}
                  loadingLabel={t("common.mapLoading")}
                  attribution={t("common.mapAttribution")}
                />
                <ol className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {routePoints.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold text-lapis">{p.number}.</span> {p.label}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {prices.length > 0 && (
              <section aria-labelledby="prices">
                <SectionHeading id="prices" title={t("tour.priceTable")} />
                {/* Focusable so keyboard users can scroll the table when it is wider than a small screen (WCAG 2.1.1). */}
                <div tabIndex={0} role="region" aria-labelledby="prices" className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
                  <table className="w-full text-left" data-testid="price-table">
                    <thead className="bg-sand-soft text-sm">
                      <tr>
                        <th scope="col" className="px-4 py-3">{t("tour.priceTableType")}</th>
                        <th scope="col" className="px-4 py-3">{t("tour.priceTableGroup")}</th>
                        <th scope="col" className="px-4 py-3 text-right">{t("tour.priceTablePrice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((p, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="px-4 py-3">{t(`tour.${p.bookingType}`)}</td>
                          <td className="px-4 py-3">{p.minPax === p.maxPax ? p.minPax : `${p.minPax}–${p.maxPax}`}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.amountMinor, p.currency, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-ink-muted">
                  {t("tour.childPolicy", { percent: tour.childPricePercent })}
                  {prices.some((p) => p.isConverted) ? ` ${t("tour.converted")}` : ""}
                </p>
              </section>
            )}

            {departures.length > 0 && (
              <section aria-labelledby="departures">
                <SectionHeading id="departures" title={t("tour.departures")} />
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {departures.slice(0, 8).map((d) => {
                    const left = Math.max(0, d.seatsTotal - d.seatsBooked);
                    return (
                      <li key={d.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-white px-4 py-3">
                        <span className="font-semibold">{formatDateLabel(d.startDate, ms)} – {formatDateLabel(d.endDate, ms)}</span>
                        <span className={left <= 3 ? "text-sm font-semibold text-pomegranate" : "text-sm text-ink-muted"}>
                          {d.status === "sold_out" ? t("tour.soldOut") : t("tour.seatsLeft", { count: left })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {reviews.total > 0 && (
              <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-24">
                <SectionHeading id="reviews-title" title={t("tour.reviews")} />
                <ReviewList locale={locale} reviews={reviews} className="mt-6" />
              </section>
            )}

            {faqItems.length > 0 && (
              <section aria-labelledby="faq">
                <SectionHeading id="faq" title={t("tour.faq")} />
                <Accordion type="multiple" className="mt-4">
                  {faqItems.map((f) => (
                    <AccordionItem key={f.id} value={`faq-${f.id}`}>
                      <AccordionTrigger>{localize(f.question, locale)}</AccordionTrigger>
                      <AccordionContent className="prose-silk text-ink-muted">
                        {paragraphs(localize(f.answer, locale)).map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
          </div>

          <aside className="hidden lg:block" aria-label={t("tour.bookingTitle")}>
            <div className="sticky top-6 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-lift">
              <BookingCard title={t("tour.bookingTitle")} />
            </div>
          </aside>
        </div>

        {relatedTours.length > 0 && (
          <section className="bg-sand-soft py-16" aria-labelledby="related">
            <div className="container-page">
              <SectionHeading id="related" title={t("tour.related")} />
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedTours.map((r) => (
                  <li key={r.id}>
                    <TourCard tour={r} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        <MobileBookBar fromLabel={fromLabel} />
        <JsonLd data={jsonLd} />
      </BookingProvider>
    </ClientMessages>
  );
}
