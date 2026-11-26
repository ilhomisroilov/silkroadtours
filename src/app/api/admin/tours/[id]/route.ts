import { getDb } from "@/db/client";
import { deleteTour, getTourAdmin, updateTour } from "@/db/queries/tours";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { tourUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/tours/[id] — tour with destinations, itinerary, tiers and all departures. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const tour = await getTourAdmin(getDb(), parseId(id));
  if (!tour) throw notFound();
  return ok(tour);
});

/** PUT /api/admin/tours/[id] — replace tour content and destination links. */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const input = await parseBody(req, tourUpsertSchema);
  const db = getDb();
  await updateTour(db, parseId(id), input);
  return ok(await getTourAdmin(db, parseId(id)));
});

/** DELETE /api/admin/tours/[id] — refused if bookings reference the tour (unpublish instead). */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  await deleteTour(getDb(), parseId(id));
  return noContent();
});
