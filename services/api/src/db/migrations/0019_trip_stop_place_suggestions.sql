ALTER TABLE "roam_poc"."trip_day_stop"
  ADD COLUMN IF NOT EXISTS "anchor_mode" text DEFAULT 'exact_place' NOT NULL,
  ADD COLUMN IF NOT EXISTS "area_name" text,
  ADD COLUMN IF NOT EXISTS "search_query" text,
  ADD COLUMN IF NOT EXISTS "country_code" text,
  ADD COLUMN IF NOT EXISTS "place_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "suggestion_count" integer DEFAULT 5 NOT NULL,
  ADD COLUMN IF NOT EXISTS "place_suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "suggestions_status" text DEFAULT 'idle' NOT NULL;
