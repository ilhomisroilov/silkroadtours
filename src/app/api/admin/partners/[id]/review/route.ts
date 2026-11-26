import { getDb } from "@/db/client";
import { reviewPartner } from "@/db/queries/partners";
import { requireOwner } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { partnerReviewSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** POST /api/admin/partners/[id]/review — approve / reject (or return to review) with a note to the partner. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireOwner(req);
  const input = await parseBody(req, partnerReviewSchema);
  const done = await reviewPartner(getDb(), parseId(id), { ...input, adminId: admin.id });
  if (!done) throw notFound();
  return ok({ status: input.status });
});
