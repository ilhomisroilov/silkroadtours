import { getDb } from "@/db/client";
import { deleteContent, getContentById, updateContent } from "@/db/queries/content";
import { requireAdmin } from "@/lib/auth/guard";
import { conflict, isUniqueViolation, noContent, notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { contentUpsertSchema } from "@/validators/admin";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const item = await getContentById(getDb(), parseId(id));
  if (!item) throw notFound();
  return ok(item);
});

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, contentUpsertSchema);
  const itemId = parseId(id);
  if (!(await getContentById(getDb(), itemId))) throw notFound();
  try {
    await updateContent(getDb(), itemId, { ...input, updatedAt: new Date() } as never);
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("slug_taken");
    throw e;
  }
  await logAdminAction(getDb(), admin, "update", `content:${input.kind}`, itemId, input.slug);
  return ok({ updated: true });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const itemId = parseId(id);
  const item = await getContentById(getDb(), itemId);
  if (!item) throw notFound();
  await deleteContent(getDb(), itemId);
  await logAdminAction(getDb(), admin, "delete", `content:${item.kind}`, itemId, item.slug);
  return noContent();
});
