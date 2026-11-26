import { count, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { newsletterSubscribers } from "@/db/schema";
import { LOCALES } from "@/db/types";
import { assertSameOrigin, created, isUniqueViolation, ok, parseBody, route, tooManyRequests } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  locale: z.enum(LOCALES).default("en"),
  source: z.string().max(40).optional(),
});

/** POST /api/newsletter — stores an email for the occasional newsletter (idempotent). */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, schema);
  const db = getDb();
  // Global brake against scripted sign-ups: at most 60 new addresses per 10 minutes.
  const [recent] = await db
    .select({ n: count() })
    .from(newsletterSubscribers)
    .where(gt(newsletterSubscribers.createdAt, new Date(Date.now() - 10 * 60 * 1000)));
  if ((recent?.n ?? 0) >= 60) throw tooManyRequests();
  try {
    await db.insert(newsletterSubscribers).values({ email: input.email, locale: input.locale, source: input.source ?? "footer" });
  } catch (err) {
    if (isUniqueViolation(err)) return ok({ subscribed: true });
    throw err;
  }
  return created({ subscribed: true });
});
