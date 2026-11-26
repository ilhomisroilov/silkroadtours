import { getDb } from "@/db/client";
import { deleteFaq, updateFaq } from "@/db/queries/faq";
import { requireAdmin } from "@/lib/auth/guard";
import { noContent, ok, parseBody, parseId, route } from "@/lib/http";
import { faqUpsertSchema } from "@/validators/admin";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

export const PUT = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const input = await parseBody(req, faqUpsertSchema);
  await updateFaq(getDb(), parseId(id), input);
  return ok({ updated: true });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  await deleteFaq(getDb(), parseId(id));
  return noContent();
});
