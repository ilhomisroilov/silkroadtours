import { getDb } from "@/db/client";
import { getLead, LeadInputError, listLeadActivities, updateLead } from "@/db/queries/crm";
import { requireAdmin } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route, unprocessable } from "@/lib/http";
import { leadUpdateSchema } from "@/validators/lead";

export const dynamic = "force-dynamic";

/** GET /api/admin/leads/[id] — the lead with its activity history. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const db = getDb();
  const lead = await getLead(db, parseId(id));
  if (!lead) throw notFound();
  return ok({ ...lead, activities: await listLeadActivities(db, lead.id) });
});

/** PATCH /api/admin/leads/[id] — stage, manager (assignedTo), follow-up date and lead details; every change is logged. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const patch = await parseBody(req, leadUpdateSchema);
  const db = getDb();
  const leadId = parseId(id);
  try {
    if (!(await updateLead(db, leadId, patch, admin.id))) throw notFound();
  } catch (err) {
    if (err instanceof LeadInputError) throw unprocessable(err.code);
    throw err;
  }
  return ok(await getLead(db, leadId));
});
