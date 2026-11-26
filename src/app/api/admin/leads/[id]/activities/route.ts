import { getDb } from "@/db/client";
import { addLeadActivity, getLead, listLeadActivities } from "@/db/queries/crm";
import { requireAdmin } from "@/lib/auth/guard";
import { created, notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { leadActivityCreateSchema } from "@/validators/lead";

export const dynamic = "force-dynamic";

/** GET /api/admin/leads/[id]/activities — history, newest first. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const db = getDb();
  const lead = await getLead(db, parseId(id));
  if (!lead) throw notFound();
  return ok(await listLeadActivities(db, lead.id));
});

/** POST /api/admin/leads/[id]/activities — log a call, an email or a note. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, leadActivityCreateSchema);
  const db = getDb();
  const lead = await getLead(db, parseId(id));
  if (!lead) throw notFound();
  await addLeadActivity(db, lead.id, admin.id, input.kind, input.text);
  return created(await listLeadActivities(db, lead.id));
});
