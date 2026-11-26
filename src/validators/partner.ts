import { z } from "zod";
import { LOCALES, PARTNER_STATUSES, PARTNER_TYPES } from "../db/types";
import { SERVICE_UNITS } from "../lib/partners";
import { phone, slug } from "./common";

/**
 * Partner ecosystem validators. Error messages are codes: the partner forms translate them from
 * "partnersPage.errors.*" first and fall back to the shared "errors.*" dictionary.
 */

export const partnerServiceSchema = z.object({
  name: z.string().trim().min(2, { error: "service_name_too_short" }).max(120),
  priceFromUsd: z.number().int().min(0).max(100_000).nullable(),
  unit: z.enum(SERVICE_UNITS).nullable(),
});
export type PartnerServiceInput = z.infer<typeof partnerServiceSchema>;

const services = z.array(partnerServiceSchema).min(1, { error: "services_required" }).max(20);
const description = z.string().trim().min(30, { error: "description_too_short" }).max(2000);

/** Accepts "example.com" or a full http(s) URL; empty means no website. */
const website = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, { error: "invalid_url" })
  .transform((v) => v || null);

const businessFields = {
  type: z.enum(PARTNER_TYPES),
  businessName: z.string().trim().min(2, { error: "business_name_too_short" }).max(120),
  contactName: z.string().trim().min(2, { error: "name_too_short" }).max(120),
  email: z.email({ error: "invalid_email" }).max(200).transform((v) => v.toLowerCase()),
  phone,
  website: website.optional().transform((v) => v ?? null),
  destinationSlug: z.union([slug, z.literal("")]).optional().transform((v) => v || null),
  city: z.string().trim().min(2, { error: "city_required" }).max(80),
  description,
  services,
};

/** POST /api/partners — a business applies to join the network. */
export const partnerApplicationSchema = z.object({
  ...businessFields,
  locale: z.enum(LOCALES),
  consent: z.literal(true, { error: "consent_required" }),
  /** Cloudflare Turnstile token, verified server-side before insert. */
  turnstileToken: z.string().min(1, { error: "captcha_required" }),
});
export type PartnerApplicationInput = z.infer<typeof partnerApplicationSchema>;

const reference = z.string().trim().toUpperCase().regex(/^PA-[A-Z0-9]{2,12}(?:-[A-Z0-9]{2,12})?$/, { error: "invalid_reference" });
const token = z.string().trim().min(8).max(128);

/** Dashboard lookup (query string). */
export const partnerCredentialsSchema = z.object({ ref: reference, token });

/** PATCH /api/partners/dashboard — the partner edits the listing while it is under review. */
export const partnerSelfUpdateSchema = z.object({ reference, token, description, services });

/** PATCH /api/admin/partners/[id] — business info and services. */
export const partnerAdminUpdateSchema = z
  .object({
    ...businessFields,
    locale: z.enum(LOCALES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { error: "nothing_to_update" });

/** POST /api/admin/partners/[id]/review — approve, reject or send back to review. */
export const partnerReviewSchema = z.object({
  status: z.enum(PARTNER_STATUSES),
  adminNote: z.string().trim().max(2000).optional().transform((v) => v || null),
});

/** POST /api/admin/partners/[id]/places — link or unlink a hotel, restaurant or transport listing. */
export const partnerPlaceLinkSchema = z.object({
  placeId: z.number().int().positive(),
  action: z.enum(["link", "unlink"]),
});

export const partnerListQuerySchema = z.object({
  status: z.enum(PARTNER_STATUSES).optional(),
  type: z.enum(PARTNER_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type PartnerListQuery = z.infer<typeof partnerListQuerySchema>;
