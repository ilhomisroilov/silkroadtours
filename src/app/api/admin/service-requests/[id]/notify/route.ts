import { getDb, getEnv } from "@/db/client";
import { getServiceRequest } from "@/db/queries/service-requests";
import { requireAdmin } from "@/lib/auth/guard";
import { ApiError, notFound, ok, parseId, route } from "@/lib/http";
import { notifyServiceRequest } from "@/lib/notify";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/service-requests/[id]/notify — re-send the Telegram alert. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const db = getDb();
  const r = await getServiceRequest(db, parseId(id));
  if (!r) throw notFound();
  const result = await notifyServiceRequest(db, getEnv(), {
    id: r.id,
    reference: r.reference,
    type: r.type,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    contactChannel: r.contactChannel,
    messengerHandle: r.messengerHandle,
    locale: r.locale,
    payload: r.payload,
  });
  if (!result.ok) throw new ApiError(502, "telegram_failed", result.error);
  return ok({ delivered: true, messageId: result.messageId });
});
