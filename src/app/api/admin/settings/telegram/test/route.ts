import { getEnv } from "@/db/client";
import { requireAdmin } from "@/lib/auth/guard";
import { ApiError, ok, route } from "@/lib/http";
import { sendTelegramTest } from "@/lib/notify";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/settings/telegram/test — sends a test message to TELEGRAM_CHAT_ID. */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const result = await sendTelegramTest(getEnv(), admin.name);
  if (!result.ok) throw new ApiError(502, "telegram_failed", result.error);
  return ok({ delivered: true });
});
