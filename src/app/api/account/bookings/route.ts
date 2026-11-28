import { getDb } from "@/db/client";
import { listAccountBookings } from "@/db/queries/bookings";
import { ApiError, ok, route } from "@/lib/http";
import { currentAccount } from "@/lib/server/account";

export const dynamic = "force-dynamic";

/** GET /api/account/bookings: the signed-in traveller's booking requests (newest first). */
export const GET = route(async (req) => {
  const account = await currentAccount(req.headers.get("cookie"));
  if (!account) throw new ApiError(401, "unauthorized");
  const rows = await listAccountBookings(getDb(), { id: account.id, email: account.email, emailVerified: account.email_verified });
  return ok(rows.map((r) => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt })));
});
