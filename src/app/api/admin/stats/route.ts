import { z } from "zod";
import { getDb } from "@/db/client";
import { getDashboardStats } from "@/db/queries/stats";
import { requireAdmin } from "@/lib/auth/guard";
import { badRequest, ok, parseQuery, route } from "@/lib/http";
import { isoDate } from "@/validators/common";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

const statsQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** GET /api/admin/stats?from&to — dashboard analytics (default: last 30 days). */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const range = parseQuery(req, statsQuery);
  if (range.from && range.to && range.from > range.to) throw badRequest("invalid_range");
  return ok(await getDashboardStats(getDb(), range));
});
