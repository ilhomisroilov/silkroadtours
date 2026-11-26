import { getDb } from "@/db/client";
import { getContact, getRates, setSetting } from "@/db/queries/settings";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { notFound, ok, parseBody, route } from "@/lib/http";
import { contactSettingsSchema, exchangeRatesSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

const KEYS = ["exchange_rates", "contact"] as const;
type Key = (typeof KEYS)[number];
const isKey = (k: string): k is Key => (KEYS as readonly string[]).includes(k);

/** GET /api/admin/settings/[exchange_rates|contact] */
export const GET = route<{ key: string }>(async (req, { key }) => {
  await requireAdmin(req);
  if (!isKey(key)) throw notFound();
  const db = getDb();
  return ok(key === "exchange_rates" ? await getRates(db) : await getContact(db));
});

/** PUT /api/admin/settings/[exchange_rates|contact] — owners only. */
export const PUT = route<{ key: string }>(async (req, { key }) => {
  await requireOwner(req);
  if (!isKey(key)) throw notFound();
  const db = getDb();
  if (key === "exchange_rates") {
    const { rates } = await parseBody(req, exchangeRatesSchema);
    const value = { base: "USD" as const, rates, updatedAt: new Date().toISOString(), source: "manual" as const };
    await setSetting(db, "exchange_rates", value);
    return ok(value);
  }
  const value = await parseBody(req, contactSettingsSchema);
  await setSetting(db, "contact", value);
  return ok(value);
});
