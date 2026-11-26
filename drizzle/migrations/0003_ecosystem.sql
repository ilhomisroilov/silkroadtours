-- Travel ecosystem: hotels, restaurants and transport (places), partner applications, and the CRM
-- (leads with an activity history). Existing bookings and service requests become leads.
CREATE TABLE `partners` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reference` text NOT NULL,
  `token` text NOT NULL,
  `type` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `source` text DEFAULT 'application' NOT NULL,
  `business_name` text NOT NULL,
  `contact_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `website` text,
  `destination_slug` text,
  `city` text,
  `description` text NOT NULL,
  `services` text DEFAULT '[]' NOT NULL,
  `locale` text DEFAULT 'en' NOT NULL,
  `admin_note` text,
  `reviewed_by` integer,
  `reviewed_at` integer,
  `ip_hash` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`reviewed_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `partners_reference_uq` ON `partners` (`reference`);
CREATE UNIQUE INDEX `partners_token_uq` ON `partners` (`token`);
CREATE INDEX `partners_status_idx` ON `partners` (`status`,`created_at`);

CREATE TABLE `places` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `kind` text NOT NULL,
  `slug` text NOT NULL,
  `destination_slug` text,
  `name` text NOT NULL,
  `summary` text NOT NULL,
  `description` text NOT NULL,
  `image` text,
  `gallery` text DEFAULT '[]' NOT NULL,
  `lat` real,
  `lng` real,
  `price_from_usd` integer,
  `price_level` integer,
  `tags` text DEFAULT '[]' NOT NULL,
  `details` text NOT NULL,
  `partner_id` integer,
  `source` text DEFAULT 'admin' NOT NULL,
  `is_published` integer DEFAULT true NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "places_kind_ck" CHECK("places"."kind" IN ('hotel', 'restaurant', 'transport'))
);
CREATE UNIQUE INDEX `places_kind_slug_uq` ON `places` (`kind`,`slug`);
CREATE INDEX `places_kind_dest_idx` ON `places` (`kind`,`is_published`,`destination_slug`);

CREATE TABLE `leads` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source` text NOT NULL,
  `source_ref` text,
  `stage` text DEFAULT 'new' NOT NULL,
  `full_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text,
  `locale` text DEFAULT 'en' NOT NULL,
  `title` text NOT NULL,
  `destination` text,
  `interests` text,
  `budget_usd` integer,
  `travel_from` text,
  `travel_to` text,
  `travellers` integer,
  `value_usd` integer,
  `assigned_to` integer,
  `follow_up_at` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`,`updated_at`);
CREATE UNIQUE INDEX `leads_source_ref_uq` ON `leads` (`source`,`source_ref`);

CREATE TABLE `lead_activities` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `lead_id` integer NOT NULL,
  `admin_id` integer,
  `kind` text NOT NULL,
  `text` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `lead_activities_lead_idx` ON `lead_activities` (`lead_id`,`created_at`);

-- Existing bookings and service requests become leads, in a stage that matches their status.
INSERT OR IGNORE INTO `leads` (`source`, `source_ref`, `stage`, `full_name`, `email`, `phone`, `locale`, `title`, `travel_from`, `travellers`, `value_usd`, `created_at`, `updated_at`)
SELECT 'booking', `reference`,
  CASE `status` WHEN 'confirmed' THEN 'confirmed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'lost' ELSE 'new' END,
  `full_name`, `email`, `phone`, `locale`, `tour_title_snapshot`, `preferred_date`, `adults` + `children`,
  CAST(`quote_total_usd_cents` / 100 AS INTEGER), `created_at`, `updated_at`
FROM `bookings`;

INSERT OR IGNORE INTO `leads` (`source`, `source_ref`, `stage`, `full_name`, `email`, `phone`, `locale`, `title`, `interests`, `created_at`, `updated_at`)
SELECT 'request', `reference`,
  CASE `status` WHEN 'confirmed' THEN 'confirmed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'lost' ELSE 'new' END,
  `full_name`, `email`, `phone`, `locale`, `type`, json_extract(`payload`, '$.message'), `created_at`, `updated_at`
FROM `service_requests`;

INSERT INTO `lead_activities` (`lead_id`, `kind`, `text`, `created_at`)
SELECT `id`, 'created', 'Imported from ' || `source_ref`, `created_at` FROM `leads`;
