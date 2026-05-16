-- City geocoder cache for the Roam map renderer. Idempotent so a fresh
-- checkout and a partially-migrated DB both converge.

CREATE TABLE IF NOT EXISTS "roam_poc"."city_geocode" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name_normalized" text NOT NULL,
  "display_name" text,
  "lat" numeric(9, 6) NOT NULL,
  "lng" numeric(9, 6) NOT NULL,
  "country_code" text,
  "source" text DEFAULT 'nominatim' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "city_geocode_name_unique" ON "roam_poc"."city_geocode" USING btree ("name_normalized");
