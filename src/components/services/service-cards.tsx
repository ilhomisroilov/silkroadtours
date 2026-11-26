import { BedDouble, Compass, Languages, PlaneLanding } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";

export const SERVICE_SLUGS = ["airport-transfer", "tailor-made", "accommodation", "guides"] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];
const ICON = { "airport-transfer": PlaneLanding, "tailor-made": Compass, accommodation: BedDouble, guides: Languages };

export async function ServiceCards({ locale, exclude }: { locale: Locale; exclude?: ServiceSlug }) {
  const t = await getTranslations({ locale, namespace: "services" });
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICE_SLUGS.filter((s) => s !== exclude).map((s) => {
        const Icon = ICON[s];
        return (
          <li key={s}>
            <Link
              href={`/services/${s}`}
              className="group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-t-full rounded-b-lg bg-lapis text-saffron">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="font-display text-2xl font-semibold text-lapis-deep group-hover:underline">{t(`${s}.title`)}</span>
              <span className="text-ink-muted">{t(`${s}.short`)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
