import { z } from "zod";
import { LEAD_SOURCES, LEAD_STAGES, LOCALES } from "../db/types";
import { isoDate } from "./common";

/** CRM lead validators (admin only). Error messages are codes translated by the admin UI. */

export const LEAD_SORTS = ["created", "updated", "name", "value", "followUp", "travel", "stage"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export const FOLLOW_UP_FILTERS = ["overdue", "today", "upcoming", "none"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export const LEAD_VIEWS = ["board", "table"] as const;

/** "none" = unassigned; otherwise an admin id. */
const assignedFilter = z.union([z.literal("none"), z.coerce.number().int().positive()]);

export const leadListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assigned: assignedFilter.optional(),
  destination: z.string().trim().max(120).optional(),
  followUp: z.enum(FOLLOW_UP_FILTERS).optional(),
  sort: z.enum(LEAD_SORTS).default("created"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(25),
});
export type LeadListQuery = z.output<typeof leadListQuerySchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optionalUsd = z.number().int().min(0).max(10_000_000).nullable().optional();
const optionalDate = z
  .union([isoDate, z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const phoneText = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === "" || /^\+?[0-9\s\-()]{7,20}$/.test(v), { error: "invalid_phone" })
  .transform((v) => (v === "" ? null : v.replace(/[\s\-()]/g, "")))
  .nullable()
  .optional();

/** Editable descriptive fields of a lead (everything except stage, manager and follow-up). */
const leadFields = {
  fullName: z.string().trim().min(2, { error: "name_too_short" }).max(120),
  email: z.email({ error: "invalid_email" }).max(200).transform((v) => v.toLowerCase()),
  phone: phoneText,
  locale: z.enum(LOCALES),
  title: z.string().trim().min(2).max(200),
  destination: optionalText(120),
  interests: optionalText(1000),
  budgetUsd: optionalUsd,
  travelFrom: optionalDate,
  travelTo: optionalDate,
  travellers: z.number().int().min(1).max(500).nullable().optional(),
  valueUsd: optionalUsd,
};

const datesInOrder = (v: { travelFrom?: string | null; travelTo?: string | null }) => !v.travelFrom || !v.travelTo || v.travelFrom <= v.travelTo;

export const leadCreateSchema = z
  .object({
    ...leadFields,
    stage: z.enum(LEAD_STAGES).default("new"),
    assignedTo: z.number().int().positive().nullable().optional(),
    followUpAt: optionalDate,
    note: z.string().trim().max(4000).optional(),
  })
  .refine(datesInOrder, { error: "dates_out_of_order", path: ["travelTo"] });
export type LeadCreateInput = z.output<typeof leadCreateSchema>;

export const leadUpdateSchema = z
  .object({
    fullName: leadFields.fullName.optional(),
    email: leadFields.email.optional(),
    phone: leadFields.phone,
    locale: leadFields.locale.optional(),
    title: leadFields.title.optional(),
    destination: leadFields.destination,
    interests: leadFields.interests,
    budgetUsd: leadFields.budgetUsd,
    travelFrom: leadFields.travelFrom,
    travelTo: leadFields.travelTo,
    travellers: leadFields.travellers,
    valueUsd: leadFields.valueUsd,
    stage: z.enum(LEAD_STAGES).optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
    followUpAt: optionalDate,
  })
  .refine(datesInOrder, { error: "dates_out_of_order", path: ["travelTo"] })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: "empty_update" });
export type LeadUpdateInput = z.output<typeof leadUpdateSchema>;

/** Activities an admin logs by hand; stage/assign/follow-up entries are written by the PATCH route. */
export const leadActivityCreateSchema = z.object({
  kind: z.enum(["note", "call", "email"]),
  text: z.string().trim().min(1, { error: "required" }).max(4000),
});
export type LeadActivityCreateInput = z.output<typeof leadActivityCreateSchema>;

/** The descriptive field keys, used to describe a "details updated" activity. */
export const LEAD_FIELD_KEYS = ["fullName", "email", "phone", "locale", "title", "destination", "interests", "budgetUsd", "travelFrom", "travelTo", "travellers", "valueUsd"] as const;
export type LeadFieldKey = (typeof LEAD_FIELD_KEYS)[number];
