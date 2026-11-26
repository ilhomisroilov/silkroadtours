-- Migration 0000_init — initial schema for Silk Road Tours (Cloudflare D1 / SQLite).
-- Mirrors src/db/schema.ts exactly (table, column, index and constraint names).
-- Applied with:  npx wrangler d1 migrations apply silkroad-tours-db --local|--remote
-- Conventions: money in integer minor units; timestamps in unix seconds; dates as 'YYYY-MM-DD';
-- translatable text as JSON {"en","uz","ru"}.

CREATE TABLE `destinations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `tagline` text NOT NULL,
  `overview` text NOT NULL,
  `attractions` text DEFAULT '[]' NOT NULL,
  `best_time` text NOT NULL,
  `best_months` text DEFAULT '[]' NOT NULL,
  `lat` real NOT NULL,
  `lng` real NOT NULL,
  `hero_image` text NOT NULL,
  `gallery` text DEFAULT '[]' NOT NULL,
  `seo_title` text,
  `seo_description` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_published` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `destinations_slug_uq` ON `destinations` (`slug`);
CREATE INDEX `destinations_published_idx` ON `destinations` (`is_published`,`sort_order`);

CREATE TABLE `tours` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `slug` text NOT NULL,
  `audience` text NOT NULL,
  `category` text NOT NULL,
  `primary_destination_id` integer NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `description` text NOT NULL,
  `duration_days` integer NOT NULL,
  `duration_nights` integer NOT NULL,
  `difficulty` text DEFAULT 'easy' NOT NULL,
  `min_group` integer DEFAULT 1 NOT NULL,
  `max_group` integer DEFAULT 16 NOT NULL,
  `base_currency` text NOT NULL,
  `child_price_percent` integer DEFAULT 70 NOT NULL,
  `from_price_minor` integer DEFAULT 0 NOT NULL,
  `compare_at_price_minor` integer,
  `badges` text DEFAULT '[]' NOT NULL,
  `included` text DEFAULT '[]' NOT NULL,
  `excluded` text DEFAULT '[]' NOT NULL,
  `accommodation` text DEFAULT '[]' NOT NULL,
  `transport` text DEFAULT '[]' NOT NULL,
  `route` text DEFAULT '[]' NOT NULL,
  `guide_languages` text DEFAULT '["en","ru","uz"]' NOT NULL,
  `season_months` text DEFAULT '[]' NOT NULL,
  `hero_image` text NOT NULL,
  `gallery` text DEFAULT '[]' NOT NULL,
  `rating_avg` real DEFAULT 0 NOT NULL,
  `rating_count` integer DEFAULT 0 NOT NULL,
  `seo_title` text,
  `seo_description` text,
  `is_featured` integer DEFAULT false NOT NULL,
  `is_published` integer DEFAULT false NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`primary_destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "tours_group_ck" CHECK("tours"."min_group" >= 1 AND "tours"."max_group" >= "tours"."min_group"),
  CONSTRAINT "tours_duration_ck" CHECK("tours"."duration_days" >= 1 AND "tours"."duration_nights" >= 0),
  CONSTRAINT "tours_child_pct_ck" CHECK("tours"."child_price_percent" BETWEEN 0 AND 100),
  CONSTRAINT "tours_audience_ck" CHECK("tours"."audience" IN ('inbound','domestic')),
  CONSTRAINT "tours_currency_ck" CHECK("tours"."base_currency" IN ('USD','UZS','EUR'))
);
CREATE UNIQUE INDEX `tours_slug_uq` ON `tours` (`slug`);
CREATE INDEX `tours_listing_idx` ON `tours` (`is_published`,`audience`,`category`);
CREATE INDEX `tours_destination_idx` ON `tours` (`primary_destination_id`);
CREATE INDEX `tours_featured_idx` ON `tours` (`is_featured`,`sort_order`);

CREATE TABLE `tour_destinations` (
  `tour_id` integer NOT NULL,
  `destination_id` integer NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY(`tour_id`, `destination_id`),
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `tour_destinations_dest_idx` ON `tour_destinations` (`destination_id`);

CREATE TABLE `tour_itinerary_days` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tour_id` integer NOT NULL,
  `day_number` integer NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `meals` text DEFAULT '[]' NOT NULL,
  `overnight` text,
  `distance_km` integer,
  `walking_hours` real,
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `itinerary_tour_day_uq` ON `tour_itinerary_days` (`tour_id`,`day_number`);

CREATE TABLE `tour_price_tiers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tour_id` integer NOT NULL,
  `booking_type` text NOT NULL,
  `min_pax` integer NOT NULL,
  `max_pax` integer NOT NULL,
  `price_usd` integer,
  `price_uzs` integer,
  `price_eur` integer,
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "price_tiers_pax_ck" CHECK("tour_price_tiers"."min_pax" >= 1 AND "tour_price_tiers"."max_pax" >= "tour_price_tiers"."min_pax"),
  CONSTRAINT "price_tiers_any_price_ck" CHECK("tour_price_tiers"."price_usd" IS NOT NULL OR "tour_price_tiers"."price_uzs" IS NOT NULL OR "tour_price_tiers"."price_eur" IS NOT NULL),
  CONSTRAINT "price_tiers_type_ck" CHECK("tour_price_tiers"."booking_type" IN ('group','private'))
);
CREATE INDEX `price_tiers_tour_idx` ON `tour_price_tiers` (`tour_id`,`booking_type`,`min_pax`);

CREATE TABLE `tour_departures` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tour_id` integer NOT NULL,
  `start_date` text NOT NULL,
  `end_date` text NOT NULL,
  `seats_total` integer NOT NULL,
  `seats_booked` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `price_modifier_percent` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "departures_seats_ck" CHECK("tour_departures"."seats_booked" >= 0 AND "tour_departures"."seats_booked" <= "tour_departures"."seats_total"),
  CONSTRAINT "departures_dates_ck" CHECK("tour_departures"."end_date" >= "tour_departures"."start_date")
);
CREATE UNIQUE INDEX `departures_tour_start_uq` ON `tour_departures` (`tour_id`,`start_date`);
CREATE INDEX `departures_start_idx` ON `tour_departures` (`start_date`,`status`);

CREATE TABLE `admin_users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'editor' NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `last_login_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `admin_users_email_uq` ON `admin_users` (`email`);

CREATE TABLE `bookings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reference` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `tour_id` integer,
  `departure_id` integer,
  `destination_id` integer,
  `tour_title_snapshot` text,
  `audience` text NOT NULL,
  `booking_type` text NOT NULL,
  `full_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `contact_channel` text NOT NULL,
  `messenger_handle` text,
  `country` text,
  `preferred_date` text NOT NULL,
  `adults` integer NOT NULL,
  `children` integer DEFAULT 0 NOT NULL,
  `special_requests` text,
  `locale` text NOT NULL,
  `quote_currency` text NOT NULL,
  `quote_total_minor` integer,
  `quote_total_usd_cents` integer,
  `telegram_notified_at` integer,
  `telegram_message_id` integer,
  `ip_hash` text,
  `user_agent` text,
  `utm_source` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`departure_id`) REFERENCES `tour_departures`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "bookings_pax_ck" CHECK("bookings"."adults" >= 1 AND "bookings"."children" >= 0),
  CONSTRAINT "bookings_status_ck" CHECK("bookings"."status" IN ('pending','confirmed','completed','cancelled'))
);
CREATE UNIQUE INDEX `bookings_reference_uq` ON `bookings` (`reference`);
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`,`created_at`);
CREATE INDEX `bookings_audience_idx` ON `bookings` (`audience`,`created_at`);
CREATE INDEX `bookings_tour_idx` ON `bookings` (`tour_id`);
CREATE INDEX `bookings_email_idx` ON `bookings` (`email`);
CREATE INDEX `bookings_ip_idx` ON `bookings` (`ip_hash`,`created_at`);

CREATE TABLE `booking_notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `booking_id` integer NOT NULL,
  `author_id` integer,
  `kind` text DEFAULT 'note' NOT NULL,
  `from_status` text,
  `to_status` text,
  `body` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`author_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `booking_notes_booking_idx` ON `booking_notes` (`booking_id`,`created_at`);

CREATE TABLE `reviews` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tour_id` integer,
  `destination_id` integer,
  `booking_id` integer,
  `author_name` text NOT NULL,
  `author_country` text,
  `rating` integer NOT NULL,
  `title` text,
  `body` text NOT NULL,
  `language` text DEFAULT 'en' NOT NULL,
  `source` text DEFAULT 'site' NOT NULL,
  `source_url` text,
  `travel_date` text,
  `is_verified` integer DEFAULT false NOT NULL,
  `is_published` integer DEFAULT false NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
  -- Ratings are whole stars from 1 to 5.
  CONSTRAINT "reviews_rating_ck" CHECK("reviews"."rating" BETWEEN 1 AND 5)
);
CREATE INDEX `reviews_tour_idx` ON `reviews` (`tour_id`,`is_published`);
CREATE INDEX `reviews_published_idx` ON `reviews` (`is_published`,`created_at`);
CREATE UNIQUE INDEX `reviews_booking_uq` ON `reviews` (`booking_id`);

CREATE TABLE `service_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reference` text NOT NULL,
  `type` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `full_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `contact_channel` text NOT NULL,
  `messenger_handle` text,
  `locale` text NOT NULL,
  `payload` text NOT NULL,
  `internal_notes` text,
  `telegram_notified_at` integer,
  `ip_hash` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `service_requests_reference_uq` ON `service_requests` (`reference`);
CREATE INDEX `service_requests_type_idx` ON `service_requests` (`type`,`status`,`created_at`);

CREATE TABLE `faq_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category` text NOT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_published` integer DEFAULT true NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `faq_category_idx` ON `faq_items` (`category`,`sort_order`);

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `admin_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `ip_hash` text,
  `user_agent` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `admin_sessions_user_idx` ON `admin_sessions` (`user_id`);
CREATE INDEX `admin_sessions_expiry_idx` ON `admin_sessions` (`expires_at`);

CREATE TABLE `login_attempts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `key` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `login_attempts_key_idx` ON `login_attempts` (`key`,`created_at`);
