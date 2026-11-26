import "server-only";
import { listContent } from "@/db/queries/content";
import { listPublishedTours } from "@/db/queries/tours";
import type { Db } from "@/db/client";
import type { ExchangeRates, Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { convertMinor } from "@/lib/pricing";
import type { CatalogExperience, CatalogTour } from "@/lib/trip-helpers";
import { tourListQuerySchema } from "@/validators/public";

/** Experiences (content items) and published tours as Trip Constructor catalogue rows, localized, prices in whole USD. */
export async function tripCatalog(
  db: Db,
  locale: Locale,
  rates: ExchangeRates,
  opts: { destination?: string } = {},
): Promise<{ experiences: CatalogExperience[]; tours: CatalogTour[] }> {
  const [exp, tourPage] = await Promise.all([
    listContent(db, "experience", { destination: opts.destination }),
    listPublishedTours(db, tourListQuerySchema.parse({ destination: opts.destination, pageSize: 48, currency: "USD" }), rates),
  ]);
  const experiences: CatalogExperience[] = exp.map((e) => ({
    slug: e.slug,
    title: localize(e.title, locale),
    summary: localize(e.excerpt, locale),
    image: e.image,
    destinationSlug: e.destinationSlug,
    priceUsd: e.priceFromUsd,
    durationHours: e.durationHours,
  }));
  const tours: CatalogTour[] = tourPage.items.map((t) => {
    let priceUsd: number | null = null;
    if (t.fromPrice) {
      try {
        priceUsd = Math.round(convertMinor(t.fromPrice.amountMinor, t.fromPrice.currency, "USD", rates) / 100);
      } catch {
        priceUsd = null;
      }
    }
    return {
      slug: t.slug,
      title: localize(t.title, locale),
      summary: localize(t.summary, locale),
      image: t.heroImage,
      destinationSlug: t.destination.slug,
      priceUsd,
      days: t.durationDays,
    };
  });
  return { experiences, tours };
}
