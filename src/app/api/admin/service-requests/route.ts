import { getDb } from "@/db/client";
import { listServiceRequests } from "@/db/queries/service-requests";
import { requireAdmin } from "@/lib/auth/guard";
import { ok, parseQuery, route } from "@/lib/http";
import { serviceRequestListQuerySchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/service-requests?type&status&page */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok(await listServiceRequests(getDb(), parseQuery(req, serviceRequestListQuerySchema)));
});
