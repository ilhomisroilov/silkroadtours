import "server-only";
import type { EditorDay, EditorDeparture, EditorTier, EditorTour } from "@/components/admin/tour-editor";
import type { getTourAdmin } from "@/db/queries/tours";

type AdminTour = NonNullable<Awaited<ReturnType<typeof getTourAdmin>>>;

/** Converts a tour from the database into the editor's plain state (no Dates, no internal columns). */
export function toEditorData(tour: AdminTour): { tour: EditorTour; days: EditorDay[]; tiers: EditorTier[]; departures: EditorDeparture[] } {
  return {
    tour: {
      id: tour.id,
      slug: tour.slug,
      audience: tour.audience,
      category: tour.category,
      primaryDestinationId: tour.primaryDestinationId,
      destinationIds: tour.destinationLinks.map((l) => l.destinationId).filter((d) => d !== tour.primaryDestinationId),
      title: tour.title,
      summary: tour.summary,
      description: tour.description,
      durationDays: tour.durationDays,
      durationNights: tour.durationNights,
      difficulty: tour.difficulty,
      minGroup: tour.minGroup,
      maxGroup: tour.maxGroup,
      baseCurrency: tour.baseCurrency,
      childPricePercent: tour.childPricePercent,
      compareAtPriceMinor: tour.compareAtPriceMinor,
      badges: tour.badges,
      included: tour.included,
      excluded: tour.excluded,
      accommodation: tour.accommodation,
      transport: tour.transport,
      route: tour.route,
      guideLanguages: tour.guideLanguages,
      seasonMonths: tour.seasonMonths,
      heroImage: tour.heroImage,
      gallery: tour.gallery,
      seoTitle: tour.seoTitle,
      seoDescription: tour.seoDescription,
      isFeatured: tour.isFeatured,
      isPublished: tour.isPublished,
      sortOrder: tour.sortOrder,
    },
    days: tour.itinerary.map((d) => ({ dayNumber: d.dayNumber, title: d.title, description: d.description, meals: d.meals, overnight: d.overnight, distanceKm: d.distanceKm, walkingHours: d.walkingHours })),
    tiers: tour.priceTiers.map((p) => ({ bookingType: p.bookingType, minPax: p.minPax, maxPax: p.maxPax, priceUsd: p.priceUsd, priceUzs: p.priceUzs, priceEur: p.priceEur })),
    departures: tour.departures.map((d) => ({ id: d.id, startDate: d.startDate, endDate: d.endDate, seatsTotal: d.seatsTotal, seatsBooked: d.seatsBooked, status: d.status, priceModifierPercent: d.priceModifierPercent })),
  };
}
