import { count } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { destinations, tours } from "@/db/schema";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

const TURNSTILE_TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

/**
 * GET /api/health — is the app up and can it read the database?
 * Configuration details (true/false only, never secret values) are shown in development
 * or to a signed-in admin, so you can check setup without exposing it publicly.
 */
export const GET = route(async (req) => {
  const db = getDb();
  const env = getEnv();
  const [[d], [t]] = await Promise.all([
    db.select({ n: count() }).from(destinations),
    db.select({ n: count() }).from(tours),
  ]);

  const showDetails =
    process.env.NODE_ENV !== "production" ||
    (await validateSession(db, req.cookies.get(SESSION_COOKIE)?.value)) !== null;

  return ok(
    {
      status: "ok",
      database: { destinations: d?.n ?? 0, tours: t?.n ?? 0 },
      ...(showDetails
        ? {
            config: {
              telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
              sessionSecretSet: (env.SESSION_SECRET ?? "").length >= 32,
              adminSecretSet: (env.ADMIN_SECRET ?? "").length >= 16,
              turnstileSecretSet: Boolean(env.TURNSTILE_SECRET_KEY),
              turnstileIsTestKey: TURNSTILE_TEST_SECRETS.has(env.TURNSTILE_SECRET_KEY ?? ""),
              siteUrl: env.SITE_URL,
            },
          }
        : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
