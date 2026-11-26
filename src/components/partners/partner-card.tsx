import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { monogram } from "@/lib/partners";

const TONES = [
  "bg-lapis text-white ring-saffron/70",
  "bg-saffron-soft text-saffron-ink ring-saffron/50",
  "bg-sky text-cobalt ring-lapis-mist",
  "bg-lapis-deep text-saffron ring-saffron/60",
  "bg-white text-lapis ring-lapis-mist",
] as const;

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Initials in a framed tile (an emblem-style "logo" for partners without an uploaded logo). */
export function PartnerMonogram({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-2xl font-display font-extrabold tracking-[0.04em] ring-2 ring-inset",
        size === "sm" && "size-11 text-sm",
        size === "md" && "size-14 text-lg",
        size === "lg" && "size-20 text-2xl sm:size-24 sm:text-3xl",
        TONES[hash(name) % TONES.length],
        className,
      )}
    >
      <span className="absolute inset-1 rounded-[0.8rem] border border-current opacity-20" />
      {monogram(name)}
    </span>
  );
}

export interface PartnerCardData {
  slug: string;
  businessName: string;
  typeLabel: string;
  city: string | null;
  description: string;
  /** Up to two short service lines with prices, already formatted. */
  highlights: { name: string; price: string }[];
}

export function PartnerCard({ partner, cta, headingLevel = "h3" }: { partner: PartnerCardData; cta: string; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <Link
      href={`/partners/${partner.slug}`}
      className="group flex h-full flex-col rounded-[1.25rem] bg-white p-5 shadow-card ring-1 ring-line/60 transition hover:-translate-y-0.5 hover:shadow-lift"
      data-testid="partner-card"
    >
      <div className="flex items-start gap-4">
        <PartnerMonogram name={partner.businessName} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-saffron-ink">{partner.typeLabel}</p>
          <H className="mt-1 text-lg leading-snug text-lapis [overflow-wrap:anywhere] group-hover:text-cobalt">{partner.businessName}</H>
          {partner.city && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted">
              <MapPin aria-hidden="true" className="size-3.5 text-cobalt" /> {partner.city}
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-[0.95rem] text-ink/80">{partner.description}</p>
      {partner.highlights.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
          {partner.highlights.map((h) => (
            <li key={h.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-ink">{h.name}</span>
              <span className="max-w-[58%] shrink-0 text-right font-semibold text-lapis">{h.price}</span>
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-cobalt">
        {cta} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
