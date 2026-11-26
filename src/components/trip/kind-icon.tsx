import { BedDouble, Bus, Car, Flag, Landmark, Plane, Sparkles, TrainFront, Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { KIND_COLORS } from "@/lib/trip-helpers";
import type { TripItemKind } from "@/lib/trip-store";

export const KIND_ICONS: Record<TripItemKind, LucideIcon> = {
  hotel: BedDouble,
  restaurant: Utensils,
  attraction: Landmark,
  experience: Sparkles,
  activity: Sparkles,
  tour: Flag,
  train: TrainFront,
  flight: Plane,
  transfer: Car,
  transport: Bus,
};

/** Round, colour-coded icon for a trip item kind (decorative; the kind is always also written as text nearby). */
export function KindIcon({ kind, className, color }: { kind: TripItemKind; className?: string; color?: string }) {
  const Icon = KIND_ICONS[kind] ?? Landmark;
  return (
    <span aria-hidden="true" className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white", className)} style={{ background: color ?? KIND_COLORS[kind] }}>
      <Icon className="size-[1.1rem]" />
    </span>
  );
}
