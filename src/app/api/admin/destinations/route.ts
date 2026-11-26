import { getDb } from "@/db/client";
import { createDestination, listDestinationsAdmin } from "@/db/queries/destinations";
import { requireAdmin } from "@/lib/auth/guard";
import { created, ok, parseBody, route } from "@/lib/http";
import { destinationUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/destinations */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok(await listDestinationsAdmin(getDb()));
});

/** POST /api/admin/destinations */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const input = await parseBody(req, destinationUpsertSchema);
  return created({ id: await createDestination(getDb(), input) });
});
