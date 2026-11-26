import { getDb } from "@/db/client";
import { createPlaceAdmin, listPlacesAdmin, partnerExists } from "@/db/queries/admin-places";
import { requireAdmin } from "@/lib/auth/guard";
import { conflict, created, isUniqueViolation, ok, parseBody, parseQuery, route, unprocessable } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { placeListQuerySchema, placeUpsertSchema } from "@/validators/place";

export const dynamic = "force-dynamic";

/** GET /api/admin/places?kind=hotel|restaurant|transport&destination=&q=&published=&source= */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, placeListQuerySchema);
  return ok(await listPlacesAdmin(getDb(), q));
});

/** POST /api/admin/places — new rows are marked source "admin". Audited. */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, placeUpsertSchema);
  const db = getDb();
  if (input.partnerId && !(await partnerExists(db, input.partnerId))) throw unprocessable("partner_not_found");
  try {
    const id = await createPlaceAdmin(db, input);
    await logAdminAction(db, admin, "create", `place:${input.kind}`, id, input.slug);
    return created({ id });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("slug_taken");
    throw e;
  }
});
