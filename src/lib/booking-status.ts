import type { BookingStatus } from "../db/types";

/** Allowed status changes. Completed bookings can only be re-opened as confirmed (corrections). */
export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "pending"],
  completed: ["confirmed"],
  cancelled: ["pending", "confirmed"],
};

/** Confirmed and completed bookings hold seats on their departure. */
export const holdsSeats = (s: BookingStatus) => s === "confirmed" || s === "completed";
