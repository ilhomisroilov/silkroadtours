import { BadgeDollarSign, Clock, MapPin } from "lucide-react";
import { SmartImage } from "@/components/common/smart-image";
import type { ContentItem } from "@/db/queries/content";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";

/** Card for one experience (cooking class, craft workshop, photo walk…). Labels are pre-translated by the page. */
export function ExperienceCard({
  item,
  locale,
  hours,
  price,
  place,
  headingLevel = "h3",
}: {
  item: ContentItem;
  locale: Locale;
  hours?: string;
  price?: string;
  place?: string;
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  const title = localize(item.title, locale);
  return (
    <Link href={`/experiences/${item.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage src={item.image} alt="" label={title} compact sizes="(min-width: 1024px) 25vw, 50vw" imgClassName="transition-transform duration-700 group-hover:scale-105" />
        {place && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-lapis shadow-sm">
            <MapPin aria-hidden="true" className="size-3.5 text-cobalt" />
            {place}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {hours && (
            <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="size-4 text-cobalt" />{hours}</span>
          )}
          {price && (
            <span className="inline-flex items-center gap-1"><BadgeDollarSign aria-hidden="true" className="size-4 text-cobalt" />{price}</span>
          )}
        </p>
        <H className="mt-2 text-lg leading-snug text-lapis group-hover:text-cobalt">{title}</H>
        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{localize(item.excerpt, locale)}</p>
      </div>
    </Link>
  );
}
