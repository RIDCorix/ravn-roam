ALTER TABLE "roam_poc"."trip_day"
  ADD COLUMN IF NOT EXISTS "cities" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint

UPDATE "roam_poc"."trip_day"
SET "cities" = jsonb_build_array("city")
WHERE jsonb_typeof("cities") <> 'array'
  AND trim("city") <> '';
--> statement-breakpoint

UPDATE "roam_poc"."trip_day"
SET "cities" = jsonb_build_array("city")
WHERE jsonb_typeof("cities") = 'array'
  AND jsonb_array_length("cities") = 0
  AND trim("city") <> '';
