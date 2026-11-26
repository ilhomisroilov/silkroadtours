import { getDb } from "@/db/client";
import { notFound, ok, route } from "@/lib/http";
import { getTripSnapshot, publicSnapshot } from "@/lib/server/trips";

export const dynamic = "force-dynamic";

/** GET /api/trips/<id> — a saved Trip Constructor snapshot (read-only; anyone with the link can open it). */
export const GET = route<{ id: string }>(async (_req, { id }) => {
  const snap = await getTripSnapshot(getDb(), id);
  if (!snap) throw notFound();
  return ok(publicSnapshot(snap), { headers: { "cache-control": "no-store" } });
});
