import "server-only";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { conflict, isUniqueViolation, notFound } from "@/lib/http";
import type { Db } from "../client";
import { bookings, destinations, reviews, tours } from "../schema";

const publicColumns = {
  id: reviews.id,
  authorName: reviews.authorName,
  authorCountry: reviews.authorCountry,
  rating: reviews.rating,
  title: reviews.title,
  body: reviews.body,
  language: reviews.language,
  source: reviews.source,
  sourceUrl: reviews.sourceUrl,
  travelDate: reviews.travelDate,
  isVerified: reviews.isVerified,
  createdAt: reviews.createdAt,
  tour: { slug: tours.slug, title: tours.title },
};

export async function listPublishedReviews(
  db: Db,
  f: { tourSlug?: string; destinationSlug?: string; limit: number },
) {
  const conds: (SQL | undefined)[] = [eq(reviews.isPublished, true)];
  if (f.tourSlug) conds.push(eq(tours.slug, f.tourSlug));
  if (f.destinationSlug) {
    conds.push(
      sql`(${reviews.destinationId} = (SELECT id FROM destinations WHERE slug = ${f.destinationSlug})
        OR ${tours.primaryDestinationId} = (SELECT id FROM destinations WHERE slug = ${f.destinationSlug}))`,
    );
  }
  const items = await db
    .select(publicColumns)
    .from(reviews)
    .leftJoin(tours, eq(tours.id, reviews.tourId))
    .where(and(...conds))
    .orderBy(desc(reviews.isVerified), desc(reviews.createdAt))
    .limit(f.limit);

  const [summary] = await db
    .select({ n: count(), avg: sql<number>`coalesce(round(avg(${reviews.rating}), 2), 0)` })
    .from(reviews)
    .leftJoin(tours, eq(tours.id, reviews.tourId))
    .where(and(...conds));
  return { items, total: summary?.n ?? 0, average: Number(summary?.avg ?? 0) };
}

export async function recomputeTourRating(db: Db, tourId: number | null): Promise<void> {
  if (tourId == null) return;
  await db
    .update(tours)
    .set({
      ratingAvg: sql`(SELECT coalesce(round(avg(rating), 2), 0) FROM reviews WHERE tour_id = ${tourId} AND is_published = 1)`,
      ratingCount: sql`(SELECT count(*) FROM reviews WHERE tour_id = ${tourId} AND is_published = 1)`,
    })
    .where(eq(tours.id, tourId));
}

/** Guests may review only their own completed booking (matched by reference + email); one review per booking. */
export async function submitGuestReview(
  db: Db,
  input: {
    reference: string;
    email: string;
    authorName?: string;
    authorCountry?: string;
    rating: number;
    title?: string;
    body: string;
    language: string;
  },
): Promise<{ id: number }> {
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      email: bookings.email,
      fullName: bookings.fullName,
      country: bookings.country,
      tourId: bookings.tourId,
      destinationId: bookings.destinationId,
      preferredDate: bookings.preferredDate,
    })
    .from(bookings)
    .where(eq(bookings.reference, input.reference))
    .limit(1);
  // Same error for "no such booking" and "wrong email" so references can't be probed.
  if (!booking || booking.email !== input.email) throw notFound("booking_not_found");
  if (booking.status !== "completed") throw conflict("booking_not_completed");

  const firstName = booking.fullName.split(/\s+/)[0] ?? booking.fullName;
  try {
    const [row] = await db
      .insert(reviews)
      .values({
        bookingId: booking.id,
        tourId: booking.tourId,
        destinationId: booking.destinationId,
        authorName: input.authorName ?? firstName,
        authorCountry: input.authorCountry ?? booking.country,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        language: input.language,
        source: "site",
        travelDate: booking.preferredDate,
        isVerified: true,
        isPublished: false,
      })
      .returning({ id: reviews.id });
    return row!;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("already_reviewed");
    throw err;
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function listReviewsAdmin(
  db: Db,
  f: { published?: "true" | "false"; tourId?: number; page: number; pageSize: number },
) {
  const conds: (SQL | undefined)[] = [];
  if (f.published) conds.push(eq(reviews.isPublished, f.published === "true"));
  if (f.tourId) conds.push(eq(reviews.tourId, f.tourId));
  const where = and(...conds);
  const [totalRow] = await db.select({ n: count() }).from(reviews).where(where);
  const items = await db
    .select({
      ...publicColumns,
      isPublished: reviews.isPublished,
      bookingId: reviews.bookingId,
      tourId: reviews.tourId,
      destination: { id: destinations.id, name: destinations.name },
    })
    .from(reviews)
    .leftJoin(tours, eq(tours.id, reviews.tourId))
    .leftJoin(destinations, eq(destinations.id, reviews.destinationId))
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  return { items, total: totalRow?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function createReviewAdmin(
  db: Db,
  input: {
    tourId: number | null;
    destinationId: number | null;
    authorName: string;
    authorCountry: string | null;
    rating: number;
    title: string | null;
    body: string;
    language: string;
    source: "site" | "google" | "tripadvisor";
    sourceUrl: string | null;
    travelDate: string | null;
    isPublished: boolean;
  },
): Promise<number> {
  if (input.tourId != null) {
    const [t] = await db.select({ id: tours.id }).from(tours).where(eq(tours.id, input.tourId)).limit(1);
    if (!t) throw notFound("tour_not_found");
  }
  if (input.destinationId != null) {
    const [d] = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.id, input.destinationId)).limit(1);
    if (!d) throw notFound("destination_not_found");
  }
  const [row] = await db.insert(reviews).values({ ...input, isVerified: false }).returning({ id: reviews.id });
  await recomputeTourRating(db, input.tourId);
  return row!.id;
}

export async function moderateReview(
  db: Db,
  id: number,
  patch: { isPublished?: boolean; isVerified?: boolean },
): Promise<void> {
  const updated = await db.update(reviews).set(patch).where(eq(reviews.id, id)).returning({ tourId: reviews.tourId });
  if (updated.length === 0) throw notFound();
  await recomputeTourRating(db, updated[0]!.tourId);
}

export async function deleteReview(db: Db, id: number): Promise<void> {
  const deleted = await db.delete(reviews).where(eq(reviews.id, id)).returning({ tourId: reviews.tourId });
  if (deleted.length === 0) throw notFound();
  await recomputeTourRating(db, deleted[0]!.tourId);
}
