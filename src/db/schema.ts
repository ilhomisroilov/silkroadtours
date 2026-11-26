import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  ADMIN_ROLES,
  AUDIENCES,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  CONTACT_CHANNELS,
  CURRENCIES,
  DEPARTURE_STATUSES,
  DIFFICULTIES,
  FAQ_CATEGORIES,
  LOCALES,
  NOTE_KINDS,
  REVIEW_SOURCES,
  SERVICE_TYPES,
  TOUR_CATEGORIES,
  type AccommodationItem,
  type Attraction,
  type LocalizedText,
  type Meal,
  type MediaItem,
  type RoutePoint,
  type TourBadge,
  type TransportItem,
} from "./types";

// Conventions
// - Money is stored as integer MINOR units (USD/EUR cents, UZS whole so'm). See lib/pricing.ts.
// - Timestamps are unix seconds; calendar dates are ISO "YYYY-MM-DD" text.
// - Translatable content is a JSON column of shape { en, uz, ru }.

const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date());
const localized = (name: string) => text(name, { mode: "json" }).$type<LocalizedText>();

// ── Destinations ───────────────────────────────────────────────────────────

export const destinations = sqliteTable(
  "destinations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: localized("name").notNull(),
    tagline: localized("tagline").notNull(),
    overview: localized("overview").notNull(),
    attractions: text("attractions", { mode: "json" }).$type<Attraction[]>().notNull().default(sql`'[]'`),
    bestTime: localized("best_time").notNull(),
    /** 1–12, used for "best time to visit" chips and month search. */
    bestMonths: text("best_months", { mode: "json" }).$type<number[]>().notNull().default(sql`'[]'`),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    heroImage: text("hero_image").notNull(),
    gallery: text("gallery", { mode: "json" }).$type<MediaItem[]>().notNull().default(sql`'[]'`),
    seoTitle: localized("seo_title"),
    seoDescription: localized("seo_description"),
    /** NULL means Uzbekistan; set for outbound destinations such as Dubai or Istanbul. */
    country: localized("country"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("destinations_slug_uq").on(t.slug),
    index("destinations_published_idx").on(t.isPublished, t.sortOrder),
  ],
);

// ── Tours ──────────────────────────────────────────────────────────────────

export const tours = sqliteTable(
  "tours",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    audience: text("audience", { enum: AUDIENCES }).notNull(),
    category: text("category", { enum: TOUR_CATEGORIES }).notNull(),
    primaryDestinationId: integer("primary_destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "restrict" }),

    title: localized("title").notNull(),
    summary: localized("summary").notNull(),
    description: localized("description").notNull(),

    durationDays: integer("duration_days").notNull(),
    durationNights: integer("duration_nights").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).notNull().default("easy"),
    minGroup: integer("min_group").notNull().default(1),
    maxGroup: integer("max_group").notNull().default(16),

    /** Currency the agency prices this tour in; other currencies derive from it unless overridden per tier. */
    baseCurrency: text("base_currency", { enum: CURRENCIES }).notNull(),
    /** Child (2–11) price as % of the adult price. */
    childPricePercent: integer("child_price_percent").notNull().default(70),
    /** Shown on cards as "from" price — denormalised from the cheapest tier, in base currency minor units. */
    fromPriceMinor: integer("from_price_minor").notNull().default(0),
    /** Strike-through price for the "discount" badge, base currency minor units. */
    compareAtPriceMinor: integer("compare_at_price_minor"),

    badges: text("badges", { mode: "json" }).$type<TourBadge[]>().notNull().default(sql`'[]'`),
    included: text("included", { mode: "json" }).$type<LocalizedText[]>().notNull().default(sql`'[]'`),
    excluded: text("excluded", { mode: "json" }).$type<LocalizedText[]>().notNull().default(sql`'[]'`),
    accommodation: text("accommodation", { mode: "json" })
      .$type<AccommodationItem[]>()
      .notNull()
      .default(sql`'[]'`),
    transport: text("transport", { mode: "json" }).$type<TransportItem[]>().notNull().default(sql`'[]'`),
    route: text("route", { mode: "json" }).$type<RoutePoint[]>().notNull().default(sql`'[]'`),
    /** Tour languages offered by guides, ISO 639-1 codes. */
    guideLanguages: text("guide_languages", { mode: "json" }).$type<string[]>().notNull().default(sql`'["en","ru","uz"]'`),
    /** Months (1–12) this tour runs; empty = all year. */
    seasonMonths: text("season_months", { mode: "json" }).$type<number[]>().notNull().default(sql`'[]'`),

    heroImage: text("hero_image").notNull(),
    gallery: text("gallery", { mode: "json" }).$type<MediaItem[]>().notNull().default(sql`'[]'`),

    /** Denormalised from published reviews; recomputed on review moderation. */
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),

    seoTitle: localized("seo_title"),
    seoDescription: localized("seo_description"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tours_slug_uq").on(t.slug),
    index("tours_listing_idx").on(t.isPublished, t.audience, t.category),
    index("tours_destination_idx").on(t.primaryDestinationId),
    index("tours_featured_idx").on(t.isFeatured, t.sortOrder),
    check("tours_group_ck", sql`${t.minGroup} >= 1 AND ${t.maxGroup} >= ${t.minGroup}`),
    check("tours_duration_ck", sql`${t.durationDays} >= 1 AND ${t.durationNights} >= 0`),
    check("tours_child_pct_ck", sql`${t.childPricePercent} BETWEEN 0 AND 100`),
    check("tours_audience_ck", sql`${t.audience} IN ('inbound','domestic')`),
    check("tours_currency_ck", sql`${t.baseCurrency} IN ('USD','UZS','EUR')`),
  ],
);

/** Multi-region tours (e.g. Samarkand → Bukhara → Khiva) appear on every destination page they visit. */
export const tourDestinations = sqliteTable(
  "tour_destinations",
  {
    tourId: integer("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.tourId, t.destinationId] }),
    index("tour_destinations_dest_idx").on(t.destinationId),
  ],
);

export const tourItineraryDays = sqliteTable(
  "tour_itinerary_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tourId: integer("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    title: localized("title").notNull(),
    description: localized("description").notNull(),
    meals: text("meals", { mode: "json" }).$type<Meal[]>().notNull().default(sql`'[]'`),
    overnight: localized("overnight"),
    distanceKm: integer("distance_km"),
    walkingHours: real("walking_hours"),
  },
  (t) => [uniqueIndex("itinerary_tour_day_uq").on(t.tourId, t.dayNumber)],
);

/**
 * Per-person price by group size and booking type (Nuratau-style "solo / 2 pax / 3–5 pax" table).
 * The column matching tours.base_currency is required; the other two are optional manual
 * overrides — when null, the price is converted from the base column with current rates.
 */
export const tourPriceTiers = sqliteTable(
  "tour_price_tiers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tourId: integer("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    bookingType: text("booking_type", { enum: BOOKING_TYPES }).notNull(),
    minPax: integer("min_pax").notNull(),
    maxPax: integer("max_pax").notNull(),
    priceUsd: integer("price_usd"),
    priceUzs: integer("price_uzs"),
    priceEur: integer("price_eur"),
  },
  (t) => [
    index("price_tiers_tour_idx").on(t.tourId, t.bookingType, t.minPax),
    check("price_tiers_pax_ck", sql`${t.minPax} >= 1 AND ${t.maxPax} >= ${t.minPax}`),
    check(
      "price_tiers_any_price_ck",
      sql`${t.priceUsd} IS NOT NULL OR ${t.priceUzs} IS NOT NULL OR ${t.priceEur} IS NOT NULL`,
    ),
    check("price_tiers_type_ck", sql`${t.bookingType} IN ('group','private')`),
  ],
);

export const tourDepartures = sqliteTable(
  "tour_departures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tourId: integer("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    seatsTotal: integer("seats_total").notNull(),
    seatsBooked: integer("seats_booked").notNull().default(0),
    status: text("status", { enum: DEPARTURE_STATUSES }).notNull().default("open"),
    /** e.g. +15 for peak season, -10 for an early-bird departure. Applied to the tier price. */
    priceModifierPercent: integer("price_modifier_percent").notNull().default(0),
  },
  (t) => [
    uniqueIndex("departures_tour_start_uq").on(t.tourId, t.startDate),
    index("departures_start_idx").on(t.startDate, t.status),
    check("departures_seats_ck", sql`${t.seatsBooked} >= 0 AND ${t.seatsBooked} <= ${t.seatsTotal}`),
    check("departures_dates_ck", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

// ── Reviews ────────────────────────────────────────────────────────────────

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tourId: integer("tour_id").references(() => tours.id, { onDelete: "set null" }),
    destinationId: integer("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    /** Set when a guest reviews via their booking reference — one review per booking, marked verified. */
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    authorCountry: text("author_country"),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    /** Reviews are shown in the language they were written in. */
    language: text("language").notNull().default("en"),
    source: text("source", { enum: REVIEW_SOURCES }).notNull().default("site"),
    sourceUrl: text("source_url"),
    travelDate: text("travel_date"),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("reviews_tour_idx").on(t.tourId, t.isPublished),
    index("reviews_published_idx").on(t.isPublished, t.createdAt),
    uniqueIndex("reviews_booking_uq").on(t.bookingId),
    check("reviews_rating_ck", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

// ── Bookings ───────────────────────────────────────────────────────────────

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Public reference, e.g. UZ-2026-48392. */
    reference: text("reference").notNull(),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("pending"),

    tourId: integer("tour_id").references(() => tours.id, { onDelete: "set null" }),
    departureId: integer("departure_id").references(() => tourDepartures.id, { onDelete: "set null" }),
    destinationId: integer("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    /** Snapshot so the booking stays readable if the tour is edited or deleted. */
    tourTitleSnapshot: text("tour_title_snapshot"),
    audience: text("audience", { enum: AUDIENCES }).notNull(),
    bookingType: text("booking_type", { enum: BOOKING_TYPES }).notNull(),

    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    contactChannel: text("contact_channel", { enum: CONTACT_CHANNELS }).notNull(),
    messengerHandle: text("messenger_handle"),
    country: text("country"),

    preferredDate: text("preferred_date").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    specialRequests: text("special_requests"),

    locale: text("locale", { enum: LOCALES }).notNull(),
    /** Quote shown to the customer at submission time. */
    quoteCurrency: text("quote_currency", { enum: CURRENCIES }).notNull(),
    quoteTotalMinor: integer("quote_total_minor"),
    /** Same quote normalised to USD cents for analytics across currencies. */
    quoteTotalUsdCents: integer("quote_total_usd_cents"),

    telegramNotifiedAt: integer("telegram_notified_at", { mode: "timestamp" }),
    telegramMessageId: integer("telegram_message_id"),
    /** SHA-256 of client IP + SESSION_SECRET — for abuse throttling without storing raw IPs. */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    utmSource: text("utm_source"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_reference_uq").on(t.reference),
    index("bookings_status_idx").on(t.status, t.createdAt),
    index("bookings_audience_idx").on(t.audience, t.createdAt),
    index("bookings_tour_idx").on(t.tourId),
    index("bookings_email_idx").on(t.email),
    index("bookings_ip_idx").on(t.ipHash, t.createdAt),
    check("bookings_pax_ck", sql`${t.adults} >= 1 AND ${t.children} >= 0`),
    check("bookings_status_ck", sql`${t.status} IN ('pending','confirmed','completed','cancelled')`),
  ],
);

/** Internal notes and an audit trail of status changes. */
export const bookingNotes = sqliteTable(
  "booking_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => adminUsers.id, { onDelete: "set null" }),
    kind: text("kind", { enum: NOTE_KINDS }).notNull().default("note"),
    fromStatus: text("from_status", { enum: BOOKING_STATUSES }),
    toStatus: text("to_status", { enum: BOOKING_STATUSES }),
    body: text("body").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("booking_notes_booking_idx").on(t.bookingId, t.createdAt)],
);

// ── Special services (transfers, tailor-made, hotels/yurts, guides) ─────────

export const serviceRequests = sqliteTable(
  "service_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** e.g. SR-2026-20417 */
    reference: text("reference").notNull(),
    type: text("type", { enum: SERVICE_TYPES }).notNull(),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("pending"),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    contactChannel: text("contact_channel", { enum: CONTACT_CHANNELS }).notNull(),
    messengerHandle: text("messenger_handle"),
    locale: text("locale", { enum: LOCALES }).notNull(),
    /** Type-specific fields; validated by validators/service-request.ts before insert. */
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    internalNotes: text("internal_notes"),
    telegramNotifiedAt: integer("telegram_notified_at", { mode: "timestamp" }),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("service_requests_reference_uq").on(t.reference),
    index("service_requests_type_idx").on(t.type, t.status, t.createdAt),
  ],
);

// ── Travel guide FAQ ───────────────────────────────────────────────────────

export const faqItems = sqliteTable(
  "faq_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category", { enum: FAQ_CATEGORIES }).notNull(),
    question: localized("question").notNull(),
    answer: localized("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [index("faq_category_idx").on(t.category, t.sortOrder)],
);

// ── Settings (typed via SettingsMap in types.ts) ───────────────────────────

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

// ── Admin auth ─────────────────────────────────────────────────────────────

export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** "pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>" — Web Crypto, Workers-compatible. */
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ADMIN_ROLES }).notNull().default("editor"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("admin_users_email_uq").on(t.email)],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    /** SHA-256 of the random session token; the raw token only lives in the HttpOnly cookie. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId), index("admin_sessions_expiry_idx").on(t.expiresAt)],
);

/** Failed-login throttling (per email + ip hash, sliding window). */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

// ── Relations (for db.query.* relational API) ──────────────────────────────

export const destinationsRelations = relations(destinations, ({ many }) => ({
  primaryTours: many(tours),
  tourLinks: many(tourDestinations),
  reviews: many(reviews),
}));

export const toursRelations = relations(tours, ({ one, many }) => ({
  primaryDestination: one(destinations, {
    fields: [tours.primaryDestinationId],
    references: [destinations.id],
  }),
  destinationLinks: many(tourDestinations),
  itinerary: many(tourItineraryDays),
  priceTiers: many(tourPriceTiers),
  departures: many(tourDepartures),
  reviews: many(reviews),
  bookings: many(bookings),
}));

export const tourDestinationsRelations = relations(tourDestinations, ({ one }) => ({
  tour: one(tours, { fields: [tourDestinations.tourId], references: [tours.id] }),
  destination: one(destinations, { fields: [tourDestinations.destinationId], references: [destinations.id] }),
}));

export const tourItineraryDaysRelations = relations(tourItineraryDays, ({ one }) => ({
  tour: one(tours, { fields: [tourItineraryDays.tourId], references: [tours.id] }),
}));

export const tourPriceTiersRelations = relations(tourPriceTiers, ({ one }) => ({
  tour: one(tours, { fields: [tourPriceTiers.tourId], references: [tours.id] }),
}));

export const tourDeparturesRelations = relations(tourDepartures, ({ one, many }) => ({
  tour: one(tours, { fields: [tourDepartures.tourId], references: [tours.id] }),
  bookings: many(bookings),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  tour: one(tours, { fields: [reviews.tourId], references: [tours.id] }),
  destination: one(destinations, { fields: [reviews.destinationId], references: [destinations.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  tour: one(tours, { fields: [bookings.tourId], references: [tours.id] }),
  departure: one(tourDepartures, { fields: [bookings.departureId], references: [tourDepartures.id] }),
  destination: one(destinations, { fields: [bookings.destinationId], references: [destinations.id] }),
  notes: many(bookingNotes),
}));

export const bookingNotesRelations = relations(bookingNotes, ({ one }) => ({
  booking: one(bookings, { fields: [bookingNotes.bookingId], references: [bookings.id] }),
  author: one(adminUsers, { fields: [bookingNotes.authorId], references: [adminUsers.id] }),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, { fields: [adminSessions.userId], references: [adminUsers.id] }),
}));

// ── Inferred row types ─────────────────────────────────────────────────────

export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
export type Tour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;
export type ItineraryDay = typeof tourItineraryDays.$inferSelect;
export type PriceTier = typeof tourPriceTiers.$inferSelect;
export type Departure = typeof tourDepartures.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingNote = typeof bookingNotes.$inferSelect;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type FaqItem = typeof faqItems.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;

// ── AI assistant & planner (migration 0001_ai.sql) ────────────────────────

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    locale: text("locale").notNull().default("en"),
    source: text("source", { enum: ["assistant", "planner"] }).notNull().default("assistant"),
    page: text("page"),
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    ipHash: text("ip_hash"),
    messageCount: integer("message_count").notNull().default(0),
    bookingReference: text("booking_reference"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ai_conversations_created_idx").on(t.createdAt),
    index("ai_conversations_ip_idx").on(t.ipHash, t.createdAt),
    check("ai_conversations_source_ck", sql`${t.source} IN ('assistant','planner')`),
  ],
);

export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    sources: text("sources", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    provider: text("provider"),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latencyMs: integer("latency_ms"),
    status: text("status", { enum: ["ok", "error", "fallback", "unanswered"] }).notNull().default("ok"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_messages_conversation_idx").on(t.conversationId, t.id),
    index("ai_messages_created_idx").on(t.createdAt, t.status),
    check("ai_messages_role_ck", sql`${t.role} IN ('user','assistant')`),
    check("ai_messages_status_ck", sql`${t.status} IN ('ok','error','fallback','unanswered')`),
  ],
);

export const aiToolLogs = sqliteTable(
  "ai_tool_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    input: text("input").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull().default(true),
    resultCount: integer("result_count"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_tool_logs_created_idx").on(t.createdAt, t.tool)],
);

export const aiFeedback = sqliteTable(
  "ai_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => aiMessages.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("ai_feedback_rating_ck", sql`${t.rating} IN (-1, 1)`)],
);

export const savedTripPlans = sqliteTable("saved_trip_plans", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
  locale: text("locale").notNull(),
  request: text("request").notNull(),
  plan: text("plan", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: createdAt(),
});

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminId: integer("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_logs_created_idx").on(t.createdAt)],
);

// ── CMS content: travel guides, experiences, services ──────────────────────

export const CONTENT_KINDS = ["guide", "experience", "service"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: CONTENT_KINDS }).notNull(),
    slug: text("slug").notNull(),
    category: text("category"),
    title: localized("title").notNull(),
    excerpt: localized("excerpt").notNull(),
    /** Markdown per language. */
    body: localized("body").notNull(),
    image: text("image"),
    destinationSlug: text("destination_slug"),
    icon: text("icon"),
    requestType: text("request_type"),
    durationHours: real("duration_hours"),
    priceFromUsd: integer("price_from_usd"),
    readingMinutes: integer("reading_minutes"),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_items_kind_slug_uq").on(t.kind, t.slug),
    index("content_items_published_idx").on(t.kind, t.isPublished, t.sortOrder),
    check("content_items_kind_ck", sql`${t.kind} IN ('guide', 'experience', 'service')`),
  ],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    locale: text("locale").notNull().default("en"),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_subscribers_email_uq").on(t.email)],
);
