import { getDb, getEnv } from "@/db/client";
import { listPublishedReviews, submitGuestReview } from "@/db/queries/reviews";
import { ApiError, clientIp, created, ok, parseBody, parseQuery, route } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { reviewListQuerySchema, reviewSubmitSchema } from "@/validators/public";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/reviews?tour&destination&limit — published reviews with average rating. */
export const GET = route(async (req) => {
  const q = parseQuery(req, reviewListQuerySchema);
  return ok(await listPublishedReviews(getDb(), { tourSlug: q.tour, destinationSlug: q.destination, limit: q.limit }));
});

/** POST /api/reviews — a guest reviews their completed booking; held for moderation, marked verified. */
export const POST = route(async (req) => {
  const input = await parseBody(req, reviewSubmitSchema);
  const env = getEnv();
  const captcha = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp(req));
  if (!captcha.ok) throw new ApiError(400, "captcha_failed");
  const { turnstileToken: _t, ...review } = input;
  const row = await submitGuestReview(getDb(), review);
  return created({ id: row.id, status: "pending_moderation" });
});
