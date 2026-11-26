import { getDb, getEnv } from "@/db/client";
import { todayTashkent } from "@/db/batch";
import { insertBooking } from "@/db/queries/bookings";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { getContact, getRates } from "@/db/queries/settings";
import { getTourForQuote } from "@/db/queries/tours";
import type { Audience } from "@/db/types";
import { runInBackground } from "@/lib/background";
import { hashIp } from "@/lib/crypto";
import {
  ApiError,
  clientIp,
  created,
  notFound,
  parseBody,
  route,
  tooManyRequests,
  unprocessable,
} from "@/lib/http";
import { localize } from "@/lib/localize";
import { notifyBooking } from "@/lib/notify";
import { quote, type QuoteResult } from "@/lib/pricing";
import { tooManySubmissions } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { bookingInputSchema } from "@/validators/booking";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/**
 * POST /api/bookings
 * Turnstile → validation → server-side quote → insert (PENDING) → Telegram alert (after response) → reference.
 */
export const POST = route(async (req) => {
  const input = await parseBody(req, bookingInputSchema);
  const env = getEnv();
  const db = getDb();
  const ip = clientIp(req);

  const captcha = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!captcha.ok) throw new ApiError(400, "captcha_failed");

  const ipHash = await hashIp(ip, env.SESSION_SECRET);
  if (await tooManySubmissions(db, ipHash)) throw tooManyRequests();

  let audience: Audience;
  let tourId: number | null = null;
  let departureId: number | null = null;
  let destinationId: number | null = null;
  let tourTitle: string | null = null;
  let destinationName: string | null = null;
  let preferredDate = input.preferredDate;
  let priced: Extract<QuoteResult, { ok: true }> | null = null;

  if (input.tourSlug) {
    const tour = await getTourForQuote(db, input.tourSlug, input.departureId);
    if (!tour) throw notFound("tour_not_found");
    if (input.departureId) {
      if (!tour.departure) throw notFound("departure_not_found");
      if (tour.departure.startDate < todayTashkent()) throw unprocessable("departure_in_past");
      preferredDate = tour.departure.startDate;
      departureId = tour.departure.id;
    }
    const result = quote({
      tour,
      tiers: tour.tiers,
      bookingType: input.bookingType,
      adults: input.adults,
      children: input.children,
      currency: input.currency,
      rates: await getRates(db),
      departure: tour.departure,
    });
    if (!result.ok) throw unprocessable(`quote_${result.reason}`);
    priced = result;
    audience = tour.audience;
    tourId = tour.id;
    destinationId = tour.primaryDestinationId;
    tourTitle = localize(tour.title, "en");
  } else {
    const destination = await getPublishedDestinationBySlug(db, input.destinationSlug!);
    if (!destination) throw notFound("destination_not_found");
    audience = input.audience ?? (input.locale === "uz" ? "domestic" : "inbound");
    destinationId = destination.id;
    destinationName = localize(destination.name, "en");
  }

  const { id, reference } = await insertBooking(db, {
    tourId,
    departureId,
    destinationId,
    tourTitleSnapshot: tourTitle,
    audience,
    bookingType: input.bookingType,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    contactChannel: input.contactChannel,
    messengerHandle: input.messengerHandle ?? null,
    country: input.country ?? null,
    preferredDate,
    adults: input.adults,
    children: input.children,
    specialRequests: input.specialRequests ?? null,
    locale: input.locale,
    quoteCurrency: input.currency,
    quoteTotalMinor: priced?.totalMinor ?? null,
    quoteTotalUsdCents: priced?.totalUsdCents ?? null,
    ipHash,
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    utmSource: input.utmSource ?? null,
  });

  await runInBackground(
    notifyBooking(db, env, {
      id,
      reference,
      audience,
      bookingType: input.bookingType,
      tourTitle,
      destinationName,
      preferredDate,
      adults: input.adults,
      children: input.children,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      contactChannel: input.contactChannel,
      messengerHandle: input.messengerHandle,
      country: input.country,
      locale: input.locale,
      specialRequests: input.specialRequests,
      quote: priced ? { totalMinor: priced.totalMinor, currency: priced.currency } : null,
    }),
  );

  const contact = await getContact(db);
  return created({
    reference,
    status: "pending" as const,
    preferredDate,
    quote: priced,
    followUp: { whatsapp: contact.whatsapp, telegram: contact.telegram, phone: contact.phone },
  });
});
