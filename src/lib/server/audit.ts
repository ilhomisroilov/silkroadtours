import "server-only";
import type { Db } from "@/db/client";
import { adminAuditLogs } from "@/db/schema";
import type { SessionAdmin } from "@/lib/auth/session";

/** Who changed what in the admin; failures here never block the change itself. */
export async function logAdminAction(db: Db, admin: SessionAdmin, action: string, entity: string, entityId?: string | number | null, detail?: string) {
  try {
    await db.insert(adminAuditLogs).values({ adminId: admin.id, action, entity, entityId: entityId == null ? null : String(entityId), detail: detail?.slice(0, 500) ?? null });
  } catch {
    /* audit is best-effort */
  }
}
