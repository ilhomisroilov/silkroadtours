import { getDb } from "@/db/client";
import { createManualLead, getLead, LeadInputError, listLeads } from "@/db/queries/crm";
import { requireAdmin } from "@/lib/auth/guard";
import { created, ok, parseBody, parseQuery, route, unprocessable } from "@/lib/http";
import { todayInTashkent } from "@/validators/common";
import { leadCreateSchema, leadListQuerySchema } from "@/validators/lead";

export const dynamic = "force-dynamic";

/** GET /api/admin/leads — CRM leads with filters (q, stage, source, assigned, destination, followUp), sort and paging. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, leadListQuerySchema);
  return ok(await listLeads(getDb(), q, todayInTashkent()));
});

/** POST /api/admin/leads — a lead entered by hand (source "admin"). */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, leadCreateSchema);
  const db = getDb();
  try {
    const id = await createManualLead(db, input, admin.id);
    return created(await getLead(db, id));
  } catch (err) {
    if (err instanceof LeadInputError) throw unprocessable(err.code);
    throw err;
  }
});
