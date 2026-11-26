import { z } from "zod";
import { AUDIENCES, BOOKING_TYPES, CURRENCIES } from "../db/types";
import { contactFields, futureDate, slug } from "./common";

/** POST /api/bookings */
export const bookingInputSchema = contactFields
  .extend({
    tourSlug: slug.optional(),
    /** Used for "enquire about this destination" when no specific tour is chosen. */
    destinationSlug: slug.optional(),
    departureId: z.number().int().positive().optional(),
    bookingType: z.enum(BOOKING_TYPES),
    /** Only used for destination-only enquiries; for tours the audience comes from the tour. */
    audience: z.enum(AUDIENCES).optional(),
    country: z.string().trim().max(80).optional(),
    preferredDate: futureDate,
    adults: z.number().int().min(1, { error: "min_one_adult" }).max(60),
    children: z.number().int().min(0).max(40),
    specialRequests: z.string().trim().max(2000).optional(),
    currency: z.enum(CURRENCIES),
    utmSource: z.string().trim().max(100).optional(),
  })
  .refine((d) => d.tourSlug || d.destinationSlug, {
    error: "tour_or_destination_required",
    path: ["tourSlug"],
  });

export type BookingInput = z.infer<typeof bookingInputSchema>;

/** GET /api/tours/[slug]/quote query string */
export const quoteQuerySchema = z.object({
  adults: z.coerce.number().int().min(1).max(60),
  children: z.coerce.number().int().min(0).max(40).default(0),
  type: z.enum(BOOKING_TYPES).default("group"),
  currency: z.enum(CURRENCIES).default("USD"),
  departureId: z.coerce.number().int().positive().optional(),
});

export type QuoteQuery = z.infer<typeof quoteQuerySchema>;
