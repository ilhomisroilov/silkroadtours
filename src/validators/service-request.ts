import { z } from "zod";
import { contactFields, futureDate, slug } from "./common";

export const AIRPORTS = ["TAS", "SKD", "BHK", "UGC", "NCU", "FEG", "NMA", "TMJ"] as const;
export const VEHICLE_CLASSES = ["sedan", "minivan", "minibus", "bus"] as const;
export const ACCOMMODATION_LEVELS = ["budget", "comfort", "boutique", "luxury"] as const;
export const INTERESTS = [
  "architecture",
  "history",
  "crafts",
  "gastronomy",
  "nature",
  "trekking",
  "yurt_camp",
  "photography",
  "religious_heritage",
  "wine",
] as const;
export const GUIDE_LANGUAGES = ["en", "ru", "uz", "fr", "de", "es", "it", "ja", "zh", "ko", "tr"] as const;

const airportTransfer = contactFields.extend({
  type: z.literal("airport_transfer"),
  airport: z.enum(AIRPORTS),
  direction: z.enum(["arrival", "departure", "round_trip"]),
  flightNumber: z.string().trim().max(12).optional(),
  date: futureDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "invalid_time" }),
  passengers: z.number().int().min(1).max(50),
  luggage: z.number().int().min(0).max(100),
  address: z.string().trim().min(3).max(300),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  notes: z.string().trim().max(1000).optional(),
});

const customTour = contactFields
  .extend({
    type: z.literal("custom_tour"),
    startDate: futureDate,
    endDate: futureDate,
    adults: z.number().int().min(1).max(60),
    children: z.number().int().min(0).max(40),
    destinationSlugs: z.array(slug).min(1).max(9),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
    accommodationLevel: z.enum(ACCOMMODATION_LEVELS),
    budgetPerPersonUsd: z.number().int().min(0).max(100_000).optional(),
    notes: z.string().trim().max(3000).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { error: "end_before_start", path: ["endDate"] });

const accommodation = contactFields
  .extend({
    type: z.literal("accommodation"),
    kind: z.enum(["hotel", "yurt_camp", "guesthouse"]),
    destinationSlug: slug,
    checkIn: futureDate,
    checkOut: futureDate,
    rooms: z.number().int().min(1).max(30),
    guests: z.number().int().min(1).max(100),
    level: z.enum(ACCOMMODATION_LEVELS),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { error: "checkout_before_checkin", path: ["checkOut"] });

const guide = contactFields.extend({
  type: z.literal("guide"),
  language: z.enum(GUIDE_LANGUAGES),
  destinationSlug: slug,
  date: futureDate,
  days: z.number().int().min(1).max(30),
  groupSize: z.number().int().min(1).max(60),
  notes: z.string().trim().max(1000).optional(),
});

/** POST /api/service-requests — the `type` field selects the form. */
export const serviceRequestSchema = z.discriminatedUnion("type", [
  airportTransfer,
  customTour,
  accommodation,
  guide,
]);

export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;
export const serviceRequestSchemas = { airportTransfer, customTour, accommodation, guide };
