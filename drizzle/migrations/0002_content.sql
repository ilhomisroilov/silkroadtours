-- National Tours content: country on destinations, CMS items (travel guides, experiences, services)
-- and newsletter subscribers.
ALTER TABLE `destinations` ADD COLUMN `country` text;

CREATE TABLE `content_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `kind` text NOT NULL,
  `slug` text NOT NULL,
  `category` text,
  `title` text NOT NULL,
  `excerpt` text NOT NULL,
  `body` text NOT NULL,
  `image` text,
  `destination_slug` text,
  `icon` text,
  `request_type` text,
  `duration_hours` real,
  `price_from_usd` integer,
  `reading_minutes` integer,
  `is_published` integer DEFAULT true NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  -- Guides are articles, experiences are short bookable activities, services are what the agency arranges.
  CONSTRAINT "content_items_kind_ck" CHECK("content_items"."kind" IN ('guide', 'experience', 'service'))
);
CREATE UNIQUE INDEX `content_items_kind_slug_uq` ON `content_items` (`kind`,`slug`);
CREATE INDEX `content_items_published_idx` ON `content_items` (`kind`,`is_published`,`sort_order`);

CREATE TABLE `newsletter_subscribers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL,
  `locale` text DEFAULT 'en' NOT NULL,
  `source` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `newsletter_subscribers_email_uq` ON `newsletter_subscribers` (`email`);
