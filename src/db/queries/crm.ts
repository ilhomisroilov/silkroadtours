import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, gt, or, sql, sum, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { adminUsers, bookings, leadActivities, leads, partners, savedTripPlans, serviceRequests } from "../schema";
import { LEAD_STAGES, type LeadActivityKind, type LeadSource, type LeadStage } from "../types";
import type { Lead } from "./leads";
import type { LeadCreateInput, LeadListQuery, LeadUpdateInput } from "@/validators/lead";
import { LEAD_FIELD_KEYS } from "@/validators/lead";

/** Stages where the deal is still open: follow-ups and pipeline value only count these. */
export const OPEN_STAGES = ["new", "contacted", "qualified", "offer_sent", "negotiation"] as const satisfies readonly LeadStage[];
/** The board shows these as columns; "lost" is listed separately. */
export const BOARD_STAGES = LEAD_STAGES.filter((s) => s !== "lost");

export type LeadRow = Lead & { assignedName: string | null };

export interface LeadActivityRow {
  id: number;
  kind: LeadActivityKind;
  text: string;
  createdAt: Date;
  adminId: number | null;
  adminName: string | null;
}

export interface AdminOption {
  id: number;
  name: string;
  email: string;
}

const leadColumns = {
  id: leads.id,
  source: leads.source,
  sourceRef: leads.sourceRef,
  stage: leads.stage,
  fullName: leads.fullName,
  email: leads.email,
  phone: leads.phone,
  locale: leads.locale,
  title: leads.title,
  destination: leads.destination,
  interests: leads.interests,
  budgetUsd: leads.budgetUsd,
  travelFrom: leads.travelFrom,
  travelTo: leads.travelTo,
  travellers: leads.travellers,
  valueUsd: leads.valueUsd,
  assignedTo: leads.assignedTo,
  followUpAt: leads.followUpAt,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  assignedName: adminUsers.name,
};

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);
const stageOrder = sql`case ${leads.stage} ${sql.raw(LEAD_STAGES.map((s, i) => `when '${s}' then ${i}`).join(" "))} end`;

function leadFilters(q: Omit<LeadListQuery, "sort" | "dir" | "page" | "pageSize">, today: string): SQL | undefined {
  const where: (SQL | undefined)[] = [];
  if (q.q) {
    const p = `%${escapeLike(q.q)}%`;
    const l = (col: Parameters<typeof like>[0]) => sql`${col} like ${p} escape '\\'`;
    where.push(or(l(leads.fullName), l(leads.email), l(leads.phone), l(leads.title), l(leads.sourceRef), l(leads.destination)));
  }
  if (q.stage) where.push(eq(leads.stage, q.stage));
  if (q.source) where.push(eq(leads.source, q.source));
  if (q.assigned === "none") where.push(isNull(leads.assignedTo));
  else if (typeof q.assigned === "number") where.push(eq(leads.assignedTo, q.assigned));
  if (q.destination) where.push(eq(leads.destination, q.destination));
  if (q.followUp === "none") where.push(isNull(leads.followUpAt));
  else if (q.followUp) {
    const open = inArray(leads.stage, [...OPEN_STAGES]);
    if (q.followUp === "overdue") where.push(and(open, isNotNull(leads.followUpAt), lt(leads.followUpAt, today)));
    if (q.followUp === "today") where.push(and(open, eq(leads.followUpAt, today)));
    if (q.followUp === "upcoming") where.push(and(open, gt(leads.followUpAt, today)));
  }
  const parts = where.filter(Boolean) as SQL[];
  return parts.length ? and(...parts) : undefined;
}

function leadOrder(sort: LeadListQuery["sort"], dir: LeadListQuery["dir"]): SQL[] {
  const d = dir === "asc" ? asc : desc;
  switch (sort) {
    case "name":
      return [d(sql`${leads.fullName} collate nocase`), desc(leads.id)];
    case "value":
      return [sql`${leads.valueUsd} is null`, d(leads.valueUsd), desc(leads.id)];
    case "followUp":
      return [sql`${leads.followUpAt} is null`, d(leads.followUpAt), desc(leads.id)];
    case "travel":
      return [sql`${leads.travelFrom} is null`, d(leads.travelFrom), desc(leads.id)];
    case "stage":
      return [d(stageOrder), desc(leads.updatedAt), desc(leads.id)];
    case "updated":
      return [d(leads.updatedAt), d(leads.id)];
    default:
      return [d(leads.createdAt), d(leads.id)];
  }
}

export async function listLeads(db: Db, q: LeadListQuery, today: string): Promise<{ items: LeadRow[]; total: number; page: number; pageSize: number }> {
  const where = leadFilters(q, today);
  const [items, [totalRow]] = await Promise.all([
    db
      .select(leadColumns)
      .from(leads)
      .leftJoin(adminUsers, eq(adminUsers.id, leads.assignedTo))
      .where(where)
      .orderBy(...leadOrder(q.sort, q.dir))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(leads).where(where),
  ]);
  return { items, total: totalRow?.n ?? 0, page: q.page, pageSize: q.pageSize };
}

/** Distinct destinations already on leads, for the destination filter. */
export async function listLeadDestinations(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ d: leads.destination })
    .from(leads)
    .where(and(isNotNull(leads.destination), sql`trim(${leads.destination}) <> ''`))
    .orderBy(asc(leads.destination))
    .limit(200);
  return rows.map((r) => r.d!).filter(Boolean);
}

export async function listActiveAdmins(db: Db): Promise<AdminOption[]> {
  return db
    .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.isActive, true))
    .orderBy(asc(adminUsers.name));
}

export async function getLead(db: Db, id: number): Promise<LeadRow | null> {
  const [row] = await db.select(leadColumns).from(leads).leftJoin(adminUsers, eq(adminUsers.id, leads.assignedTo)).where(eq(leads.id, id)).limit(1);
  return row ?? null;
}

export async function listLeadActivities(db: Db, leadId: number): Promise<LeadActivityRow[]> {
  return db
    .select({ id: leadActivities.id, kind: leadActivities.kind, text: leadActivities.text, createdAt: leadActivities.createdAt, adminId: leadActivities.adminId, adminName: adminUsers.name })
    .from(leadActivities)
    .leftJoin(adminUsers, eq(adminUsers.id, leadActivities.adminId))
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(desc(leadActivities.createdAt), desc(leadActivities.id));
}

/** Leads for one customer (same email), newest first. */
export async function listLeadsByEmail(db: Db, email: string): Promise<LeadRow[]> {
  return db
    .select(leadColumns)
    .from(leads)
    .leftJoin(adminUsers, eq(adminUsers.id, leads.assignedTo))
    .where(sql`lower(${leads.email}) = ${email.trim().toLowerCase()}`)
    .orderBy(desc(leads.createdAt))
    .limit(50);
}

export interface LeadSourceLink {
  /** Admin page of the record the lead came from, when it still exists. */
  href: string | null;
  /** Trip plan id when the request was sent from a saved trip. */
  tripId: string | null;
}

/** Finds the booking, request or partner application behind a lead (by its reference). */
export async function resolveLeadSource(db: Db, lead: Pick<Lead, "source" | "sourceRef">): Promise<LeadSourceLink> {
  const ref = lead.sourceRef;
  if (!ref) return { href: null, tripId: null };
  if (lead.source === "booking") {
    const [b] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.reference, ref)).limit(1);
    return { href: b ? `/admin/bookings/${b.id}` : null, tripId: null };
  }
  if (lead.source === "request" || lead.source === "trip" || lead.source === "contact") {
    const [r] = await db.select({ id: serviceRequests.id, payload: serviceRequests.payload }).from(serviceRequests).where(eq(serviceRequests.reference, ref)).limit(1);
    const rawTrip = r && typeof (r.payload as Record<string, unknown>)?.tripId === "string" ? ((r.payload as Record<string, unknown>).tripId as string) : null;
    const [trip] = rawTrip ? await db.select({ id: savedTripPlans.id }).from(savedTripPlans).where(eq(savedTripPlans.id, rawTrip)).limit(1) : [];
    return { href: r ? `/admin/requests/${r.id}` : null, tripId: trip?.id ?? null };
  }
  if (lead.source === "partner") {
    const [p] = await db.select({ id: partners.id }).from(partners).where(eq(partners.reference, ref)).limit(1);
    return { href: p ? `/admin/partners/${p.id}` : null, tripId: null };
  }
  return { href: null, tripId: null };
}

async function logActivity(db: Db, leadId: number, adminId: number | null, kind: LeadActivityKind, text: string) {
  await db.insert(leadActivities).values({ leadId, adminId, kind, text: text.slice(0, 4000) });
}

/** Logs a call, email or note by hand and bumps the lead's "updated" time. */
export async function addLeadActivity(db: Db, leadId: number, adminId: number, kind: "note" | "call" | "email", text: string): Promise<void> {
  await logActivity(db, leadId, adminId, kind, text);
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
}

async function adminName(db: Db, id: number | null | undefined): Promise<string | null> {
  if (!id) return null;
  const [a] = await db.select({ name: adminUsers.name, isActive: adminUsers.isActive }).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return a?.isActive ? a.name : null;
}

/** A rule the schema cannot check alone (unknown manager, dates out of order); `code` is an error key. */
export class LeadInputError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LeadInputError";
  }
}

/** A lead entered by hand in the admin panel (phone call, walk-in, fair contact). */
export async function createManualLead(db: Db, input: LeadCreateInput, adminId: number): Promise<number> {
  if (input.assignedTo && !(await adminName(db, input.assignedTo))) throw new LeadInputError("assignee_not_found");
  const { note, stage, assignedTo, followUpAt, ...fields } = input;
  const [row] = await db
    .insert(leads)
    .values({ ...fields, source: "admin" satisfies LeadSource, sourceRef: null, stage, assignedTo: assignedTo ?? null, followUpAt: followUpAt ?? null })
    .returning({ id: leads.id });
  const id = row!.id;
  await logActivity(db, id, adminId, "created", "");
  if (stage !== "new") await logActivity(db, id, adminId, "stage", `new → ${stage}`);
  if (assignedTo) await logActivity(db, id, adminId, "assign", (await adminName(db, assignedTo)) ?? "");
  if (followUpAt) await logActivity(db, id, adminId, "follow_up", followUpAt);
  if (note) await logActivity(db, id, adminId, "note", note);
  return id;
}

/**
 * Applies a partial update and writes one activity per kind of change (stage, manager, follow-up,
 * details), each with the acting admin. Returns false when the lead does not exist.
 */
export async function updateLead(db: Db, id: number, patch: LeadUpdateInput, adminId: number): Promise<boolean> {
  const [cur] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!cur) return false;
  const set: Partial<typeof leads.$inferInsert> = {};
  const changedFields: string[] = [];
  for (const key of LEAD_FIELD_KEYS) {
    const next = patch[key];
    if (next === undefined) continue;
    if ((cur[key] ?? null) !== (next ?? null)) {
      (set as Record<string, unknown>)[key] = next;
      changedFields.push(key);
    }
  }
  const from = set.travelFrom !== undefined ? set.travelFrom : cur.travelFrom;
  const to = set.travelTo !== undefined ? set.travelTo : cur.travelTo;
  if (from && to && from > to) throw new LeadInputError("dates_out_of_order");

  const activities: { kind: LeadActivityKind; text: string }[] = [];
  if (patch.stage && patch.stage !== cur.stage) {
    set.stage = patch.stage;
    activities.push({ kind: "stage", text: `${cur.stage} → ${patch.stage}` });
  }
  if (patch.assignedTo !== undefined && (patch.assignedTo ?? null) !== (cur.assignedTo ?? null)) {
    const name = patch.assignedTo ? await adminName(db, patch.assignedTo) : null;
    if (patch.assignedTo && !name) throw new LeadInputError("assignee_not_found");
    set.assignedTo = patch.assignedTo ?? null;
    activities.push({ kind: "assign", text: name ?? "" });
  }
  if (patch.followUpAt !== undefined && (patch.followUpAt ?? null) !== (cur.followUpAt ?? null)) {
    set.followUpAt = patch.followUpAt ?? null;
    activities.push({ kind: "follow_up", text: patch.followUpAt ?? "" });
  }
  if (changedFields.length) activities.push({ kind: "note", text: `updated:${changedFields.join(",")}` });
  if (Object.keys(set).length === 0) return true;
  await db.update(leads).set(set).where(eq(leads.id, id));
  for (const a of activities) await logActivity(db, id, adminId, a.kind, a.text);
  return true;
}

export interface CrmStats {
  total: number;
  byStage: Record<LeadStage, { count: number; valueUsd: number }>;
  bySource: { source: LeadSource; count: number }[];
  newLast7: number;
  followUpsToday: number;
  followUpsOverdue: number;
  /** Open-stage deal value (new → negotiation), whole USD. */
  pipelineUsd: number;
  /** Confirmed + completed deal value, whole USD. */
  wonUsd: number;
  /** Share of all leads that reached "confirmed" or "completed", 0–1. */
  conversion: number;
}

export async function getCrmStats(db: Db, today: string, now: Date = new Date()): Promise<CrmStats> {
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const open = inArray(leads.stage, [...OPEN_STAGES]);
  const [stageRows, sourceRows, [n7], [due], [overdue]] = await Promise.all([
    db.select({ stage: leads.stage, n: count(), v: sum(leads.valueUsd) }).from(leads).groupBy(leads.stage),
    db.select({ source: leads.source, n: count() }).from(leads).groupBy(leads.source).orderBy(desc(count())),
    db.select({ n: count() }).from(leads).where(gte(leads.createdAt, weekAgo)),
    db.select({ n: count() }).from(leads).where(and(open, eq(leads.followUpAt, today))),
    db.select({ n: count() }).from(leads).where(and(open, isNotNull(leads.followUpAt), lt(leads.followUpAt, today))),
  ]);
  const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s, { count: 0, valueUsd: 0 }])) as CrmStats["byStage"];
  for (const r of stageRows) byStage[r.stage] = { count: r.n, valueUsd: Number(r.v ?? 0) };
  const total = LEAD_STAGES.reduce((a, s) => a + byStage[s].count, 0);
  const won = byStage.confirmed.count + byStage.completed.count;
  return {
    total,
    byStage,
    bySource: sourceRows.map((r) => ({ source: r.source, count: r.n })),
    newLast7: n7?.n ?? 0,
    followUpsToday: due?.n ?? 0,
    followUpsOverdue: overdue?.n ?? 0,
    pipelineUsd: OPEN_STAGES.reduce((a, s) => a + byStage[s].valueUsd, 0),
    wonUsd: byStage.confirmed.valueUsd + byStage.completed.valueUsd,
    conversion: total ? won / total : 0,
  };
}

/** True when the email has a booking or a request, i.e. /admin/customers/<email> has a profile. */
export async function hasCustomerProfile(db: Db, email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();
  const [[b], [r]] = await Promise.all([
    db.select({ id: bookings.id }).from(bookings).where(sql`lower(${bookings.email}) = ${key}`).limit(1),
    db.select({ id: serviceRequests.id }).from(serviceRequests).where(sql`lower(${serviceRequests.email}) = ${key}`).limit(1),
  ]);
  return Boolean(b || r);
}
