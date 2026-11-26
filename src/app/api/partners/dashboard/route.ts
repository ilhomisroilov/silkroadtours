import { getDb } from "@/db/client";
import { getPartnerByCredentials, updatePartnerListing } from "@/db/queries/partners";
import { assertSameOrigin, conflict, notFound, ok, parseBody, route } from "@/lib/http";
import { formatService } from "@/lib/partners";
import { partnerSelfUpdateSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** PATCH /api/partners/dashboard — the partner updates description and services while the profile is under review. */
export const PATCH = route(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, partnerSelfUpdateSchema);
  const db = getDb();
  const partner = await getPartnerByCredentials(db, input.reference, input.token);
  if (!partner) throw notFound("partner_not_found");
  if (partner.status !== "pending") throw conflict("partner_not_editable");
  await updatePartnerListing(db, partner.id, { description: input.description, services: input.services.map(formatService) });
  return ok({ updated: true });
});
