import { Clock, Coffee, ConciergeBell, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { AddToTripButton } from "@/components/places/add-to-trip-button";
import { AmenityList } from "@/components/places/amenity-list";
import { PlaceCard } from "@/components/places/place-card";
import { PlaceInquiryForm } from "@/components/places/place-inquiry-form";
import { PlaceHero, PlaceLocation, PlaceReviews, RatingPill } from "@/components/places/place-sections";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { getPublishedPlace, listAttractions, listPlaces } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import type { HotelInfo } from "@/lib/places/extras";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

const Gallery = nextDynamic(() => import("@/components/tours/gallery").then((m) => m.Gallery));

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = await getPublishedPlace(db(), "hotel", slug);
  if (!h) return {};
  return pageMetadata({ locale, href: `/hotels/${slug}`, title: localize(h.name, locale), description: localize(h.summary, locale), image: h.image });
}

export default async function HotelPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const hotel = await getPublishedPlace(db(), "hotel", slug);
  if (!hotel) notFound();
  const [t, tc, tn] = await Promise.all([
    getTranslations({ locale, namespace: "hotels" }),
    getTranslations({ locale, namespace: "placeCommon" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const d = hotel.details as HotelInfo;
  const [destination, attractions, others, restaurants, currency, rates] = await Promise.all([
    hotel.destinationSlug ? getPublishedDestinationBySlug(db(), hotel.destinationSlug) : null,
    listAttractions(db(), hotel.destinationSlug ? { destination: hotel.destinationSlug } : {}),
    listPlaces(db(), { kind: "hotel", destination: hotel.destinationSlug ?? undefined }),
    listPlaces(db(), { kind: "restaurant", destination: hotel.destinationSlug ?? undefined, limit: 3 }),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const name = localize(hotel.name, locale);
  const area = localize(d.area, locale);
  const destName = destination ? localize(destination.name, locale) : "";
  const price = (usd: number) => formatUsdIn(usd, currency, rates, locale);
  const gallery = [hotel.image, ...hotel.gallery]
    .filter((src, i, arr): src is string => !!src && imageExists(src) && arr.indexOf(src) === i)
    .map((src) => ({ src, alt: name }));
  const similar = others.filter((o) => o.slug !== hotel.slug).slice(0, 3);
  const cheapest = [...d.roomTypes].sort((a, b) => a.priceFromUsd - b.priceFromUsd)[0];
  const tripItem = (roomIndex?: number) => {
    const r = roomIndex != null ? d.roomTypes[roomIndex]! : cheapest;
    return {
      id: roomIndex != null ? `hotel:${hotel.slug}:${roomIndex}` : `hotel:${hotel.slug}`,
      kind: "hotel" as const,
      title: name,
      refSlug: hotel.slug,
      destinationSlug: hotel.destinationSlug ?? undefined,
      priceUsd: r?.priceFromUsd ?? hotel.priceFromUsd ?? undefined,
      priceUnit: "night" as const,
      lat: hotel.lat ?? undefined,
      lng: hotel.lng ?? undefined,
      meta: [r ? localize(r.name, locale) : null, area].filter(Boolean).join(" · "),
      image: hotel.image ?? undefined,
    };
  };

  return (
    <ClientMessages namespaces={["placeCommon", "booking", "errors", "forms"]}>
      <PlaceHero
        locale={locale}
        image={hotel.image}
        name={name}
        eyebrow={[destName, area].filter(Boolean).join(" · ")}
        lead={localize(hotel.summary, locale)}
        crumbs={[
          { name: tn("home"), href: "/" },
          { name: t("title"), href: "/hotels" },
          { name, href: `/hotels/${hotel.slug}` },
        ]}
        badges={
          <>
            {d.stars ? (
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-sm font-bold ring-1 ring-white/30 backdrop-blur">
                <span aria-hidden="true" className="flex">
                  {Array.from({ length: d.stars }, (_, i) => (
                    <Star key={i} className="size-4 fill-saffron text-saffron" />
                  ))}
                </span>
                <span className="ml-1">{tc("stars", { count: d.stars })}</span>
              </span>
            ) : null}
            {d.rating && <RatingPill locale={locale} score={d.rating.score} count={d.rating.count} />}
          </>
        }
      >
        <a href="#request" className="inline-flex min-h-12 items-center rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft">
          {t("requestCta")}
        </a>
        <AddToTripButton item={tripItem()} tone="light" />
      </PlaceHero>

      <div className="container-page grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="min-w-0 space-y-14">
          <section aria-labelledby="about-hotel">
            <h2 id="about-hotel" className="text-3xl text-lapis">
              {t("about")}
            </h2>
            <div className="prose-silk mt-4 text-lg">
              <p>{localize(hotel.description, locale)}</p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {d.checkIn && (
                <li className="flex items-center gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                  <Clock aria-hidden="true" className="size-5 shrink-0 text-cobalt" />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{tc("checkIn")}</span>
                    <span className="font-bold text-lapis-deep">{tc("fromTime", { time: d.checkIn })}</span>
                  </span>
                </li>
              )}
              {d.checkOut && (
                <li className="flex items-center gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                  <Clock aria-hidden="true" className="size-5 shrink-0 text-cobalt" />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{tc("checkOut")}</span>
                    <span className="font-bold text-lapis-deep">{tc("untilTime", { time: d.checkOut })}</span>
                  </span>
                </li>
              )}
              <li className="flex items-center gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                {d.amenities.includes("breakfast") ? <Coffee aria-hidden="true" className="size-5 shrink-0 text-cobalt" /> : <ConciergeBell aria-hidden="true" className="size-5 shrink-0 text-cobalt" />}
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{tc("goodToKnow")}</span>
                  <span className="font-bold text-lapis-deep">{d.amenities.includes("breakfast") ? tc("breakfastIncluded") : tc("managerHelps")}</span>
                </span>
              </li>
            </ul>
          </section>

          {gallery.length > 1 && <Gallery images={gallery} title={tc("photos")} />}

          <section aria-labelledby="hotel-amenities">
            <h2 id="hotel-amenities" className="text-3xl text-lapis">
              {tc("amenitiesTitle")}
            </h2>
            <AmenityList locale={locale} amenities={d.amenities} className="mt-6" />
          </section>

          <section aria-labelledby="hotel-rooms">
            <h2 id="hotel-rooms" className="text-3xl text-lapis">
              {t("roomsTitle")}
            </h2>
            <p className="mt-2 text-ink-muted">{t("roomsLead")}</p>
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-card" data-testid="room-types">
              {d.roomTypes.map((r, i) => (
                <li key={i} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-xl text-lapis-deep">{localize(r.name, locale)}</h3>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                      <Users aria-hidden="true" className="size-4" /> {tc("sleeps", { count: r.sleeps })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                    <p className="leading-tight sm:text-right">
                      <span className="block text-xs uppercase tracking-wide text-ink-muted">{tc("fromLabel")}</span>
                      <span className="text-xl font-extrabold text-lapis">{price(r.priceFromUsd)}</span>
                      <span className="block text-xs text-ink-muted">{tc("perNight")}</span>
                    </p>
                    <AddToTripButton item={tripItem(i)} tone="outline" size="sm" showViewLink={false} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">{tc("priceNote")}</p>
          </section>

          <PlaceLocation locale={locale} name={name} area={area} lat={hotel.lat} lng={hotel.lng} attractions={attractions} />

          <PlaceReviews locale={locale} rating={d.rating} reviews={d.reviews ?? []} />
        </div>

        <aside id="request" className="scroll-mt-24" aria-labelledby="request-title">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card lg:sticky lg:top-24">
            {cheapest && (
              <p className="leading-tight">
                <span className="text-sm text-ink-muted">{tc("fromLabel")} </span>
                <span className="text-3xl font-extrabold text-lapis">{price(cheapest.priceFromUsd)}</span>
                <span className="text-sm text-ink-muted"> {tc("perNight")}</span>
              </p>
            )}
            <h2 id="request-title" className="mt-4 text-2xl text-lapis-deep">
              {t("requestTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{tc("requestLead")}</p>
            <div className="mt-5">
              <PlaceInquiryForm topic="hotel" refSlug={hotel.slug} subject={`Hotel: ${hotel.name.en}`} roomTypes={d.roomTypes.map((r) => localize(r.name, locale))} idPrefix="hotel" />
            </div>
          </div>
        </aside>
      </div>

      {(similar.length > 0 || restaurants.length > 0) && (
        <div className="container-page space-y-14 pb-16">
          {similar.length > 0 && (
            <section aria-labelledby="similar-hotels">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="similar-hotels" className="text-3xl text-lapis">
                  {t("moreIn", { place: destName || t("title") })}
                </h2>
                <Link href={{ pathname: "/hotels", query: hotel.destinationSlug ? { destination: hotel.destinationSlug } : {} }} className="inline-flex min-h-11 items-center font-semibold text-cobalt hover:text-lapis">
                  {t("showAll")}
                </Link>
              </div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((h) => (
                  <li key={h.slug}>
                    <PlaceCard place={h} locale={locale} destinationName={destName} price={h.priceFromUsd != null ? price(h.priceFromUsd) : undefined} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {restaurants.length > 0 && (
            <section aria-labelledby="eat-nearby">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="eat-nearby" className="text-3xl text-lapis">
                  {tc("eatNearby")}
                </h2>
                <Link href={{ pathname: "/restaurants", query: hotel.destinationSlug ? { destination: hotel.destinationSlug } : {} }} className="inline-flex min-h-11 items-center font-semibold text-cobalt hover:text-lapis">
                  {tc("allRestaurants")}
                </Link>
              </div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {restaurants.map((r) => (
                  <li key={r.slug}>
                    <PlaceCard place={r} locale={locale} destinationName={destName} price={r.priceFromUsd != null ? price(r.priceFromUsd) : undefined} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </ClientMessages>
  );
}
