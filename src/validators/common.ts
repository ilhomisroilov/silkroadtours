import { z } from "zod";
import { CONTACT_CHANNELS, LOCALES } from "../db/types";

/** Error messages are i18n keys (messages/*.json → "validation.*"), translated in the form UI. */

export const isoDate = z.iso.date({ error: "invalid_date" });

/** A date in Uzbekistan local time (UTC+5) that is today or later. */
export function todayInTashkent(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}
export const futureDate = isoDate.refine((d) => d >= todayInTashkent(), { error: "date_in_past" });

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, { error: "invalid_phone" })
  .transform((v) => v.replace(/[\s\-()]/g, ""));

export const contactFields = z.object({
  fullName: z.string().trim().min(2, { error: "name_too_short" }).max(120),
  email: z.email({ error: "invalid_email" }).max(200).transform((v) => v.toLowerCase()),
  phone,
  contactChannel: z.enum(CONTACT_CHANNELS),
  /** @username for Telegram, number for WhatsApp if different from phone. */
  messengerHandle: z.string().trim().max(64).optional(),
  locale: z.enum(LOCALES),
  /** Cloudflare Turnstile token, verified server-side before insert. */
  turnstileToken: z.string().min(1, { error: "captcha_required" }),
});

export const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "invalid_slug" });
