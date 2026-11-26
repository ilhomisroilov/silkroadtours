import { getDb } from "@/db/client";
import { duplicateTour } from "@/db/queries/tours";
import { requireAdmin } from "@/lib/auth/guard";
import { created, parseId, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/tours/[id]/duplicate — copy as an unpublished draft (slug "<slug>-copy"). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  return created({ id: await duplicateTour(getDb(), parseId(id)) });
});
