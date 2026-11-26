import { getDb } from "@/db/client";
import { setSetting } from "@/db/queries/settings";
import { requireAdmin } from "@/lib/auth/guard";
import { ApiError, ok, route } from "@/lib/http";
import { fetchCbuRates } from "@/lib/rates-cbu";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/settings/rates/refresh — pull today's official USD/EUR rates from cbu.uz. */
export const POST = route(async (req) => {
  await requireAdmin(req);
  let rates;
  try {
    rates = await fetchCbuRates();
  } catch (err) {
    throw new ApiError(502, "cbu_unavailable", err instanceof Error ? err.message : String(err));
  }
  await setSetting(getDb(), "exchange_rates", rates);
  return ok(rates);
});
