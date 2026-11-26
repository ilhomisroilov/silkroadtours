import "server-only";
import { and, asc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { destinations, places } from "../schema";
import type { Attraction, LocalizedText, PlaceKind } from "../types";

export type Place = typeof places.$inferSelect;

export interface PlaceFilter {
  kind?: PlaceKind;
  kinds?: PlaceKind[];
  destination?: string;
  q?: string;
  maxPriceUsd?: number;
  tag?: string;
  limit?: number;
  includeUnpublished?: boolean;
}

/** Hotels, restaurants and transport options, published only unless asked otherwise. */
export async function listPlaces(db: Db, f: PlaceFilter = {}): Promise<Place[]> {
  const conds: SQL[] = [];
  if (!f.includeUnpublished) conds.push(eq(places.isPublished, true));
  if (f.kind) conds.push(eq(places.kind, f.kind));
  if (f.kinds?.length) conds.push(inArray(places.kind, f.kinds));
  if (f.destination) conds.push(eq(places.destinationSlug, f.destination));
  if (f.q?.trim()) {
    const needle = `%${f.q.trim().toLowerCase()}%`;
    conds.push(or(like(places.name, needle), like(places.summary, needle), like(places.tags, needle), like(places.slug, needle))!);
  }
  const rows = await db
    .select()
    .from(places)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(places.sortOrder), asc(places.id));
  let out = rows;
  if (f.maxPriceUsd != null) out = out.filter((p) => p.priceFromUsd == null || p.priceFromUsd <= f.maxPriceUsd!);
  if (f.tag) out = out.filter((p) => p.tags.includes(f.tag!));
  return f.limit ? out.slice(0, f.limit) : out;
}

export async function getPublishedPlace(db: Db, kind: PlaceKind, slug: string): Promise<Place | null> {
  const [row] = await db
    .select()
    .from(places)
    .where(and(eq(places.kind, kind), eq(places.slug, slug), eq(places.isPublished, true)))
    .limit(1);
  return row ?? null;
}

export async function getPlaceById(db: Db, id: number): Promise<Place | null> {
  const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
  return row ?? null;
}

/** An attraction from a destination's list, flattened with a stable id and its destination. */
export interface AttractionPoint extends Attraction {
  id: string;
  destinationSlug: string;
  destinationName: LocalizedText;
}

/** All attractions of published destinations that have coordinates (for maps, the builder and the AI). */
export async function listAttractions(db: Db, opts: { destination?: string } = {}): Promise<AttractionPoint[]> {
  const conds: SQL[] = [eq(destinations.isPublished, true)];
  if (opts.destination) conds.push(eq(destinations.slug, opts.destination));
  const rows = await db
    .select({ slug: destinations.slug, name: destinations.name, attractions: destinations.attractions })
    .from(destinations)
    .where(and(...conds))
    .orderBy(asc(destinations.sortOrder));
  const out: AttractionPoint[] = [];
  for (const d of rows) {
    (d.attractions ?? []).forEach((a, i) => {
      if (a.lat == null || a.lng == null) return;
      out.push({ ...a, id: `${d.slug}-${i + 1}`, destinationSlug: d.slug, destinationName: d.name });
    });
  }
  return out;
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
