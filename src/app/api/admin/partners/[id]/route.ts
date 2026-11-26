import { getDb } from "@/db/client";
import { getPartner, listPartnerPlaces, partnerInquiries, partnerLeadStats, updatePartnerAdmin } from "@/db/queries/partners";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { notFound, ok, parseBody, parseId, route } from "@/lib/http";
import { formatService } from "@/lib/partners";
import { partnerAdminUpdateSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** GET /api/admin/partners/[id] — profile, linked places, inquiries and lead counts. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const db = getDb();
  const partner = await getPartner(db, parseId(id));
  if (!partner) throw notFound();
  const placeList = await listPartnerPlaces(db, partner.id);
  const [inquiries, leads] = await Promise.all([partnerInquiries(db, partner, placeList), partnerLeadStats(db, partner, placeList)]);
  const { token: _token, ipHash: _ip, ...rest } = partner;
  return ok({ partner: rest, places: placeList, inquiries, leads });
});

/** PATCH /api/admin/partners/[id] — edit business info and services (owner accounts only). */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  await requireOwner(req);
  const { services, ...patch } = await parseBody(req, partnerAdminUpdateSchema);
  const done = await updatePartnerAdmin(getDb(), parseId(id), { ...patch, ...(services ? { services: services.map(formatService) } : {}) });
  if (!done) throw notFound();
  return ok({ updated: true });
});
