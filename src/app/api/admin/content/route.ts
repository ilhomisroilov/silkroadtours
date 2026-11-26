import { getDb } from "@/db/client";
import { createContent, listContentAdmin } from "@/db/queries/content";
import { requireAdmin } from "@/lib/auth/guard";
import { conflict, created, isUniqueViolation, ok, parseBody, parseQuery, route } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { contentListQuerySchema, contentUpsertSchema } from "@/validators/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, contentListQuerySchema);
  return ok(await listContentAdmin(getDb(), q.kind, q.q));
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, contentUpsertSchema);
  try {
    const id = await createContent(getDb(), input);
    await logAdminAction(getDb(), admin, "create", `content:${input.kind}`, id, input.slug);
    return created({ id });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("slug_taken");
    throw e;
  }
});
