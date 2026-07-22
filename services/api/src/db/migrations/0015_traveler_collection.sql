CREATE TABLE IF NOT EXISTS "roam_poc"."traveler_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "xp_into_level" integer DEFAULT 0 NOT NULL,
  "xp_to_next" integer DEFAULT 1000 NOT NULL,
  "visited_country_count" integer DEFAULT 0 NOT NULL,
  "visited_city_count" integer DEFAULT 0 NOT NULL,
  "visited_place_count" integer DEFAULT 0 NOT NULL,
  "photo_count" integer DEFAULT 0 NOT NULL,
  "achievement_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."traveler_place" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "place_key" text NOT NULL,
  "name" text NOT NULL,
  "name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "country" text NOT NULL,
  "country_code" text,
  "city" text,
  "continent" text NOT NULL,
  "kind" text DEFAULT 'city' NOT NULL,
  "status" text DEFAULT 'visited' NOT NULL,
  "visited_at" date,
  "cover_image" text,
  "lat" double precision,
  "lng" double precision,
  "favorite" boolean DEFAULT false NOT NULL,
  "source_trip_id" uuid,
  "notes" text DEFAULT '' NOT NULL,
  "xp_awarded" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."traveler_photo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "photo_key" text NOT NULL,
  "place_id" uuid,
  "trip_id" uuid,
  "image_url" text NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "taken_at" date,
  "xp_awarded" integer DEFAULT 10 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."traveler_achievement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "achievement_key" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "badge_image" text,
  "unlocked_at" date NOT NULL,
  "xp_awarded" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."traveler_photo" ADD CONSTRAINT "traveler_photo_place_id_traveler_place_id_fk"
   FOREIGN KEY ("place_id") REFERENCES "roam_poc"."traveler_place"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "traveler_profile_user_uidx" ON "roam_poc"."traveler_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_profile_level_idx" ON "roam_poc"."traveler_profile" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "traveler_place_user_key_uidx" ON "roam_poc"."traveler_place" USING btree ("user_id","place_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_place_user_status_idx" ON "roam_poc"."traveler_place" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_place_user_visited_idx" ON "roam_poc"."traveler_place" USING btree ("user_id","visited_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "traveler_photo_user_key_uidx" ON "roam_poc"."traveler_photo" USING btree ("user_id","photo_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_photo_user_taken_idx" ON "roam_poc"."traveler_photo" USING btree ("user_id","taken_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_photo_place_idx" ON "roam_poc"."traveler_photo" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "traveler_achievement_user_key_uidx" ON "roam_poc"."traveler_achievement" USING btree ("user_id","achievement_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_achievement_user_unlocked_idx" ON "roam_poc"."traveler_achievement" USING btree ("user_id","unlocked_at");
