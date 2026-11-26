import { z } from "zod";
import { AUDIENCES, CURRENCIES, FAQ_CATEGORIES, LOCALES, TOUR_CATEGORIES } from "../db/types";
import { slug } from "./common";

export const TOUR_SORTS = ["featured", "price_asc", "price_desc", "duration_asc", "duration_desc", "rating"] as const;
export type TourSort = (typeof TOUR_SORTS)[number];

/** GET /api/tours */
export const tourListQuerySchema = z.object({
  audience: z.enum(AUDIENCES).optional(),
  destination: slug.optional(),
  category: z.enum(TOUR_CATEGORIES).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  guests: z.coerce.number().int().min(1).max(200).optional(),
  maxDays: z.coerce.number().int().min(1).max(60).optional(),
  featured: z.enum(["1", "true"]).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(TOUR_SORTS).default("featured"),
  currency: z.enum(CURRENCIES).default("USD"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type TourListQuery = z.infer<typeof tourListQuerySchema>;

export const currencyQuerySchema = z.object({
  currency: z.enum(CURRENCIES).default("USD"),
});

/** GET /api/reviews */
export const reviewListQuerySchema = z.object({
  tour: slug.optional(),
  destination: slug.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

/** POST /api/reviews — guests review a completed booking. */
export const reviewSubmitSchema = z.object({
  reference: z.string().trim().regex(/^UZ-\d{4}-\d{5}$/, { error: "invalid_reference" }),
  email: z.email({ error: "invalid_email" }).transform((v) => v.toLowerCase()),
  authorName: z.string().trim().min(2).max(80).optional(),
  authorCountry: z.string().trim().max(80).optional(),
  rating: z.number().int().min(1, { error: "rating_range" }).max(5, { error: "rating_range" }),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, { error: "review_too_short" }).max(3000),
  language: z.enum(LOCALES),
  turnstileToken: z.string().min(1, { error: "captcha_required" }),
});
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;

/** GET /api/faq */
export const faqQuerySchema = z.object({
  category: z.enum(FAQ_CATEGORIES).optional(),
});
