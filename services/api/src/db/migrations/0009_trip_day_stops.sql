-- Multi-stop per day (Wanderlog-style). Each trip_day now owns 0..N
-- ordered stops with their own geocoded coords, kind, time + note. The
-- legacy `trip_day.city` stays for backwards compatibility (and as a
-- macro-level label); existing rows are backfilled with one stop using
-- that city as the name so old trips still render.

CREATE TABLE IF NOT EXISTS "roam_poc"."trip_day_stop" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "day_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "name" text NOT NULL,
  "kind" text DEFAULT 'other' NOT NULL,
  "arrival_time" text,
  "duration_min" integer,
  "note" text DEFAULT '' NOT NULL,
  "lat" double precision,
  "lng" double precision,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."trip_day_stop" ADD CONSTRAINT "trip_day_stop_day_id_trip_day_id_fk"
   FOREIGN KEY ("day_id") REFERENCES "roam_poc"."trip_day"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "trip_day_stop_day_idx"
  ON "roam_poc"."trip_day_stop" USING btree ("day_id","sort_order");
--> statement-breakpoint

-- Backfill: every existing trip_day gets one stop named after its city, so
-- the new stop-aware API never sees an empty stops[] for legacy days.
-- Skip if the day already has at least one stop (idempotent re-run).
INSERT INTO "roam_poc"."trip_day_stop" ("day_id", "sort_order", "name", "kind", "note")
SELECT d."id", 0, d."city", 'other', ''
FROM "roam_poc"."trip_day" d
LEFT JOIN "roam_poc"."trip_day_stop" s ON s."day_id" = d."id"
WHERE s."id" IS NULL
  AND d."city" IS NOT NULL
  AND length(trim(d."city")) > 0;
