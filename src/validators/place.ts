import { z } from "zod";
import { PLACE_KINDS, PLACE_SOURCES } from "../db/types";
import { localizedLong, mediaUrl } from "./admin";
import { slug } from "./common";

/** Admin create/update of hotels, restaurants and transport options (places table). */

const text = (max: number) => z.string().trim().max(max);
/** Optional localized line (area, hours, schedule note): any language may be empty. */
const localizedLoose = z.object({ en: text(300), uz: text(300), ru: text(300) });
const localizedName = z.object({ en: z.string().trim().min(1).max(160), uz: text(160), ru: text(160) });

/** Short machine keys such as "wifi", "air_conditioning", "halal" (lower-case, no spaces). */
const key = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/\s+/g, "_"))
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, { error: "invalid_key" }));
const keyList = (max: number) =>
  z
    .array(key)
    .max(max)
    .transform((a) => [...new Set(a)]);

const usd = z.number().int().min(0).max(100_000);
const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "invalid_time" })
  .optional()
  .or(z.literal("").transform(() => undefined));

export const hotelDetailsSchema = z.object({
  area: localizedLoose,
  stars: z.number().int().min(1).max(5).optional(),
  amenities: keyList(40),
  roomTypes: z.array(z.object({ name: localizedName, sleeps: z.number().int().min(1).max(20), priceFromUsd: usd })).max(20),
  checkIn: time,
  checkOut: time,
});

export const restaurantDetailsSchema = z.object({
  area: localizedLoose,
  cuisine: keyList(20),
  dietary: keyList(20),
  hours: localizedLoose,
  menu: z.array(z.object({ name: localizedName, priceUsd: z.number().min(0).max(10_000) })).max(40),
});

export const TRANSPORT_DETAIL_MODES = ["train", "flight", "bus", "shared_taxi", "taxi", "transfer", "metro", "car"] as const;

export const transportDetailsSchema = z.object({
  mode: z.enum(TRANSPORT_DETAIL_MODES),
  from: z.string().trim().min(1).max(80),
  to: z.string().trim().min(1).max(80),
  durationMin: z.number().int().min(1).max(10_000),
  operator: text(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  scheduleNote: localizedLoose,
  classes: z.array(z.object({ name: localizedName, priceFromUsd: usd })).max(12).optional(),
});

const base = z.object({
  slug,
  destinationSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,80}$/)
    .nullable()
    .or(z.literal("").transform(() => null)),
  name: localizedName,
  summary: localizedLong,
  description: localizedLong,
  image: mediaUrl.nullable().or(z.literal("").transform(() => null)),
  gallery: z.array(mediaUrl).max(24),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  priceFromUsd: usd.nullable(),
  priceLevel: z.number().int().min(1).max(4).nullable(),
  tags: keyList(20),
  partnerId: z.number().int().positive().nullable(),
  isPublished: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const placeUpsertSchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("hotel"), details: hotelDetailsSchema }),
  base.extend({ kind: z.literal("restaurant"), details: restaurantDetailsSchema }),
  base.extend({ kind: z.literal("transport"), details: transportDetailsSchema }),
]);
export type PlaceUpsertInput = z.output<typeof placeUpsertSchema>;

/** Quick actions from the list: publish toggle and sort order. */
export const placePatchSchema = z
  .object({
    isPublished: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((v) => v.isPublished !== undefined || v.sortOrder !== undefined, { error: "nothing_to_update" });

export const placeListQuerySchema = z.object({
  kind: z.enum(PLACE_KINDS).default("hotel"),
  destination: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional(),
  q: z.string().trim().max(100).optional(),
  published: z.enum(["true", "false"]).optional(),
  source: z.enum(PLACE_SOURCES).optional(),
});
export type PlaceListQuery = z.output<typeof placeListQuerySchema>;
