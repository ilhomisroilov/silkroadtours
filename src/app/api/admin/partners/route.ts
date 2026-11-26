import { getDb } from "@/db/client";
import { listPartnersAdmin, partnerStatusCounts } from "@/db/queries/partners";
import { requireAdmin } from "@/lib/auth/guard";
import { ok, parseQuery, route } from "@/lib/http";
import { partnerListQuerySchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** GET /api/admin/partners?status=&type=&q=&page= — partner profiles with counts per status. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, partnerListQuerySchema);
  const db = getDb();
  const [list, counts] = await Promise.all([listPartnersAdmin(db, q), partnerStatusCounts(db)]);
  return ok({ ...list, counts });
});
