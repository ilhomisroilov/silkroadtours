import "server-only";
import { and, count, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { conflict, isUniqueViolation, notFound, unprocessable } from "@/lib/http";
import { holdsSeats, STATUS_TRANSITIONS as TRANSITIONS } from "@/lib/booking-status";
import { withUniqueReference } from "@/lib/reference";
import { runBatch, tashkentDayStart } from "../batch";
import type { Db } from "../client";
import {
  adminUsers,
  bookingNotes,
  bookings,
  destinations,
  tourDepartures,
  tours,
  type NewBooking,
} from "../schema";
import type { Audience, BookingStatus } from "../types";

export async function insertBooking(
  db: Db,
  values: Omit<NewBooking, "id" | "reference" | "status" | "createdAt" | "updatedAt">,
): Promise<{ id: number; reference: string }> {
  return withUniqueReference(
    "UZ",
    async (reference) => {
      const [row] = await db
        .insert(bookings)
        .values({ ...values, reference, status: "pending" })
        .returning({ id: bookings.id, reference: bookings.reference });
      if (!row) throw new Error("Booking insert returned no row");
      return row;
    },
    isUniqueViolation,
  );
}

export async function markBookingNotified(db: Db, id: number, messageId: number): Promise<void> {
  await db
    .update(bookings)
    .set({ telegramNotifiedAt: new Date(), telegramMessageId: messageId })
    .where(eq(bookings.id, id));
}

/** Confirmation view — deliberately contains no personal data. */
export async function getBookingPublic(db: Db, reference: string) {
  const [row] = await db
    .select({
      reference: bookings.reference,
      status: bookings.status,
      bookingType: bookings.bookingType,
      audience: bookings.audience,
      preferredDate: bookings.preferredDate,
      adults: bookings.adults,
      children: bookings.children,
      quoteCurrency: bookings.quoteCurrency,
      quoteTotalMinor: bookings.quoteTotalMinor,
      tourTitleSnapshot: bookings.tourTitleSnapshot,
      createdAt: bookings.createdAt,
      tour: { slug: tours.slug, title: tours.title, heroImage: tours.heroImage },
      destination: { slug: destinations.slug, name: destinations.name },
    })
    .from(bookings)
    .leftJoin(tours, eq(tours.id, bookings.tourId))
    .leftJoin(destinations, eq(destinations.id, bookings.destinationId))
    .where(eq(bookings.reference, reference))
    .limit(1);
  return row ?? null;
}

export interface BookingListFilters {
  status?: BookingStatus;
  audience?: Audience;
  q?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export async function listBookings(db: Db, f: BookingListFilters) {
  const conds: (SQL | undefined)[] = [];
  if (f.status) conds.push(eq(bookings.status, f.status));
  if (f.audience) conds.push(eq(bookings.audience, f.audience));
  if (f.from) conds.push(gte(bookings.createdAt, tashkentDayStart(f.from)));
  if (f.to) conds.push(lt(bookings.createdAt, new Date(tashkentDayStart(f.to).getTime() + 86400_000)));
  if (f.q) {
    const pat = `%${f.q.replace(/[%_]/g, "")}%`;
    conds.push(
      or(
        sql`${bookings.reference} LIKE ${pat}`,
        sql`${bookings.fullName} LIKE ${pat}`,
        sql`${bookings.email} LIKE ${pat}`,
        sql`${bookings.phone} LIKE ${pat}`,
        sql`${bookings.tourTitleSnapshot} LIKE ${pat}`,
      ),
    );
  }
  const where = and(...conds);
  const [totalRow] = await db.select({ n: count() }).from(bookings).where(where);
  const items = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      audience: bookings.audience,
      bookingType: bookings.bookingType,
      fullName: bookings.fullName,
      email: bookings.email,
      phone: bookings.phone,
      contactChannel: bookings.contactChannel,
      preferredDate: bookings.preferredDate,
      adults: bookings.adults,
      children: bookings.children,
      quoteCurrency: bookings.quoteCurrency,
      quoteTotalMinor: bookings.quoteTotalMinor,
      tourTitleSnapshot: bookings.tourTitleSnapshot,
      telegramNotifiedAt: bookings.telegramNotifiedAt,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(where)
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  return { items, total: totalRow?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function getBookingAdmin(db: Db, id: number) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
    with: {
      tour: { columns: { id: true, slug: true, title: true, audience: true } },
      departure: true,
      destination: { columns: { id: true, slug: true, name: true } },
    },
  });
  if (!booking) return null;
  const notes = await db
    .select({
      id: bookingNotes.id,
      kind: bookingNotes.kind,
      fromStatus: bookingNotes.fromStatus,
      toStatus: bookingNotes.toStatus,
      body: bookingNotes.body,
      createdAt: bookingNotes.createdAt,
      author: { id: adminUsers.id, name: adminUsers.name },
    })
    .from(bookingNotes)
    .leftJoin(adminUsers, eq(adminUsers.id, bookingNotes.authorId))
    .where(eq(bookingNotes.bookingId, id))
    .orderBy(desc(bookingNotes.createdAt), desc(bookingNotes.id));
  return { ...booking, notes };
}

async function adjustSeats(db: Db, departureId: number, delta: number): Promise<boolean> {
  if (delta > 0) {
    const rows = await db
      .update(tourDepartures)
      .set({
        seatsBooked: sql`${tourDepartures.seatsBooked} + ${delta}`,
        status: sql`CASE WHEN ${tourDepartures.seatsBooked} + ${delta} >= ${tourDepartures.seatsTotal} THEN 'sold_out' ELSE ${tourDepartures.status} END`,
      })
      .where(
        and(
          eq(tourDepartures.id, departureId),
          sql`${tourDepartures.seatsBooked} + ${delta} <= ${tourDepartures.seatsTotal}`,
          sql`${tourDepartures.status} != 'cancelled'`,
        ),
      )
      .returning({ id: tourDepartures.id });
    return rows.length === 1;
  }
  const release = -delta;
  await db
    .update(tourDepartures)
    .set({
      seatsBooked: sql`MAX(0, ${tourDepartures.seatsBooked} - ${release})`,
      status: sql`CASE WHEN ${tourDepartures.status} = 'sold_out' THEN 'open' ELSE ${tourDepartures.status} END`,
    })
    .where(eq(tourDepartures.id, departureId));
  return true;
}

export async function updateBookingStatus(
  db: Db,
  id: number,
  to: BookingStatus,
  authorId: number,
  note?: string,
): Promise<void> {
  const [b] = await db
    .select({ status: bookings.status, departureId: bookings.departureId, adults: bookings.adults, children: bookings.children })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (!b) throw notFound();
  if (b.status === to) return;
  if (!TRANSITIONS[b.status].includes(to)) throw unprocessable("invalid_status_transition");

  const pax = b.adults + b.children;
  let seatDelta = 0;
  if (b.departureId != null && holdsSeats(b.status) !== holdsSeats(to)) {
    seatDelta = holdsSeats(to) ? pax : -pax;
    const ok = await adjustSeats(db, b.departureId, seatDelta);
    if (!ok) throw conflict("insufficient_seats");
  }

  try {
    await runBatch(db, [
      db.update(bookings).set({ status: to }).where(eq(bookings.id, id)),
      db.insert(bookingNotes).values({
        bookingId: id,
        authorId,
        kind: "status_change",
        fromStatus: b.status,
        toStatus: to,
        body: note ?? "",
      }),
    ]);
  } catch (err) {
    // Undo the seat change so departures never drift from booking state.
    if (seatDelta !== 0 && b.departureId != null) await adjustSeats(db, b.departureId, -seatDelta);
    throw err;
  }
}

export async function addBookingNote(db: Db, bookingId: number, authorId: number, body: string) {
  const [exists] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!exists) throw notFound();
  const [row] = await db
    .insert(bookingNotes)
    .values({ bookingId, authorId, kind: "note", body })
    .returning();
  return row!;
}
