import { ArrowRight, MapPin, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SmartImage } from "@/components/common/smart-image";
import type { Place } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { priceLevelSymbol, type HotelInfo, type RestaurantInfo } from "@/lib/places/extras";

/** Amenities that tell stays apart come first on cards; near-universal ones (wifi, breakfast, AC) last. */
const CARD_PRIORITY = [
  "pool",
  "spa",
  "hammam",
  "rooftop",
  "courtyard",
  "garden",
  "mountain_view",
  "family_rooms",
  "restaurant",
  "airport_transfer",
  "gym",
  "tour_desk",
  "accessible",
  "parking",
  "laundry",
  "breakfast",
  "air_conditioning",
  "wifi",
];
const rank = (a: string) => {
  const i = CARD_PRIORITY.indexOf(a);
  return i === -1 ? CARD_PRIORITY.length : i;
};

/** Hotel or restaurant card for lists and previews. `price` is already formatted in the visitor's currency. */
export async function PlaceCard({
  place,
  locale,
  price,
  destinationName,
  headingLevel = "h3",
  compact = false,
}: {
  place: Place;
  locale: Locale;
  price?: string;
  destinationName?: string;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "placeCommon" });
  const H = headingLevel;
  const name = localize(place.name, locale);
  const isHotel = place.kind === "hotel";
  const d = place.details as HotelInfo & RestaurantInfo;
  const href = `/${isHotel ? "hotels" : "restaurants"}/${place.slug}`;
  const chips = isHotel
    ? [...(d.amenities ?? [])]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, compact ? 2 : 3)
        .map((a) => (t.has(`amenities.${a}` as never) ? t(`amenities.${a}` as never) : a))
    : (d.cuisine ?? []).slice(0, compact ? 2 : 3).map((c) => (t.has(`cuisines.${c}` as never) ? t(`cuisines.${c}` as never) : c));

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card transition-shadow duration-300 [contain:inline-size] hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage
          src={place.image}
          alt=""
          label={name}
          compact
          imgClassName="transition-transform duration-700 group-hover:scale-105"
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 100vw"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {isHotel && d.stars ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-lapis-deep shadow-sm">
              <span aria-hidden="true" className="flex">
                {Array.from({ length: d.stars }, (_, i) => (
                  <Star key={i} className="size-3 fill-saffron text-saffron" />
                ))}
              </span>
              <span className="sr-only">{t("stars", { count: d.stars })}</span>
            </span>
          ) : null}
          {!isHotel && (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-lapis-deep shadow-sm">
              <span aria-hidden="true">{priceLevelSymbol(place.priceLevel)}</span>
              <span className="sr-only">{t(`priceLevels.${place.priceLevel ?? 1}` as never)}</span>
            </span>
          )}
        </div>
        {d.rating && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-lapis-deep/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
            <Star aria-hidden="true" className="size-3.5 fill-saffron text-saffron" />
            {d.rating.score.toFixed(1)}
            <span className="font-medium text-white/75">({d.rating.count})</span>
            <span className="sr-only">
              {t("ratingSr", {
                score: d.rating.score.toFixed(1),
                count: d.rating.count,
              })}
            </span>
          </span>
        )}
      </div>
      <div className={compact ? "flex flex-1 flex-col gap-2 p-4" : "flex flex-1 flex-col gap-3 p-5 pt-4"}>
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-cobalt">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{[destinationName, localize(d.area, locale)].filter(Boolean).join(" · ")}</span>
        </p>
        <H className={compact ? "text-lg leading-snug text-lapis" : "text-xl leading-snug text-lapis"}>
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
            {name}
          </Link>
        </H>
        {!compact && <p className="line-clamp-2 text-ink-muted">{localize(place.summary, locale)}</p>}
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={isHotel ? t("amenitiesTitle") : t("cuisineTitle")}>
            {chips.map((c) => (
              <li key={c} className="rounded-full bg-sand-soft px-2.5 py-1 text-xs font-semibold text-ink">
                {c}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
          {price ? (
            <p className="leading-tight">
              <span className="block text-xs uppercase tracking-wide text-ink-muted">{t("fromLabel")}</span>
              <span className="text-xl font-extrabold text-lapis">{price}</span>
              <span className="block text-xs text-ink-muted">{isHotel ? t("perNight") : t("perPersonMeal")}</span>
            </p>
          ) : (
            <span />
          )}
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky px-3.5 py-2 text-sm font-bold text-cobalt transition-colors group-hover:bg-cobalt group-hover:text-white"
          >
            {t("view")} <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
