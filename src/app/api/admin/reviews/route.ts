import { getDb } from "@/db/client";
import { createReviewAdmin, listReviewsAdmin } from "@/db/queries/reviews";
import { requireAdmin } from "@/lib/auth/guard";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http";
import { reviewCreateSchema, reviewListQuerySchemaAdmin } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/reviews?published&tourId&page — includes reviews awaiting moderation. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok(await listReviewsAdmin(getDb(), parseQuery(req, reviewListQuerySchemaAdmin)));
});

/** POST /api/admin/reviews — add a real review received on Google/TripAdvisor (link to the original required). */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const input = await parseBody(req, reviewCreateSchema);
  return created({ id: await createReviewAdmin(getDb(), input) });
});
