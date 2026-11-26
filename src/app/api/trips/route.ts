import { getDb, getEnv } from "@/db/client";
import { hashIp } from "@/lib/crypto";
import { clientIp, created, parseBody, route, tooManyRequests } from "@/lib/http";
import { insertTripSnapshot, tooManyTripSaves } from "@/lib/server/trips";
import { tripSaveSchema } from "@/validators/trip";

export const dynamic = "force-dynamic";

/**
 * POST /api/trips — stores a snapshot of the visitor's Trip Constructor plan (saved_trip_plans, request "trip-builder")
 * and returns its id for the share link /trip-builder?trip=<id>. Body ≤ 64 KB, ≤ 80 items, rate-limited per visitor.
 */
export const POST = route(async (req) => {
  const input = await parseBody(req, tripSaveSchema);
  const db = getDb();
  const ipHash = await hashIp(clientIp(req), getEnv().SESSION_SECRET || "dev");
  if (await tooManyTripSaves(db, ipHash)) throw tooManyRequests();
  const { id, estimate } = await insertTripSnapshot(db, input, ipHash);
  return created({ id, estimate });
});
