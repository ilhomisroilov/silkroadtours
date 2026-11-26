import { getDb } from "@/db/client";
import { getRates } from "@/db/queries/settings";
import { listPublishedTours } from "@/db/queries/tours";
import { ok, parseQuery, route } from "@/lib/http";
import { tourListQuerySchema } from "@/validators/public";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/tours — filtered, sorted, paginated tour cards with "from" price in the chosen currency. */
export const GET = route(async (req) => {
  const query = parseQuery(req, tourListQuerySchema);
  const db = getDb();
  const rates = await getRates(db);
  return ok(await listPublishedTours(db, query, rates));
});
