import { getDb } from "@/db/client";
import { updateAdmin } from "@/db/queries/admin-users";
import { requireOwner } from "@/lib/auth/guard";
import { ok, parseBody, parseId, route } from "@/lib/http";
import { adminUserUpdateSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** PATCH /api/admin/users/[id] — rename, change role, (de)activate, reset password. The last owner is protected. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const owner = await requireOwner(req);
  const patch = await parseBody(req, adminUserUpdateSchema);
  await updateAdmin(getDb(), parseId(id), owner.id, patch);
  return ok({ updated: true });
});
