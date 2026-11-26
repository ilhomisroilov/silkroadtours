import type { HotelDetails, PlaceKind, RestaurantDetails, TransportDetails } from "@/db/types";

/** Empty kind-specific details for a new listing (shared by the server page and the client editor). */
export function defaultDetails(kind: PlaceKind): HotelDetails | RestaurantDetails | TransportDetails {
  const empty = () => ({ en: "", uz: "", ru: "" });
  if (kind === "hotel") return { area: empty(), amenities: [], roomTypes: [], checkIn: "14:00", checkOut: "12:00" } satisfies HotelDetails;
  if (kind === "restaurant") return { area: empty(), cuisine: [], dietary: [], hours: empty(), menu: [] } satisfies RestaurantDetails;
  return { mode: "train", from: "", to: "", durationMin: 60, operator: "", scheduleNote: empty(), classes: [] } satisfies TransportDetails;
}
