ALTER TABLE "roam_poc"."trip_day_stop"
  ADD COLUMN IF NOT EXISTS "place_name" text;
--> statement-breakpoint

ALTER TABLE "roam_poc"."trip_day_stop"
  ADD COLUMN IF NOT EXISTS "place_id" text;
--> statement-breakpoint

ALTER TABLE "roam_poc"."trip_day_stop"
  ADD COLUMN IF NOT EXISTS "place_address" text;
