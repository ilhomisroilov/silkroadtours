import { z } from "zod";
import { LOCALES } from "../db/types";
import { MAX_TRIP_DAYS, MAX_TRIP_DESTINATIONS, MAX_TRIP_ITEMS, PRICE_UNITS, TRIP_ITEM_KINDS } from "../lib/trip-helpers";
import { isoDate } from "./common";

const slugish = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
/** Optional fields are lenient: a malformed value is dropped instead of failing the whole save. */
const opt = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const tripItemSchema = z.object({
  id: z.string().trim().min(1).max(160),
  kind: z.enum(TRIP_ITEM_KINDS),
  title: z.string().trim().min(1).max(200),
  refSlug: opt(z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/)),
  destinationSlug: opt(slugish),
  priceUsd: opt(z.number().min(0).max(100_000)),
  priceUnit: opt(z.enum(PRICE_UNITS)),
  lat: opt(z.number().min(-90).max(90)),
  lng: opt(z.number().min(-180).max(180)),
  day: opt(z.number().int().min(1).max(MAX_TRIP_DAYS)),
  meta: opt(z.string().trim().max(200)),
  image: opt(z.string().max(500).regex(/^(\/(?!\/)|https:\/\/)[^\s"'<>]*$/)),
});

export const tripStateSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().max(120).catch(""),
    destinations: z.array(slugish).max(MAX_TRIP_DESTINATIONS + 1),
    startDate: opt(isoDate),
    endDate: opt(isoDate),
    adults: z.number().int().min(1).max(60),
    children: z.number().int().min(0).max(40),
    items: z
      .array(tripItemSchema)
      .max(MAX_TRIP_ITEMS)
      .refine((xs) => new Set(xs.map((x) => x.id)).size === xs.length, { error: "duplicate_items" }),
    notes: opt(z.string().trim().max(2000)),
  })
  .refine((t) => t.items.length > 0 || t.destinations.length > 0, { error: "empty_trip", path: ["items"] });

/** POST /api/trips */
export const tripSaveSchema = z.object({
  trip: tripStateSchema,
  locale: z.enum(LOCALES),
  includeMeals: z.boolean().default(true),
});

export type TripSaveInput = z.output<typeof tripSaveSchema>;

/** Saved Trip Constructor snapshots: "t" + 15 lowercase letters/digits (fits the custom tour form's tripId). */
export const TRIP_ID_RE = /^t[a-z0-9]{15}$/;
