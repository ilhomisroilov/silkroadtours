import { requireAdmin } from "@/lib/auth/guard";
import { ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/auth/me — the signed-in admin, or 401. */
export const GET = route(async (req) => ok(await requireAdmin(req)));
