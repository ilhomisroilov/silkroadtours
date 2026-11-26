import { getDb, getEnv } from "@/db/client";
import { findAdminByEmail, touchLastLogin } from "@/db/queries/admin-users";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { hashIp, sha256Hex } from "@/lib/crypto";
import { ApiError, assertSameOrigin, clientIp, ok, parseBody, route, tooManyRequests } from "@/lib/http";
import { clearFailedLogins, isLoginLocked, recordFailedLogin } from "@/lib/rate-limit";
import { loginSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/auth/login — sets the HttpOnly session cookie. 5 failed attempts per 15 min lock the email+IP. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { email, password } = await parseBody(req, loginSchema);
  const db = getDb();
  const env = getEnv();
  const ipHash = await hashIp(clientIp(req), env.SESSION_SECRET);
  const key = `${await sha256Hex(email)}:${ipHash}`;
  if (await isLoginLocked(db, key)) throw tooManyRequests("login_locked");

  const user = await findAdminByEmail(db, email);
  // Always run PBKDF2 so timing doesn't reveal whether the email exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !user.isActive || !valid) {
    await recordFailedLogin(db, key);
    throw new ApiError(401, "invalid_credentials");
  }

  await clearFailedLogins(db, key);
  const token = await createSession(db, user.id, { ipHash, userAgent: req.headers.get("user-agent") });
  await touchLastLogin(db, user.id);
  const res = ok({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
