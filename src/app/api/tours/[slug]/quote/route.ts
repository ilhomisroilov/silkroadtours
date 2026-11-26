import { getDb } from "@/db/client";
import { getRates } from "@/db/queries/settings";
import { getTourForQuote } from "@/db/queries/tours";
import { notFound, ok, parseQuery, route, unprocessable } from "@/lib/http";
import { quote } from "@/lib/pricing";
import { quoteQuerySchema } from "@/validators/booking";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/tours/[slug]/quote?adults&children&type&currency&departureId — live price for the booking card. */
export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const q = parseQuery(req, quoteQuerySchema);
  const db = getDb();
  const [tour, rates] = await Promise.all([getTourForQuote(db, slug, q.departureId), getRates(db)]);
  if (!tour) throw notFound("tour_not_found");
  if (q.departureId && !tour.departure) throw notFound("departure_not_found");
  const result = quote({
    tour,
    tiers: tour.tiers,
    bookingType: q.type,
    adults: q.adults,
    children: q.children,
    currency: q.currency,
    rates,
    departure: tour.departure,
  });
  if (!result.ok) throw unprocessable(`quote_${result.reason}`);
  return ok(result, { headers: { "cache-control": "no-store" } });
});
