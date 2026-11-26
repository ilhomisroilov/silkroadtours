import { z } from "zod";
import { getDb } from "@/db/client";
import { listAttractions, listPlaces } from "@/db/queries/places";
import { PLACE_KINDS } from "@/db/types";
import { ok, parseQuery, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const query = z.object({
  kind: z.enum([...PLACE_KINDS, "attraction"]).optional(),
  destination: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * GET /api/places?kind=hotel|restaurant|transport|attraction&destination=samarkand&q=…
 * Without kind: hotels, restaurants, transport and attractions together (for maps and the trip builder).
 * Prices are indicative "from" prices in USD, never live availability.
 */
export const GET = route(async (req) => {
  const f = parseQuery(req, query);
  const db = getDb();
  const wantAttractions = !f.kind || f.kind === "attraction";
  const [rows, attractions] = await Promise.all([
    f.kind === "attraction" ? Promise.resolve([]) : listPlaces(db, { kind: f.kind === undefined ? undefined : f.kind, destination: f.destination, q: f.q, limit: f.limit }),
    wantAttractions ? listAttractions(db, { destination: f.destination }) : Promise.resolve([]),
  ]);
  const needle = f.q?.toLowerCase();
  const attr = needle ? attractions.filter((a) => JSON.stringify(a.name).toLowerCase().includes(needle)) : attractions;
  return ok({ places: rows, attractions: f.limit ? attr.slice(0, f.limit) : attr });
});
