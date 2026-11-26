import { CalendarDays, MapPin, Star, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { TourCard as TourCardData } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { SmartImage } from "@/components/common/smart-image";
import { Badge } from "@/components/ui/misc";

const BADGE_TONE: Record<string, "saffron" | "turquoise" | "terracotta" | "pomegranate" | "lapis" | "sand"> = {
  best_seller: "saffron",
  eco_camp: "turquoise",
  weekend_trip: "lapis",
  discount: "pomegranate",
  new: "terracotta",
  family_friendly: "sand",
  small_group: "sand",
};

export async function TourCard({ tour, locale, priority = false }: { tour: TourCardData; locale: Locale; priority?: boolean }) {
  const t = await getTranslations({ locale });
  const title = localize(tour.title, locale);
  const destination = localize(tour.destination.name, locale);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card transition-shadow duration-300 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden px-3 pt-3">
        <div className="arch-mask-wide h-full w-full overflow-hidden">
          <SmartImage
            src={tour.heroImage}
            alt=""
            label={destination}
            priority={priority}
            imgClassName="transition-transform duration-700 group-hover:scale-105"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        </div>
        {tour.badges.length > 0 && (
          <ul className="absolute left-5 top-14 flex flex-wrap gap-1.5" aria-label={t("tour.highlights")}>
            {tour.badges.slice(0, 2).map((b) => (
              <li key={b}>
                <Badge tone={BADGE_TONE[b] ?? "sand"}>{t(`badges.${b}` as never)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-turquoise-ink">
          <MapPin aria-hidden="true" className="size-4" />
          {destination}
          <span aria-hidden="true" className="text-line">•</span>
          <span className="text-ink-muted">{t(`categories.${tour.category}` as never)}</span>
        </p>
        <h3 className="text-2xl leading-tight text-lapis-deep">
          <Link href={`/tours/${tour.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
            {title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-ink-muted">{localize(tour.summary, locale)}</p>
        <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4 text-lapis" />
            {t("common.days", { count: tour.durationDays })}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4 text-lapis" />
            {t("common.groupSize", { min: tour.minGroup, max: tour.maxGroup })}
          </li>
          {tour.ratingCount > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <Star aria-hidden="true" className="size-4 fill-saffron text-saffron" />
              <span>
                {tour.ratingAvg.toFixed(1)} <span className="text-ink-muted">({t("common.reviewsCount", { count: tour.ratingCount })})</span>
              </span>
            </li>
          )}
        </ul>
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          {tour.fromPrice ? (
            <p className="leading-tight" data-testid="tour-card-price">
              <span className="block text-xs uppercase tracking-wide text-ink-muted">{t("common.from")}</span>
              {tour.compareAtPrice && tour.compareAtPrice.amountMinor > tour.fromPrice.amountMinor && (
                <s className="mr-2 text-sm text-ink-muted">{formatMoney(tour.compareAtPrice.amountMinor, tour.compareAtPrice.currency, locale)}</s>
              )}
              <span className="text-xl font-bold text-ink">{formatMoney(tour.fromPrice.amountMinor, tour.fromPrice.currency, locale)}</span>
              <span className="ml-1 text-sm text-ink-muted">{t("common.perPerson")}</span>
            </p>
          ) : (
            <p className="text-sm text-ink-muted">{t("tours.noPrice")}</p>
          )}
          <span aria-hidden="true" className="text-sm font-semibold text-terracotta-deep group-hover:underline">
            {t("common.viewTour")} →
          </span>
        </div>
      </div>
    </article>
  );
}
