import {
  Accessibility,
  BadgeCheck,
  Bath,
  Car,
  Coffee,
  Dumbbell,
  Flower2,
  Map as MapIcon,
  Mountain,
  Plane,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Trees,
  Users,
  UtensilsCrossed,
  Waves,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  breakfast: Coffee,
  air_conditioning: Snowflake,
  courtyard: Flower2,
  rooftop: Sun,
  restaurant: UtensilsCrossed,
  pool: Waves,
  spa: Sparkles,
  hammam: Bath,
  gym: Dumbbell,
  parking: Car,
  airport_transfer: Plane,
  family_rooms: Users,
  garden: Trees,
  mountain_view: Mountain,
  laundry: Shirt,
  accessible: Accessibility,
  tour_desk: MapIcon,
};

export async function AmenityList({ locale, amenities, className }: { locale: Locale; amenities: string[]; className?: string }) {
  const t = await getTranslations({ locale, namespace: "placeCommon" });
  return (
    <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3", className)}>
      {amenities.map((a) => {
        const Icon = ICONS[a] ?? BadgeCheck;
        return (
          <li key={a} className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-white px-2.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky text-cobalt sm:size-9">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 text-sm font-semibold text-ink hyphens-auto [overflow-wrap:break-word] sm:text-base">{t.has(`amenities.${a}` as never) ? t(`amenities.${a}` as never) : a}</span>
          </li>
        );
      })}
    </ul>
  );
}
