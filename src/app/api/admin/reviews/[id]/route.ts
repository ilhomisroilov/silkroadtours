import { getDb } from "@/db/client";
import { deleteReview, moderateReview } from "@/db/queries/reviews";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, ok, parseBody, parseId, route } from "@/lib/http";
import { reviewModerationSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** PATCH /api/admin/reviews/[id] — publish/unpublish, mark verified. Tour rating is recomputed. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const patch = await parseBody(req, reviewModerationSchema);
  await moderateReview(getDb(), parseId(id), patch);
  return ok({ updated: true });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  await deleteReview(getDb(), parseId(id));
  return noContent();
});
