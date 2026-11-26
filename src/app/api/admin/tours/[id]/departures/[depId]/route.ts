import { getDb } from "@/db/client";
import { deleteDeparture, updateDeparture } from "@/db/queries/tours";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, ok, parseBody, parseId, route } from "@/lib/http";
import { departureUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** PATCH /api/admin/tours/[id]/departures/[depId] — edit dates/seats/status/price modifier (toggle availability). */
export const PATCH = route<{ id: string; depId: string }>(async (req, { id, depId }) => {
  await requireAdmin(req);
  const input = await parseBody(req, departureUpsertSchema);
  await updateDeparture(getDb(), parseId(id), parseId(depId), input);
  return ok({ updated: true });
});

/** DELETE — refused while pending/confirmed bookings use the date (set status "cancelled" instead). */
export const DELETE = route<{ id: string; depId: string }>(async (req, { id, depId }) => {
  await requireAdmin(req);
  await deleteDeparture(getDb(), parseId(id), parseId(depId));
  return noContent();
});
