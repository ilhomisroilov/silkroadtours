import { z } from "zod";
import { getDb } from "@/db/client";
import { updateAdmin } from "@/db/queries/admin-users";
import { requireAdmin } from "@/lib/auth/guard";
import { ok, parseBody, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/admin/auth/me — the signed-in admin, or 401. */
export const GET = route(async (req) => ok(await requireAdmin(req)));

const ownProfileSchema = z.object({ name: z.string().trim().min(2).max(80) });

/** PATCH /api/admin/auth/me — the signed-in admin renames themself (role, email and access stay with the owner). */
export const PATCH = route(async (req) => {
  const me = await requireAdmin(req);
  const { name } = await parseBody(req, ownProfileSchema);
  await updateAdmin(getDb(), me.id, me.id, { name });
  return ok({ updated: true });
});
