import { getDb } from "@/db/client";
import { createTour, listToursAdmin } from "@/db/queries/tours";
import { requireAdmin } from "@/lib/auth/guard";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http";
import { adminListQuerySchema, tourUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/tours?q&audience&published — all tours incl. drafts, with booking counts. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok(await listToursAdmin(getDb(), parseQuery(req, adminListQuerySchema)));
});

/** POST /api/admin/tours — create a tour (add itinerary and pricing via their endpoints). */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const input = await parseBody(req, tourUpsertSchema);
  return created({ id: await createTour(getDb(), input) });
});
