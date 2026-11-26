import { MapPin, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Stars } from "@/components/common/reviews";
import { SmartImage } from "@/components/common/smart-image";
import { LazyMap } from "@/components/maps/lazy-map";
import { distanceKm, type AttractionPoint } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import type { PlaceReview } from "@/lib/places/extras";
import { photoCredit } from "@/lib/places/photo-credits";
import { siteUrl } from "@/lib/server/site";
import { uzText } from "@/lib/uz-alphabet";

/** Photo header of a hotel or restaurant page. */
export async function PlaceHero({
  locale,
  image,
  name,
  crumbs,
  eyebrow,
  lead,
  badges,
  children,
}: {
  locale: Locale;
  image: string | null;
  name: string;
  crumbs: { name: string; href: string }[];
  eyebrow: string;
  lead: string;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const t = await getTranslations({ locale });
  const credit = photoCredit(image);
  return (
    <section className="relative isolate overflow-hidden bg-lapis-deep text-white">
      <div className="absolute inset-0 -z-10">
        <SmartImage src={image} alt="" label={name} priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-lapis-deep/90 via-lapis-deep/60 to-lapis-deep/15" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-lapis-deep/80 to-transparent" />
      </div>
      <div className="container-page flex min-h-[26rem] flex-col py-8 lg:min-h-[32rem] lg:py-12">
        <Breadcrumbs tone="dark" label={t("nav.breadcrumb")} base={`${siteUrl()}/${locale}`} items={crumbs} />
        <div className="mt-auto max-w-3xl pt-12">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-saffron">
            <MapPin aria-hidden="true" className="size-4" /> {eyebrow}
          </p>
          <h1 className="mt-2 text-[clamp(2.2rem,1.5rem+3vw,3.8rem)] leading-[1.05] text-white">{name}</h1>
          {badges && <div className="mt-4 flex flex-wrap items-center gap-2">{badges}</div>}
          <p className="mt-4 max-w-2xl text-lg text-white/85">{lead}</p>
          {children && <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
      </div>
      {credit && (
        <p className="absolute bottom-2 right-4 hidden text-[0.68rem] text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:block">
          {t("placeCommon.photoCredit", { author: credit.author, license: credit.license })} ·{" "}
          <a href={credit.source} className="underline" target="_blank" rel="noopener noreferrer">
            Wikimedia Commons
          </a>
        </p>
      )}
    </section>
  );
}

/** Rating pill used in the hero. */
export async function RatingPill({ locale, score, count }: { locale: Locale; score: number; count: number }) {
  const t = await getTranslations({ locale, namespace: "placeCommon" });
  return (
    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-bold ring-1 ring-white/30 backdrop-blur">
      <Star aria-hidden="true" className="size-4 fill-saffron text-saffron" />
      {score.toFixed(1)}
      <span className="font-medium text-white/80">· {t("reviewsCount", { count })}</span>
    </span>
  );
}

/** Guest reviews kept with the place. */
export async function PlaceReviews({ locale, rating, reviews }: { locale: Locale; rating?: { score: number; count: number }; reviews: PlaceReview[] }) {
  const t = await getTranslations({ locale });
  if (!rating && reviews.length === 0) return null;
  return (
    <section aria-labelledby="place-reviews">
      <h2 id="place-reviews" className="text-3xl text-lapis">
        {t("placeCommon.reviewsTitle")}
      </h2>
      {rating && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-lg">
          <Stars rating={rating.score} label={t("common.ratingOutOf", { rating: rating.score.toFixed(1) })} />
          <span className="font-semibold">{rating.score.toFixed(1)}</span>
          <span className="text-ink-muted">· {t("placeCommon.reviewsCount", { count: rating.count })}</span>
        </p>
      )}
      <ul className="mt-6 grid gap-5 md:grid-cols-2">
        {reviews.map((r, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
            <Stars rating={r.rating} label={t("common.ratingOutOf", { rating: r.rating })} />
            <blockquote lang={r.lang} className="text-ink">
              <p>{r.lang === "uz" ? uzText(r.text) : r.text}</p>
            </blockquote>
            <footer className="mt-auto text-sm text-ink-muted">
              <span className="font-semibold text-ink">{r.author}</span>, {r.country}
              <span> · {t(`monthsShort.${Number(r.month.slice(5, 7))}` as never)} {r.month.slice(0, 4)}</span>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Map with the place and the nearest sights, plus the same list as text. */
export async function PlaceLocation({
  locale,
  name,
  area,
  lat,
  lng,
  attractions,
}: {
  locale: Locale;
  name: string;
  area: string;
  lat: number | null;
  lng: number | null;
  attractions: AttractionPoint[];
}) {
  const t = await getTranslations({ locale });
  if (lat == null || lng == null) return null;
  const near = attractions
    .map((a) => ({ a, km: distanceKm({ lat, lng }, { lat: a.lat!, lng: a.lng! }) }))
    .filter((x) => x.km < 40)
    .sort((x, y) => x.km - y.km)
    .slice(0, 5);
  const fmtKm = (km: number) => (km < 1 ? t("placeCommon.distanceM", { m: Math.max(50, Math.round((km * 1000) / 50) * 50) }) : t("placeCommon.distanceKm", { km: km < 10 ? km.toFixed(1) : Math.round(km) }));
  return (
    <section aria-labelledby="place-location">
      <h2 id="place-location" className="text-3xl text-lapis">
        {t("placeCommon.locationTitle")}
      </h2>
      <p className="mt-2 flex items-center gap-2 text-ink-muted">
        <MapPin aria-hidden="true" className="size-4 text-cobalt" /> {area}
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <LazyMap
          className="h-72 lg:col-span-3 lg:h-auto lg:min-h-80"
          label={t("placeCommon.mapLabel", { name })}
          loadingLabel={t("common.mapLoading")}
          attribution={t("common.mapAttribution")}
          points={[
            { lat, lng, label: name, caption: area },
            ...near.map((x, i) => ({ lat: x.a.lat!, lng: x.a.lng!, label: localize(x.a.name, locale), number: i + 1 })),
          ]}
        />
        {near.length > 0 && (
          <div className="lg:col-span-2">
            <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-ink-muted">{t("placeCommon.nearby")}</h3>
            <ol className="mt-3 space-y-3">
              {near.map((x, i) => (
                <li key={x.a.id} className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex size-8 shrink-0 rotate-45 items-center justify-center rounded-sm border-2 border-saffron bg-lapis text-sm font-bold text-white">
                    <span className="-rotate-45">{i + 1}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-lapis-deep">{localize(x.a.name, locale)}</span>
                    <span className="text-sm text-ink-muted">{fmtKm(x.km)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
