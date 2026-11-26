import "server-only";
import { and, asc, count, desc, eq, gt, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { sha256Hex, timingSafeEqualString } from "@/lib/crypto";
import { isUniqueViolation } from "@/lib/http";
import { assignPartnerSlugs, firstName, parseServices, partnerRefSlug, type PartnerService } from "@/lib/partners";
import { secureRandomInt } from "@/lib/reference";
import type { Db } from "../client";
import { leads, partners, places, serviceRequests } from "../schema";
import type { LeadStage, LocalizedText, PartnerStatus, PartnerType, PlaceKind } from "../types";

export type Partner = typeof partners.$inferSelect;

/** What the public site may show about an approved partner (no contact person, e-mail or phone). */
export interface PublicPartner {
  id: number;
  reference: string;
  slug: string;
  type: PartnerType;
  businessName: string;
  city: string | null;
  destinationSlug: string | null;
  description: string;
  website: string | null;
  services: PartnerService[];
  createdAt: Date;
}

export interface PartnerPlace {
  id: number;
  kind: PlaceKind;
  slug: string;
  name: LocalizedText;
  destinationSlug: string | null;
  image: string | null;
  priceFromUsd: number | null;
  isPublished: boolean;
  partnerId: number | null;
}

const publicColumns = {
  id: partners.id,
  reference: partners.reference,
  type: partners.type,
  businessName: partners.businessName,
  city: partners.city,
  destinationSlug: partners.destinationSlug,
  description: partners.description,
  website: partners.website,
  services: partners.services,
  createdAt: partners.createdAt,
};

/** Every approved partner with its public slug (the directory is small, so slugs are assigned in memory). */
async function approvedWithSlugs(db: Db): Promise<PublicPartner[]> {
  const rows = await db.select(publicColumns).from(partners).where(eq(partners.status, "approved")).orderBy(asc(partners.businessName), asc(partners.id));
  const slugs = assignPartnerSlugs(rows);
  return rows.map((r) => ({ ...r, slug: slugs.get(r.id)!, services: parseServices(r.services) }));
}

export async function listApprovedPartners(db: Db, f: { type?: PartnerType; destination?: string; limit?: number } = {}): Promise<PublicPartner[]> {
  const all = await approvedWithSlugs(db);
  const out = all.filter((p) => (!f.type || p.type === f.type) && (!f.destination || p.destinationSlug === f.destination));
  return f.limit ? out.slice(0, f.limit) : out;
}

/** Public profile by slug, or by reference (PA-XXXXXX, any case). Only approved partners. */
export async function getApprovedPartner(db: Db, slugOrReference: string): Promise<PublicPartner | null> {
  const key = slugOrReference.trim().toLowerCase();
  const all = await approvedWithSlugs(db);
  return all.find((p) => p.slug === key) ?? all.find((p) => p.reference.toLowerCase() === key) ?? null;
}

/** Public slug of one partner (null unless approved). */
export async function publicSlugOf(db: Db, id: number): Promise<string | null> {
  return (await approvedWithSlugs(db)).find((p) => p.id === id)?.slug ?? null;
}

// ── Applications ───────────────────────────────────────────────────────────

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generatePartnerReference(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[secureRandomInt(0, REF_ALPHABET.length - 1)];
  return `PA-${s}`;
}

export type NewPartner = Omit<typeof partners.$inferInsert, "id" | "reference" | "createdAt" | "updatedAt">;

/** Inserts a partner with a fresh unique reference (retries on the rare collision). */
export async function insertPartner(db: Db, values: NewPartner): Promise<{ id: number; reference: string }> {
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    const reference = generatePartnerReference();
    try {
      const [row] = await db.insert(partners).values({ ...values, reference }).returning({ id: partners.id });
      return { id: row!.id, reference };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      last = err;
    }
  }
  throw last;
}

/** Applications from one client (IP hash) in the last 10 minutes. */
export async function recentPartnerApplications(db: Db, ipHash: string): Promise<number> {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [row] = await db.select({ n: count() }).from(partners).where(and(eq(partners.ipHash, ipHash), gt(partners.createdAt, since)));
  return row?.n ?? 0;
}

/** The partner's own record, if the reference and the secret token match (constant-time comparison). */
export async function getPartnerByCredentials(db: Db, reference: string, token: string): Promise<Partner | null> {
  const [row] = await db.select().from(partners).where(eq(partners.reference, reference.toUpperCase())).limit(1);
  // Hashing first gives equal-length inputs, so the comparison time does not depend on the token.
  const [given, expected] = await Promise.all([sha256Hex(`partner:${token}`), sha256Hex(`partner:${row?.token ?? ""}`)]);
  const match = timingSafeEqualString(given, expected);
  return row && match ? row : null;
}

export async function updatePartnerListing(db: Db, id: number, patch: { description: string; services: string[] }): Promise<void> {
  await db.update(partners).set(patch).where(eq(partners.id, id));
}

// ── Places, inquiries and leads of a partner ───────────────────────────────

const placeColumns = {
  id: places.id,
  kind: places.kind,
  slug: places.slug,
  name: places.name,
  destinationSlug: places.destinationSlug,
  image: places.image,
  priceFromUsd: places.priceFromUsd,
  isPublished: places.isPublished,
  partnerId: places.partnerId,
};

export async function listPartnerPlaces(db: Db, partnerId: number, opts: { publishedOnly?: boolean } = {}): Promise<PartnerPlace[]> {
  const conds: SQL[] = [eq(places.partnerId, partnerId)];
  if (opts.publishedOnly) conds.push(eq(places.isPublished, true));
  return db.select(placeColumns).from(places).where(and(...conds)).orderBy(asc(places.kind), asc(places.sortOrder), asc(places.id));
}

/** All places, for the admin "link a listing" picker. */
export async function listAllPlacesBrief(db: Db): Promise<PartnerPlace[]> {
  return db.select(placeColumns).from(places).orderBy(asc(places.kind), asc(places.destinationSlug), asc(places.sortOrder), asc(places.id));
}

export async function setPlacePartner(db: Db, placeId: number, partnerId: number | null, onlyIfPartner?: number): Promise<boolean> {
  const where = onlyIfPartner != null ? and(eq(places.id, placeId), eq(places.partnerId, onlyIfPartner)) : eq(places.id, placeId);
  const res = await db.update(places).set({ partnerId }).where(where).returning({ id: places.id });
  return res.length > 0;
}

export interface PartnerInquiry {
  id: number;
  reference: string;
  createdAt: Date;
  status: string;
  fullName: string;
  email: string;
  phone: string;
  topic: string | null;
  subject: string | null;
  refSlug: string | null;
  date: string | null;
  groupSize: number | null;
}

/** Inquiries about the partner: its profile (topic general, refSlug = reference) or one of its places. */
function inquiryCondition(partner: Pick<Partner, "reference">, placeList: Pick<PartnerPlace, "kind" | "slug">[]): SQL {
  const topic = sql`json_extract(${serviceRequests.payload}, '$.topic')`;
  const ref = sql`json_extract(${serviceRequests.payload}, '$.refSlug')`;
  const parts: SQL[] = [sql`(${topic} = 'general' AND ${ref} = ${partnerRefSlug(partner.reference)})`];
  for (const p of placeList) parts.push(sql`(${topic} = ${p.kind} AND ${ref} = ${p.slug})`);
  return and(eq(serviceRequests.type, "inquiry"), or(...parts))!;
}

export async function partnerInquiries(
  db: Db,
  partner: Pick<Partner, "reference">,
  placeList: Pick<PartnerPlace, "kind" | "slug">[],
  limit = 10,
): Promise<{ total: number; last30: number; items: PartnerInquiry[] }> {
  const where = inquiryCondition(partner, placeList);
  const since = new Date(Date.now() - 30 * 86400_000);
  const [[all], [recent], rows] = await Promise.all([
    db.select({ n: count() }).from(serviceRequests).where(where),
    db.select({ n: count() }).from(serviceRequests).where(and(where, gt(serviceRequests.createdAt, since))),
    db
      .select({
        id: serviceRequests.id,
        reference: serviceRequests.reference,
        createdAt: serviceRequests.createdAt,
        status: serviceRequests.status,
        fullName: serviceRequests.fullName,
        email: serviceRequests.email,
        phone: serviceRequests.phone,
        payload: serviceRequests.payload,
      })
      .from(serviceRequests)
      .where(where)
      .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
      .limit(limit),
  ]);
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    total: all?.n ?? 0,
    last30: recent?.n ?? 0,
    items: rows.map(({ payload: p, ...r }) => ({
      ...r,
      topic: str(p.topic),
      subject: str(p.subject),
      refSlug: str(p.refSlug),
      date: str(p.date),
      groupSize: typeof p.groupSize === "number" ? p.groupSize : null,
    })),
  };
}

/** The same inquiries without the customer's contact details (for the partner's own dashboard). */
export function redactInquiries(items: PartnerInquiry[]) {
  return items.map((i) => ({ id: i.id, createdAt: i.createdAt, status: i.status, firstName: firstName(i.fullName), topic: i.topic, subject: i.subject, refSlug: i.refSlug, date: i.date, groupSize: i.groupSize }));
}

/** CRM leads that came from the partner's inquiries, by stage. */
export async function partnerLeadStats(db: Db, partner: Pick<Partner, "reference">, placeList: Pick<PartnerPlace, "kind" | "slug">[]) {
  const refs = db.select({ r: serviceRequests.reference }).from(serviceRequests).where(inquiryCondition(partner, placeList));
  const rows = await db
    .select({ stage: leads.stage, n: count(), value: sql<number>`coalesce(sum(${leads.valueUsd}), 0)` })
    .from(leads)
    .where(and(eq(leads.source, "request"), inArray(leads.sourceRef, refs)))
    .groupBy(leads.stage);
  const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.n])) as Partial<Record<LeadStage, number>>;
  const total = rows.reduce((a, r) => a + r.n, 0);
  const won = (byStage.confirmed ?? 0) + (byStage.completed ?? 0);
  const valueUsd = rows.reduce((a, r) => a + Number(r.value), 0);
  return { total, won, byStage, valueUsd };
}

/** The CRM lead created from the application itself. */
export async function partnerApplicationLead(db: Db, reference: string) {
  const [row] = await db.select({ id: leads.id, stage: leads.stage }).from(leads).where(and(eq(leads.source, "partner"), eq(leads.sourceRef, reference))).limit(1);
  return row ?? null;
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function listPartnersAdmin(db: Db, f: { status?: PartnerStatus; type?: PartnerType; q?: string; page: number; pageSize: number }) {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(partners.status, f.status));
  if (f.type) conds.push(eq(partners.type, f.type));
  if (f.q?.trim()) {
    const needle = `%${f.q.trim().toLowerCase()}%`;
    conds.push(
      or(
        like(sql`lower(${partners.businessName})`, needle),
        like(sql`lower(${partners.contactName})`, needle),
        like(sql`lower(${partners.email})`, needle),
        like(sql`lower(${partners.city})`, needle),
        like(sql`lower(${partners.reference})`, needle),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const placeCount = sql<number>`(SELECT count(*) FROM places p WHERE p.partner_id = ${partners.id})`;
  const [[total], items] = await Promise.all([
    db.select({ n: count() }).from(partners).where(where),
    db
      .select({
        id: partners.id,
        reference: partners.reference,
        type: partners.type,
        status: partners.status,
        businessName: partners.businessName,
        contactName: partners.contactName,
        email: partners.email,
        city: partners.city,
        services: partners.services,
        createdAt: partners.createdAt,
        reviewedAt: partners.reviewedAt,
        placeCount,
      })
      .from(partners)
      .where(where)
      // Pending first, then newest.
      .orderBy(sql`CASE ${partners.status} WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END`, desc(partners.createdAt), desc(partners.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
  ]);
  return { items, total: total?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function partnerStatusCounts(db: Db): Promise<Record<PartnerStatus, number>> {
  const rows = await db.select({ status: partners.status, n: count() }).from(partners).groupBy(partners.status);
  const out: Record<PartnerStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function getPartner(db: Db, id: number): Promise<Partner | null> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return row ?? null;
}

export async function reviewPartner(db: Db, id: number, input: { status: PartnerStatus; adminNote: string | null; adminId: number }): Promise<boolean> {
  const res = await db
    .update(partners)
    .set({ status: input.status, adminNote: input.adminNote, reviewedBy: input.adminId, reviewedAt: new Date() })
    .where(eq(partners.id, id))
    .returning({ id: partners.id });
  return res.length > 0;
}

export async function updatePartnerAdmin(db: Db, id: number, patch: Partial<Omit<typeof partners.$inferInsert, "id" | "reference" | "token">>): Promise<boolean> {
  const res = await db.update(partners).set(patch).where(eq(partners.id, id)).returning({ id: partners.id });
  return res.length > 0;
}

/** Number of approved partners per type, for the landing page and the homepage. */
export async function approvedCountsByType(db: Db): Promise<Partial<Record<PartnerType, number>>> {
  const rows = await db.select({ type: partners.type, n: count() }).from(partners).where(eq(partners.status, "approved")).groupBy(partners.type);
  return Object.fromEntries(rows.map((r) => [r.type, r.n]));
}
