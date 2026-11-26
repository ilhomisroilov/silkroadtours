import {
  ArrowRight,
  BedDouble,
  Briefcase,
  Camera,
  Car,
  FileText,
  Languages,
  Plane,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listContent } from "@/db/queries/content";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { db } from "@/lib/server/site";

/** Request forms that have their own page under /services/<slug> (kept for old links). */
export const SERVICE_SLUGS = ["airport-transfer", "tailor-made", "accommodation", "guides"] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  plane: Plane,
  car: Car,
  guide: Languages,
  hotel: BedDouble,
  train: TrainFront,
  flight: PlaneTakeoff,
  document: FileText,
  briefcase: Briefcase,
  camera: Camera,
  shield: ShieldCheck,
};

/** Travel services managed in the admin (Content → Services), as cards linking to their request page. */
export async function ServiceCards({ locale, exclude, limit }: { locale: Locale; exclude?: string; limit?: number }) {
  const t = await getTranslations({ locale });
  const items = (await listContent(db(), "service")).filter((s) => s.slug !== exclude).slice(0, limit);
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((s) => {
        const Icon = (s.icon && SERVICE_ICONS[s.icon]) || Sparkles;
        return (
          <li key={s.slug}>
            <Link
              href={`/services/${s.slug}`}
              className="group flex h-full flex-col gap-3 rounded-[1.25rem] bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-sky text-cobalt transition-colors group-hover:bg-cobalt group-hover:text-white">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="text-lg font-extrabold leading-snug text-lapis">{localize(s.title, locale)}</span>
              <span className="line-clamp-3 text-sm text-ink-muted">{localize(s.excerpt, locale)}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-cobalt">
                {t("nt.servicesPage.request")} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
