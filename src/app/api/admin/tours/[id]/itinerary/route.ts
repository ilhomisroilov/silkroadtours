import { getDb } from "@/db/client";
import { replaceItinerary } from "@/db/queries/tours";
import { requireAdmin } from "@/lib/auth/guard";
import { ok, parseBody, parseId, route } from "@/lib/http";
import { itineraryReplaceSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** PUT /api/admin/tours/[id]/itinerary — atomically replace all days. */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const days = await parseBody(req, itineraryReplaceSchema);
  await replaceItinerary(getDb(), parseId(id), days);
  return ok({ days: days.length });
});
