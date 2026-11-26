import { getDb } from "@/db/client";
import { addBookingNote } from "@/db/queries/bookings";
import { requireAdmin } from "@/lib/auth/guard";
import { created, parseBody, parseId, route } from "@/lib/http";
import { bookingNoteSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/bookings/[id]/notes — internal note (never shown to the customer). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const { body } = await parseBody(req, bookingNoteSchema);
  return created(await addBookingNote(getDb(), parseId(id), admin.id, body));
});
