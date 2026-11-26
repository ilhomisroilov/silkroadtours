import { getDb } from "@/db/client";
import { getContact } from "@/db/queries/settings";
import { ok, route } from "@/lib/http";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/contact — agency name, phone, messengers and address for header/footer/confirmation. */
export const GET = route(async () => {
  return ok(await getContact(getDb()), {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
});
