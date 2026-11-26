import { getDb } from "@/db/client";
import { deleteDestination, getDestinationAdmin, updateDestination } from "@/db/queries/destinations";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { destinationUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const row = await getDestinationAdmin(getDb(), parseId(id));
  if (!row) throw notFound();
  return ok(row);
});

export const PUT = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const input = await parseBody(req, destinationUpsertSchema);
  const db = getDb();
  await updateDestination(db, parseId(id), input);
  return ok(await getDestinationAdmin(db, parseId(id)));
});

/** DELETE — refused while tours start at this destination. */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  await deleteDestination(getDb(), parseId(id));
  return noContent();
});
