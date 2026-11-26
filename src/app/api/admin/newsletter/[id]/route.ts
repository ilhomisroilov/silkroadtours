import { getDb } from "@/db/client";
import { deleteSubscriber } from "@/db/queries/content";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, parseId, route } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const subId = parseId(id);
  await deleteSubscriber(getDb(), subId);
  await logAdminAction(getDb(), admin, "delete", "newsletter", subId);
  return noContent();
});
