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

export const SERVICE_TYPES = ["airport_transfer", "custom_tour", "accommodation", "guide", "inquiry"] as const;
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

/** "sample" marks seeded example reviews: admin-only, never shown on the public site. */
export const REVIEW_SOURCES = ["site", "google", "tripadvisor", "sample"] as const;
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

// ── Travel ecosystem: places, partners, CRM ────────────────────────────────

/** Bookable or listable services the agency arranges (attractions come from destinations.attractions). */
export const PLACE_KINDS = ["hotel", "restaurant", "transport"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** Where a place row came from. "seed" rows are the starter catalogue; "partner" rows were submitted by a partner. */
export const PLACE_SOURCES = ["seed", "admin", "partner"] as const;
export type PlaceSource = (typeof PLACE_SOURCES)[number];

export const PARTNER_TYPES = ["hotel", "restaurant", "transport", "tour_operator", "guide", "museum", "attraction", "experience"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_STATUSES = ["pending", "approved", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** "application" = submitted on /partners; "sample" = internal example profile (admin only, never public). */
export const PARTNER_SOURCES = ["application", "admin", "sample"] as const;
export type PartnerSource = (typeof PARTNER_SOURCES)[number];

export const LEAD_STAGES = ["new", "contacted", "qualified", "offer_sent", "negotiation", "confirmed", "completed", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = ["booking", "request", "trip", "partner", "contact", "admin"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_KINDS = ["created", "note", "stage", "assign", "follow_up", "call", "email"] as const;
export type LeadActivityKind = (typeof LEAD_ACTIVITY_KINDS)[number];

/** Per-kind details of a place (JSON column). Prices are indicative USD; nothing here is live availability. */
export interface HotelDetails {
  area: LocalizedText;
  stars?: number;
  amenities: string[];
  roomTypes: { name: LocalizedText; sleeps: number; priceFromUsd: number }[];
  checkIn?: string;
  checkOut?: string;
}
export interface RestaurantDetails {
  area: LocalizedText;
  cuisine: string[];
  dietary: string[];
  /** Typical opening hours, e.g. "11:00–23:00". */
  hours: LocalizedText;
  menu: { name: LocalizedText; priceUsd: number }[];
}
export interface TransportDetails {
  mode: "train" | "flight" | "bus" | "shared_taxi" | "taxi" | "transfer" | "metro" | "car";
  from: string;
  to: string;
  durationMin: number;
  operator?: string;
  /** e.g. "Several departures daily; check railway.uz for live times". */
  scheduleNote: LocalizedText;
  classes?: { name: LocalizedText; priceFromUsd: number }[];
}
export type PlaceDetails = HotelDetails | RestaurantDetails | TransportDetails;

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
