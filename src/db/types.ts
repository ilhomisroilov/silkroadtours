// Domain enums and JSON column shapes shared by the DB schema, validators and UI.
// Kept dependency-free (and alias-free) so drizzle-kit can load it directly.

export const LOCALES = ["en", "uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const CURRENCIES = ["USD", "UZS", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const AUDIENCES = ["inbound", "domestic"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const TOUR_CATEGORIES = [
  "cultural",
  "eco",
  "yurt_camp",
  "trekking",
  "city",
  "weekend",
  "family",
  "corporate",
  "resort",
  "gastronomy",
] as const;
export type TourCategory = (typeof TOUR_CATEGORIES)[number];

export const TOUR_BADGES = [
  "best_seller",
  "eco_camp",
  "weekend_trip",
  "discount",
  "new",
  "family_friendly",
  "small_group",
] as const;
export type TourBadge = (typeof TOUR_BADGES)[number];

export const DIFFICULTIES = ["easy", "moderate", "challenging"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const BOOKING_TYPES = ["group", "private"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const DEPARTURE_STATUSES = ["open", "guaranteed", "sold_out", "cancelled"] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const CONTACT_CHANNELS = ["whatsapp", "telegram", "phone", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const SERVICE_TYPES = ["airport_transfer", "custom_tour", "accommodation", "guide"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const MEALS = ["B", "L", "D"] as const;
export type Meal = (typeof MEALS)[number];

export const ACCOMMODATION_TYPES = [
  "yurt_camp",
  "guesthouse",
  "homestay",
  "boutique_hotel",
  "hotel",
  "resort",
  "tent",
] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export const TRANSPORT_MODES = [
  "private_car",
  "minivan",
  "bus",
  "afrosiyob_train",
  "regular_train",
  "domestic_flight",
  "4x4",
  "camel",
  "horse",
  "walking",
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const REVIEW_SOURCES = ["site", "google", "tripadvisor"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const FAQ_CATEGORIES = [
  "visa",
  "currency",
  "transport",
  "dress_code",
  "safety",
  "health",
  "general",
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const ADMIN_ROLES = ["owner", "editor"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const NOTE_KINDS = ["note", "status_change"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

// ── JSON column shapes ─────────────────────────────────────────────────────

/** Every customer-facing string is stored in all three languages. */
export type LocalizedText = Record<Locale, string>;

export interface Attraction {
  name: LocalizedText;
  description: LocalizedText;
  image?: string;
  lat?: number;
  lng?: number;
}

export interface MediaItem {
  url: string;
  type: "image" | "video";
  alt: LocalizedText;
  /** Poster frame for videos. */
  poster?: string;
}

export interface AccommodationItem {
  type: AccommodationType;
  name: LocalizedText;
  /** e.g. "Standard yurt (4–5 guests)", "Deluxe yurt with private bath". */
  tier?: LocalizedText;
  nights: number;
}

export interface TransportItem {
  mode: TransportMode;
  description: LocalizedText;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  label: LocalizedText;
  /** Day of the itinerary this stop belongs to. */
  day?: number;
}

// ── Settings (key/value table) ─────────────────────────────────────────────

/** Units of each currency per 1 USD, in major units (e.g. UZS: 12650). */
export interface ExchangeRates {
  base: "USD";
  rates: Record<Currency, number>;
  updatedAt: string;
  source: "manual" | "cbu";
}

export interface ContactSettings {
  agencyName: string;
  phone: string;
  email: string;
  whatsapp: string;
  telegram: string;
  address: LocalizedText;
  licenseNumber: string;
}

export interface SettingsMap {
  exchange_rates: ExchangeRates;
  contact: ContactSettings;
}
export type SettingKey = keyof SettingsMap;
