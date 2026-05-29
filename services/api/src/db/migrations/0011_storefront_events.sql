-- Storefront promotional / seasonal events. Surfaced in the /shop
-- "Trending now" carousel. Crawler (services/api/src/cli/crawl-shop-events.ts)
-- upserts here on a daily cron; ops also hand-author rows for flash promos.

DO $$ BEGIN
  CREATE TYPE "roam_poc"."storefront_event_type" AS ENUM (
    'festival',
    'carnival',
    'religious',
    'music',
    'sports',
    'food',
    'seasonal',
    'cultural',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."storefront_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "title_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "subtitle_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "event_type" "roam_poc"."storefront_event_type" NOT NULL DEFAULT 'other',
  "region_slug" text NOT NULL,
  "suggested_days" integer,
  "suggested_gb" numeric(5, 1),
  "start_date" date,
  "end_date" date,
  "recurring_month_start" smallint,
  "recurring_month_end" smallint,
  "cover_image" text,
  "tint" text,
  "badge_override" text,
  "source" text NOT NULL DEFAULT 'manual',
  "source_url" text,
  "last_seen_at" timestamp with time zone,
  "raw_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 100,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "storefront_event_slug_unique"
  ON "roam_poc"."storefront_event" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storefront_event_active_type_idx"
  ON "roam_poc"."storefront_event" USING btree ("active", "event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storefront_event_region_idx"
  ON "roam_poc"."storefront_event" USING btree ("region_slug");
