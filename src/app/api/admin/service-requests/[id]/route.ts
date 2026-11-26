import { getDb } from "@/db/client";
import { getServiceRequest, updateServiceRequest } from "@/db/queries/service-requests";
import { requireAdmin } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { serviceRequestUpdateSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/service-requests/[id] */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const row = await getServiceRequest(getDb(), parseId(id));
  if (!row) throw notFound();
  return ok(row);
});

/** PATCH /api/admin/service-requests/[id] — status and internal notes. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const patch = await parseBody(req, serviceRequestUpdateSchema);
  const db = getDb();
  await updateServiceRequest(db, parseId(id), patch);
  return ok(await getServiceRequest(db, parseId(id)));
});
