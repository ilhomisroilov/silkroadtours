import { getDb } from "@/db/client";
import { requireAdmin } from "@/lib/auth/guard";
import { assertSameOrigin, noContent, notFound, route } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { deleteUpload } from "@/lib/server/media";

export const dynamic = "force-dynamic";

export const DELETE = route<{ name: string }>(async (req, { name }) => {
  assertSameOrigin(req);
  const admin = await requireAdmin(req);
  if (!(await deleteUpload(name))) throw notFound();
  await logAdminAction(getDb(), admin, "delete", "media", name);
  return noContent();
});
