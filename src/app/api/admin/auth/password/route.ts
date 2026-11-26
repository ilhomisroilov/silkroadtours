import { getDb, getEnv } from "@/db/client";
import { findAdminById, setAdminPassword } from "@/db/queries/admin-users";
import { requireAdmin } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessionsForUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto";
import { ApiError, clientIp, ok, parseBody, route } from "@/lib/http";
import { passwordChangeSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/auth/password — change own password; signs out all other sessions. */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const { currentPassword, newPassword } = await parseBody(req, passwordChangeSchema);
  const db = getDb();
  const user = await findAdminById(db, admin.id);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "current_password_incorrect");
  }
  await setAdminPassword(db, admin.id, newPassword);
  await destroyAllSessionsForUser(db, admin.id);
  const token = await createSession(db, admin.id, {
    ipHash: await hashIp(clientIp(req), getEnv().SESSION_SECRET),
    userAgent: req.headers.get("user-agent"),
  });
  const res = ok({ changed: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
