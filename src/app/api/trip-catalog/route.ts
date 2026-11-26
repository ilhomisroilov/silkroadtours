import { z } from "zod";
import { getDb } from "@/db/client";
import { getRates } from "@/db/queries/settings";
import { LOCALES } from "@/db/types";
import { ok, parseQuery, route } from "@/lib/http";
import { tripCatalog } from "@/lib/server/trip-catalog";

export const dynamic = "force-dynamic";

const query = z.object({
  locale: z.enum(LOCALES).default("en"),
  destination: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
});

/**
 * GET /api/trip-catalog?locale=en&destination=samarkand — read-only list of experiences and published tours for the
 * Trip Constructor (hotels, restaurants, transport and sights come from GET /api/places). Prices are indicative USD.
 */
export const GET = route(async (req) => {
  const q = parseQuery(req, query);
  const db = getDb();
  const data = await tripCatalog(db, q.locale, await getRates(db), { destination: q.destination });
  return ok(data, { headers: { "cache-control": "public, max-age=60" } });
});
