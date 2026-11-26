import { getDb } from "@/db/client";
import { destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin, ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/auth/logout */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await destroySession(getDb(), req.cookies.get(SESSION_COOKIE)?.value);
  const res = ok({ signedOut: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
});
