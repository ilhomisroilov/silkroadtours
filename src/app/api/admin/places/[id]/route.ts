import { getDb } from "@/db/client";
import { deletePlaceAdmin, getPlaceAdmin, partnerExists, patchPlaceAdmin, updatePlaceAdmin } from "@/db/queries/admin-places";
import { requireAdmin } from "@/lib/auth/guard";
import { conflict, isUniqueViolation, noContent, notFound, ok, parseBody, parseId, route, unprocessable } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { placePatchSchema, placeUpsertSchema } from "@/validators/place";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const row = await getPlaceAdmin(getDb(), parseId(id));
  if (!row) throw notFound();
  return ok(row);
});

/** PUT — full update from the editor. The kind of an existing place cannot change. */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, placeUpsertSchema);
  const db = getDb();
  const placeId = parseId(id);
  const current = await getPlaceAdmin(db, placeId);
  if (!current) throw notFound();
  if (current.kind !== input.kind) throw unprocessable("kind_change_not_allowed");
  if (input.partnerId && !(await partnerExists(db, input.partnerId))) throw unprocessable("partner_not_found");
  try {
    await updatePlaceAdmin(db, placeId, input);
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("slug_taken");
    throw e;
  }
  await logAdminAction(db, admin, "update", `place:${input.kind}`, placeId, input.slug);
  return ok(await getPlaceAdmin(db, placeId));
});

/** PATCH — quick list actions: { isPublished } and/or { sortOrder }. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const patch = await parseBody(req, placePatchSchema);
  const db = getDb();
  const placeId = parseId(id);
  const current = await getPlaceAdmin(db, placeId);
  if (!current) throw notFound();
  await patchPlaceAdmin(db, placeId, patch);
  await logAdminAction(db, admin, patch.isPublished === undefined ? "reorder" : patch.isPublished ? "publish" : "unpublish", `place:${current.kind}`, placeId, current.slug);
  return ok({ id: placeId, ...patch });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin(req);
  const db = getDb();
  const placeId = parseId(id);
  const current = await getPlaceAdmin(db, placeId);
  if (!current) throw notFound();
  await deletePlaceAdmin(db, placeId);
  await logAdminAction(db, admin, "delete", `place:${current.kind}`, placeId, current.slug);
  return noContent();
});
