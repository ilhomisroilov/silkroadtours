import { BadgeCheck, ExternalLink, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { listPublishedReviews } from "@/db/queries/reviews";
import type { Locale } from "@/db/types";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/format";

type Reviews = Awaited<ReturnType<typeof listPublishedReviews>>;

export function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className={cn("size-4", i < Math.round(rating) ? "fill-saffron text-saffron" : "text-line")} />
      ))}
    </span>
  );
}

/** Real, published reviews only (from the reviews table). Rendered only when at least one exists. */
export async function ReviewList({ reviews, locale, className }: { reviews: Reviews; locale: Locale; className?: string }) {
  const t = await getTranslations({ locale });
  if (reviews.total === 0) return null;
  return (
    <div className={className}>
      <p className="flex items-center gap-3 text-lg">
        <Stars rating={reviews.average} label={t("common.ratingOutOf", { rating: reviews.average.toFixed(1) })} />
        <span className="font-semibold">{reviews.average.toFixed(1)}</span>
        <span className="text-ink-muted">· {t("common.reviewsCount", { count: reviews.total })}</span>
      </p>
      <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reviews.items.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
            <Stars rating={r.rating} label={t("common.ratingOutOf", { rating: r.rating })} />
            {r.title && <h3 className="text-xl text-lapis-deep" lang={r.language}>{r.title}</h3>}
            <blockquote className="text-ink" lang={r.language}>
              <p className="line-clamp-6">{r.body}</p>
            </blockquote>
            <footer className="mt-auto text-sm text-ink-muted">
              <span className="font-semibold text-ink">{r.authorName}</span>
              {r.authorCountry && <span>, {r.authorCountry}</span>}
              {r.travelDate && <span> · {formatDateLabel(r.travelDate, (m) => t(`monthsShort.${m}` as never))}</span>}
              <span className="mt-1 flex flex-wrap items-center gap-2">
                {r.isVerified && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <BadgeCheck aria-hidden="true" className="size-4" /> {t("common.verified")}
                  </span>
                )}
                {r.sourceUrl && (
                  <a href={r.sourceUrl} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-cobalt underline">
                    {r.source === "google" ? "Google" : r.source === "tripadvisor" ? "Tripadvisor" : "Source"}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                )}
              </span>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  );
}
