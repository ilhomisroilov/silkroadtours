import { z } from "zod";
import { getDb } from "@/db/client";
import { adminAuditLogs, settings } from "@/db/schema";
import { getAiSettings } from "@/lib/ai/agent";
import { providerStatus } from "@/lib/ai/admin";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { ok, parseBody, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  assistantName: z.string().trim().min(2).max(60),
  temperature: z.number().min(0).max(1),
  maxOutputTokens: z.number().int().min(200).max(2000),
  timeoutMs: z.number().int().min(5000).max(60000),
  perMinuteLimit: z.number().int().min(2).max(60),
  retentionDays: z.number().int().min(1).max(365),
  enabled: z.boolean(),
  welcome: z.object({ en: z.string().trim().min(2).max(400), uz: z.string().trim().min(2).max(400), ru: z.string().trim().min(2).max(400) }),
  extraInstructions: z.string().max(2000),
});

/** GET /api/admin/ai/settings — current AI settings and provider status (keys masked). */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok({ settings: await getAiSettings(getDb()), provider: providerStatus() });
});

/** PUT /api/admin/ai/settings — owners only; the protected core rules are not editable here. Audited. */
export const PUT = route(async (req) => {
  const admin = await requireOwner(req);
  const value = await parseBody(req, schema);
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: "ai", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  await db.insert(adminAuditLogs).values({ adminId: admin.id, action: "update", entity: "settings", entityId: "ai", detail: JSON.stringify({ enabled: value.enabled, temperature: value.temperature }) });
  return ok(value);
});
