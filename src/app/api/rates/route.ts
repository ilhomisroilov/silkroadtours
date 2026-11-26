import { getDb } from "@/db/client";
import { getRates } from "@/db/queries/settings";
import { ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/rates — exchange rates used for all price conversions (cached at the edge for 10 minutes). */
export const GET = route(async () => {
  return ok(await getRates(getDb()), {
    headers: { "cache-control": "public, max-age=60, s-maxage=600" },
  });
});
