import "server-only";
import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { destinations, partners, places } from "../schema";
import type { LocalizedText, PlaceKind, PlaceSource } from "../types";
import type { PlaceUpsertInput } from "@/validators/place";

/** Admin-side queries for hotels, restaurants and transport (the public ones live in places.ts). */

export type AdminPlace = typeof places.$inferSelect;

export interface AdminPlaceFilter {
  kind: PlaceKind;
  destination?: string;
  q?: string;
  published?: "true" | "false";
  source?: PlaceSource;
}

export interface AdminPlaceRow {
  id: number;
  kind: PlaceKind;
  slug: string;
  destinationSlug: string | null;
  name: LocalizedText;
  image: string | null;
  priceFromUsd: number | null;
  priceLevel: number | null;
  source: PlaceSource;
  isPublished: boolean;
  sortOrder: number;
  partnerId: number | null;
  partnerName: string | null;
  updatedAt: Date;
}

export async function listPlacesAdmin(db: Db, f: AdminPlaceFilter): Promise<AdminPlaceRow[]> {
  const conds: SQL[] = [eq(places.kind, f.kind)];
  if (f.destination) conds.push(eq(places.destinationSlug, f.destination));
  if (f.published) conds.push(eq(places.isPublished, f.published === "true"));
  if (f.source) conds.push(eq(places.source, f.source));
  if (f.q?.trim()) {
    const needle = `%${f.q.trim()}%`;
    conds.push(or(like(places.name, needle), like(places.slug, needle), like(places.summary, needle), like(places.tags, needle))!);
  }
  return db
    .select({
      id: places.id,
      kind: places.kind,
      slug: places.slug,
      destinationSlug: places.destinationSlug,
      name: places.name,
      image: places.image,
      priceFromUsd: places.priceFromUsd,
      priceLevel: places.priceLevel,
      source: places.source,
      isPublished: places.isPublished,
      sortOrder: places.sortOrder,
      partnerId: places.partnerId,
      partnerName: partners.businessName,
      updatedAt: places.updatedAt,
    })
    .from(places)
    .leftJoin(partners, eq(places.partnerId, partners.id))
    .where(and(...conds))
    .orderBy(asc(places.sortOrder), asc(places.id));
}

/** Rows per kind, for the tab counters. */
export async function placeCounts(db: Db): Promise<Record<PlaceKind, number>> {
  const rows = await db.select({ kind: places.kind, n: count() }).from(places).groupBy(places.kind);
  const out: Record<PlaceKind, number> = { hotel: 0, restaurant: 0, transport: 0 };
  for (const r of rows) out[r.kind] = r.n;
  return out;
}

export async function getPlaceAdmin(db: Db, id: number): Promise<AdminPlace | null> {
  const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
  return row ?? null;
}

/** Next free sort position inside a kind, so new rows land at the end of the list. */
async function nextSortOrder(db: Db, kind: PlaceKind): Promise<number> {
  const rows = await db.select({ s: places.sortOrder }).from(places).where(eq(places.kind, kind));
  return rows.reduce((m, r) => Math.max(m, r.s), -1) + 1;
}

export async function createPlaceAdmin(db: Db, input: PlaceUpsertInput): Promise<number> {
  const sortOrder = input.sortOrder > 0 ? input.sortOrder : await nextSortOrder(db, input.kind);
  const [row] = await db
    .insert(places)
    .values({ ...input, sortOrder, source: "admin" })
    .returning({ id: places.id });
  return row!.id;
}

/** Updates every editable field; `source` and `createdAt` are kept as they were. */
export async function updatePlaceAdmin(db: Db, id: number, input: PlaceUpsertInput): Promise<void> {
  await db
    .update(places)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(places.id, id));
}

export async function patchPlaceAdmin(db: Db, id: number, patch: { isPublished?: boolean; sortOrder?: number }): Promise<void> {
  await db
    .update(places)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(places.id, id));
}

export async function deletePlaceAdmin(db: Db, id: number): Promise<void> {
  await db.delete(places).where(eq(places.id, id));
}

/** Choices for the editor: destinations (all, incl. drafts) and partner profiles. */
export async function placeEditorOptions(db: Db) {
  const [dests, parts] = await Promise.all([
    db.select({ slug: destinations.slug, name: destinations.name, lat: destinations.lat, lng: destinations.lng }).from(destinations).orderBy(asc(destinations.sortOrder)),
    db
      .select({ id: partners.id, businessName: partners.businessName, type: partners.type, status: partners.status, city: partners.city })
      .from(partners)
      .orderBy(asc(partners.businessName)),
  ]);
  return { destinations: dests, partners: parts };
}

export async function partnerExists(db: Db, id: number): Promise<boolean> {
  const [row] = await db.select({ id: partners.id }).from(partners).where(eq(partners.id, id)).limit(1);
  return !!row;
}
