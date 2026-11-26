import { Clock, Leaf, UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { AddToTripButton } from "@/components/places/add-to-trip-button";
import { PlaceCard } from "@/components/places/place-card";
import { PlaceInquiryForm } from "@/components/places/place-inquiry-form";
import { PlaceHero, PlaceLocation, PlaceReviews, RatingPill } from "@/components/places/place-sections";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { getPublishedPlace, listAttractions, listPlaces } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import { priceLevelSymbol, type RestaurantInfo } from "@/lib/places/extras";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

const Gallery = nextDynamic(() => import("@/components/tours/gallery").then((m) => m.Gallery));

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await getPublishedPlace(db(), "restaurant", slug);
  if (!r) return {};
  return pageMetadata({ locale, href: `/restaurants/${slug}`, title: localize(r.name, locale), description: localize(r.summary, locale), image: r.image });
}

export default async function RestaurantPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const place = await getPublishedPlace(db(), "restaurant", slug);
  if (!place) notFound();
  const [t, tc, tn] = await Promise.all([
    getTranslations({ locale, namespace: "restaurants" }),
    getTranslations({ locale, namespace: "placeCommon" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const d = place.details as RestaurantInfo;
  const [destination, attractions, others, hotels, currency, rates] = await Promise.all([
    place.destinationSlug ? getPublishedDestinationBySlug(db(), place.destinationSlug) : null,
    listAttractions(db(), place.destinationSlug ? { destination: place.destinationSlug } : {}),
    listPlaces(db(), { kind: "restaurant", destination: place.destinationSlug ?? undefined }),
    listPlaces(db(), { kind: "hotel", destination: place.destinationSlug ?? undefined, limit: 3 }),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const name = localize(place.name, locale);
  const area = localize(d.area, locale);
  const destName = destination ? localize(destination.name, locale) : "";
  const price = (usd: number) => formatUsdIn(usd, currency, rates, locale);
  const gallery = [place.image, ...place.gallery]
    .filter((src, i, arr): src is string => !!src && imageExists(src) && arr.indexOf(src) === i)
    .map((src) => ({ src, alt: name }));
  const similar = others.filter((o) => o.slug !== place.slug).slice(0, 3);
  const label = (ns: "cuisines" | "dietary", k: string) => (tc.has(`${ns}.${k}` as never) ? tc(`${ns}.${k}` as never) : k);
  const tripItem = {
    id: `restaurant:${place.slug}`,
    kind: "restaurant" as const,
    title: name,
    refSlug: place.slug,
    destinationSlug: place.destinationSlug ?? undefined,
    priceUsd: place.priceFromUsd ?? undefined,
    priceUnit: "meal" as const,
    lat: place.lat ?? undefined,
    lng: place.lng ?? undefined,
    meta: [d.cuisine.map((c) => label("cuisines", c)).join(", "), localize(d.hours, locale)].filter(Boolean).join(" · "),
    image: place.image ?? undefined,
  };

  return (
    <ClientMessages namespaces={["placeCommon", "booking", "errors", "forms"]}>
      <PlaceHero
        locale={locale}
        image={place.image}
        name={name}
        eyebrow={[destName, area].filter(Boolean).join(" · ")}
        lead={localize(place.summary, locale)}
        crumbs={[
          { name: tn("home"), href: "/" },
          { name: t("title"), href: "/restaurants" },
          { name, href: `/restaurants/${place.slug}` },
        ]}
        badges={
          <>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/15 px-3 text-sm font-bold ring-1 ring-white/30 backdrop-blur">
              <span aria-hidden="true">{priceLevelSymbol(place.priceLevel)}</span>
              {tc(`priceLevels.${place.priceLevel ?? 1}` as never)}
            </span>
            {d.cuisine.slice(0, 2).map((c) => (
              <span key={c} className="inline-flex min-h-9 items-center rounded-full bg-white/15 px-3 text-sm font-bold ring-1 ring-white/30 backdrop-blur">
                {label("cuisines", c)}
              </span>
            ))}
            {d.rating && <RatingPill locale={locale} score={d.rating.score} count={d.rating.count} />}
          </>
        }
      >
        <a href="#request" className="inline-flex min-h-12 items-center rounded-full bg-saffron px-6 font-bold text-lapis-deep hover:bg-saffron-soft">
          {t("requestCta")}
        </a>
        <AddToTripButton item={tripItem} tone="light" />
      </PlaceHero>

      <div className="container-page grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="min-w-0 space-y-14">
          <section aria-labelledby="about-restaurant">
            <h2 id="about-restaurant" className="text-3xl text-lapis">
              {t("about")}
            </h2>
            <div className="prose-silk mt-4 text-lg">
              <p>{localize(place.description, locale)}</p>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("hoursTitle")}</dt>
                  <dd className="font-bold text-lapis-deep">{localize(d.hours, locale)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                <UtensilsCrossed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{tc("cuisineTitle")}</dt>
                  <dd className="font-bold text-lapis-deep">{d.cuisine.map((c) => label("cuisines", c)).join(", ")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-sand-soft px-4 py-3">
                <Leaf aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("averageMeal")}</dt>
                  <dd className="font-bold text-lapis-deep">{place.priceFromUsd != null ? tc("fromPrice", { price: price(place.priceFromUsd) }) : "—"}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section aria-labelledby="restaurant-menu">
            <h2 id="restaurant-menu" className="text-3xl text-lapis">
              {t("menuTitle")}
            </h2>
            <p className="mt-2 text-ink-muted">{t("menuLead")}</p>
            <ul className="mt-6 divide-y divide-dashed divide-line rounded-[var(--radius-card)] border border-line bg-white px-5 shadow-card" data-testid="menu">
              {d.menu.map((m, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-4">
                  <span className="font-semibold text-ink">{localize(m.name, locale)}</span>
                  <span aria-hidden="true" className="hidden flex-1 border-b border-dotted border-line sm:block" />
                  <span className="shrink-0 font-extrabold text-lapis">{price(m.priceUsd)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="restaurant-dietary">
            <h2 id="restaurant-dietary" className="text-3xl text-lapis">
              {t("dietaryTitle")}
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {d.dietary.map((x) => (
                <li key={x} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-turquoise-ink/10 px-4 text-sm font-semibold text-turquoise-ink">
                  <Leaf aria-hidden="true" className="size-4" /> {label("dietary", x)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">{t("dietaryNote")}</p>
          </section>

          {gallery.length > 1 && <Gallery images={gallery} title={tc("photos")} />}

          <PlaceLocation locale={locale} name={name} area={area} lat={place.lat} lng={place.lng} attractions={attractions} />

          <PlaceReviews locale={locale} rating={d.rating} reviews={d.reviews ?? []} />
        </div>

        <aside id="request" className="scroll-mt-24" aria-labelledby="request-title">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card lg:sticky lg:top-24">
            {place.priceFromUsd != null && (
              <p className="leading-tight">
                <span className="text-sm text-ink-muted">{tc("fromLabel")} </span>
                <span className="text-3xl font-extrabold text-lapis">{price(place.priceFromUsd)}</span>
                <span className="text-sm text-ink-muted"> {tc("perPersonMeal")}</span>
              </p>
            )}
            <h2 id="request-title" className="mt-4 text-2xl text-lapis-deep">
              {t("requestTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t("requestLead")}</p>
            <div className="mt-5">
              <PlaceInquiryForm topic="restaurant" refSlug={place.slug} subject={`Restaurant: ${place.name.en}`} idPrefix="restaurant" />
            </div>
          </div>
        </aside>
      </div>

      {(similar.length > 0 || hotels.length > 0) && (
        <div className="container-page space-y-14 pb-16">
          {similar.length > 0 && (
            <section aria-labelledby="similar-restaurants">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="similar-restaurants" className="text-3xl text-lapis">
                  {t("moreIn", { place: destName || t("title") })}
                </h2>
                <Link href={{ pathname: "/restaurants", query: place.destinationSlug ? { destination: place.destinationSlug } : {} }} className="inline-flex min-h-11 items-center font-semibold text-cobalt hover:text-lapis">
                  {t("showAll")}
                </Link>
              </div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((r) => (
                  <li key={r.slug}>
                    <PlaceCard place={r} locale={locale} destinationName={destName} price={r.priceFromUsd != null ? price(r.priceFromUsd) : undefined} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hotels.length > 0 && (
            <section aria-labelledby="stay-nearby">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="stay-nearby" className="text-3xl text-lapis">
                  {tc("stayNearby")}
                </h2>
                <Link href={{ pathname: "/hotels", query: place.destinationSlug ? { destination: place.destinationSlug } : {} }} className="inline-flex min-h-11 items-center font-semibold text-cobalt hover:text-lapis">
                  {tc("allHotels")}
                </Link>
              </div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {hotels.map((h) => (
                  <li key={h.slug}>
                    <PlaceCard place={h} locale={locale} destinationName={destName} price={h.priceFromUsd != null ? price(h.priceFromUsd) : undefined} />
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
