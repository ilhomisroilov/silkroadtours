import { getDb, getEnv } from "@/db/client";
import { countAdmins, createAdmin } from "@/db/queries/admin-users";
import { timingSafeEqualString } from "@/lib/crypto";
import { ApiError, conflict, created, forbidden, parseBody, route } from "@/lib/http";
import { bootstrapAdminSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/auth/bootstrap  (header: x-admin-secret: <ADMIN_SECRET>)
 * Creates the first owner account. Permanently disabled once any admin exists.
 */
export const POST = route(async (req) => {
  const env = getEnv();
  const secret = env.ADMIN_SECRET ?? "";
  if (secret.length < 16) throw new ApiError(503, "bootstrap_disabled", "ADMIN_SECRET is not set (min 16 chars).");
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!timingSafeEqualString(provided, secret)) throw forbidden("invalid_admin_secret");

  const db = getDb();
  if ((await countAdmins(db)) > 0) throw conflict("already_bootstrapped");
  const input = await parseBody(req, bootstrapAdminSchema);
  const id = await createAdmin(db, { ...input, role: "owner" });
  return created({ id, email: input.email, role: "owner" });
});
