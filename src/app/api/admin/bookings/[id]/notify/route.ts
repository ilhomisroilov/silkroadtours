import { getDb, getEnv } from "@/db/client";
import { getBookingAdmin } from "@/db/queries/bookings";
import { requireAdmin } from "@/lib/auth/guard";
import { ApiError, notFound, ok, parseId, route } from "@/lib/http";
import { localize } from "@/lib/localize";
import { notifyBooking } from "@/lib/notify";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/admin/bookings/[id]/notify — re-send the Telegram alert (e.g. after fixing the bot config). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const db = getDb();
  const b = await getBookingAdmin(db, parseId(id));
  if (!b) throw notFound();
  const result = await notifyBooking(db, getEnv(), {
    id: b.id,
    reference: b.reference,
    audience: b.audience,
    bookingType: b.bookingType,
    tourTitle: b.tour ? localize(b.tour.title, "en") : b.tourTitleSnapshot,
    destinationName: b.destination ? localize(b.destination.name, "en") : null,
    preferredDate: b.preferredDate,
    adults: b.adults,
    children: b.children,
    fullName: b.fullName,
    email: b.email,
    phone: b.phone,
    contactChannel: b.contactChannel,
    messengerHandle: b.messengerHandle,
    country: b.country,
    locale: b.locale,
    specialRequests: b.specialRequests,
    quote: b.quoteTotalMinor != null ? { totalMinor: b.quoteTotalMinor, currency: b.quoteCurrency } : null,
  });
  if (!result.ok) throw new ApiError(502, "telegram_failed", result.error);
  return ok({ delivered: true, messageId: result.messageId });
});
