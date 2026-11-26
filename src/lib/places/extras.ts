// Shapes stored inside places.details next to the typed HotelDetails / RestaurantDetails / TransportDetails,
// plus small helpers shared by the hotel, restaurant and transport pages.
import type { HotelDetails, Locale, RestaurantDetails, TransportDetails } from "../../db/types";

/** A short guest review kept with the place (shown in the language it was written in). */
export interface PlaceReview {
  author: string;
  country: string;
  rating: number;
  text: string;
  lang: Locale;
  /** YYYY-MM of the stay or visit. */
  month: string;
}

export interface PlaceExtras {
  /** Average guest score out of 5 and how many guests rated the place. */
  rating?: { score: number; count: number };
  reviews?: PlaceReview[];
}

export type HotelInfo = HotelDetails & PlaceExtras;
export type RestaurantInfo = RestaurantDetails & PlaceExtras;
export type TransportInfo = TransportDetails & PlaceExtras;

/** Amenity codes with a label in placeCommon.amenities.* (anything else is shown as is). */
export const AMENITIES = [
  "wifi",
  "breakfast",
  "air_conditioning",
  "courtyard",
  "rooftop",
  "restaurant",
  "pool",
  "spa",
  "hammam",
  "gym",
  "parking",
  "airport_transfer",
  "family_rooms",
  "garden",
  "mountain_view",
  "laundry",
  "accessible",
  "tour_desk",
] as const;

export const CUISINES = ["uzbek", "khorezm", "karakalpak", "fergana", "samarkand", "bukhara", "tashkent", "european", "fusion", "bakery", "teahouse", "grill", "fish"] as const;
export const DIETARY = ["halal", "vegetarian", "vegan_options", "gluten_free_options", "alcohol_free", "kids_menu"] as const;

/** "$$" for a 1–4 price level. */
export const priceLevelSymbol = (level: number | null | undefined): string => "$".repeat(Math.min(4, Math.max(1, level ?? 1)));

/** Whole nights between two ISO dates (0 when invalid). */
export function nightsBetween(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86400_000);
}
