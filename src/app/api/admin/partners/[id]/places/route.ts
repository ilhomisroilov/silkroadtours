import { getDb } from "@/db/client";
import { getPartner, setPlacePartner } from "@/db/queries/partners";
import { requireOwner } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { partnerPlaceLinkSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** POST /api/admin/partners/[id]/places — link a hotel, restaurant or transport listing to the partner, or unlink it. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  await requireOwner(req);
  const { placeId, action } = await parseBody(req, partnerPlaceLinkSchema);
  const db = getDb();
  const partner = await getPartner(db, parseId(id));
  if (!partner) throw notFound();
  const done = action === "link" ? await setPlacePartner(db, placeId, partner.id) : await setPlacePartner(db, placeId, null, partner.id);
  if (!done) throw notFound("place_not_found");
  return ok({ placeId, action });
});
