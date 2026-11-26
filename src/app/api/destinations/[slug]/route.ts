import { getDb } from "@/db/client";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { listPublishedReviews } from "@/db/queries/reviews";
import { getRates } from "@/db/queries/settings";
import { listPublishedTours } from "@/db/queries/tours";
import { notFound, ok, parseQuery, route } from "@/lib/http";
import { currencyQuerySchema } from "@/validators/public";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** GET /api/destinations/[slug]?currency= — landing page data with linked tours and reviews. */
export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const { currency } = parseQuery(req, currencyQuerySchema);
  const db = getDb();
  const destination = await getPublishedDestinationBySlug(db, slug);
  if (!destination) throw notFound("destination_not_found");
  const rates = await getRates(db);
  const [tours, reviews] = await Promise.all([
    listPublishedTours(db, { destination: slug, sort: "featured", currency, page: 1, pageSize: 48 }, rates),
    listPublishedReviews(db, { destinationSlug: slug, limit: 6 }),
  ]);
  return ok({ destination, tours: tours.items, reviews });
});
