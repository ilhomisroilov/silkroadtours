import { getDb } from "@/db/client";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/destinations — directory with published tour counts and map coordinates. */
export const GET = route(async () => {
  return ok(await listPublishedDestinations(getDb()));
});
