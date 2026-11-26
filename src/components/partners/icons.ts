import { BedDouble, CarFront, Compass, Flag, Landmark, Palette, Telescope, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { PartnerType } from "@/db/types";

export const PARTNER_TYPE_ICONS: Record<PartnerType, LucideIcon> = {
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  transport: CarFront,
  tour_operator: Compass,
  guide: Flag,
  museum: Landmark,
  attraction: Telescope,
  experience: Palette,
};
