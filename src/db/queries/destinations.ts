import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { conflict, isForeignKeyViolation, notFound } from "@/lib/http";
import type { destinationUpsertSchema } from "@/validators/admin";
import type { Db } from "../client";
import { destinations, tours } from "../schema";

type DestinationUpsert = z.output<typeof destinationUpsertSchema>;

/** Number of published tours that visit the destination (as primary or secondary stop). */
const publishedTourCount = sql<number>`(
  SELECT COUNT(DISTINCT t.id) FROM tours t
  LEFT JOIN tour_destinations td ON td.tour_id = t.id
  WHERE t.is_published = 1 AND (t.primary_destination_id = ${destinations.id} OR td.destination_id = ${destinations.id})
)`;

export async function listPublishedDestinations(db: Db) {
  return db
    .select({
      id: destinations.id,
      slug: destinations.slug,
      name: destinations.name,
      tagline: destinations.tagline,
      bestMonths: destinations.bestMonths,
      lat: destinations.lat,
      lng: destinations.lng,
      heroImage: destinations.heroImage,
      tourCount: publishedTourCount,
    })
    .from(destinations)
    .where(eq(destinations.isPublished, true))
    .orderBy(asc(destinations.sortOrder), asc(destinations.id));
}

export async function getPublishedDestinationBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(destinations).where(eq(destinations.slug, slug)).limit(1);
  return row && row.isPublished ? row : null;
}

export async function listDestinationsAdmin(db: Db) {
  return db
    .select({
      id: destinations.id,
      slug: destinations.slug,
      name: destinations.name,
      isPublished: destinations.isPublished,
      sortOrder: destinations.sortOrder,
      updatedAt: destinations.updatedAt,
      tourCount: publishedTourCount,
    })
    .from(destinations)
    .orderBy(asc(destinations.sortOrder), asc(destinations.id));
}

export async function getDestinationAdmin(db: Db, id: number) {
  const [row] = await db.select().from(destinations).where(eq(destinations.id, id)).limit(1);
  return row ?? null;
}

async function assertSlugFree(db: Db, slug: string, exceptId?: number) {
  const [row] = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.slug, slug)).limit(1);
  if (row && row.id !== exceptId) throw conflict("slug_taken");
}

export async function createDestination(db: Db, input: DestinationUpsert): Promise<number> {
  await assertSlugFree(db, input.slug);
  const [row] = await db.insert(destinations).values(input).returning({ id: destinations.id });
  return row!.id;
}

export async function updateDestination(db: Db, id: number, input: DestinationUpsert): Promise<void> {
  await assertSlugFree(db, input.slug, id);
  const updated = await db.update(destinations).set(input).where(eq(destinations.id, id)).returning({ id: destinations.id });
  if (updated.length === 0) throw notFound();
}

export async function deleteDestination(db: Db, id: number): Promise<void> {
  const [primary] = await db.select({ id: tours.id }).from(tours).where(eq(tours.primaryDestinationId, id)).limit(1);
  if (primary) throw conflict("destination_has_tours", "Move or delete the tours that start here first.");
  try {
    const deleted = await db.delete(destinations).where(eq(destinations.id, id)).returning({ id: destinations.id });
    if (deleted.length === 0) throw notFound();
  } catch (err) {
    if (isForeignKeyViolation(err)) throw conflict("destination_has_tours");
    throw err;
  }
}
