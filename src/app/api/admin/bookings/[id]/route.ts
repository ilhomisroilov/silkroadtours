import { getDb } from "@/db/client";
import { getBookingAdmin, updateBookingStatus } from "@/db/queries/bookings";
import { requireAdmin } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { bookingStatusUpdateSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/bookings/[id] — full booking with tour, departure and notes timeline. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const booking = await getBookingAdmin(getDb(), parseId(id));
  if (!booking) throw notFound();
  return ok(booking);
});

/** PATCH /api/admin/bookings/[id] — change status (seats on the departure are reserved/released automatically). */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const { status, note } = await parseBody(req, bookingStatusUpdateSchema);
  const db = getDb();
  await updateBookingStatus(db, parseId(id), status, admin.id, note);
  return ok(await getBookingAdmin(db, parseId(id)));
});
