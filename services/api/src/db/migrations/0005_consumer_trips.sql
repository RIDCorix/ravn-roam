-- ROA-Lumi: consumer trips backing storage (trip, trip_day,
-- trip_checklist_item) + trip_status enum. Idempotent so a fresh checkout
-- and a partially-migrated DB both converge.

DO $$ BEGIN
  CREATE TYPE "roam_poc"."trip_status" AS ENUM('upcoming', 'active', 'past', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."trip" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "cover" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" "roam_poc"."trip_status" DEFAULT 'upcoming' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."trip_day" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "day_date" date NOT NULL,
  "city" text NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."trip_checklist_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "text" text NOT NULL,
  "kind" text NOT NULL,
  "done" boolean DEFAULT false NOT NULL,
  "suggested" boolean DEFAULT false NOT NULL,
  "suggested_by" text,
  "shortcut" text,
  "shop_filter" jsonb,
  "due_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."trip_day" ADD CONSTRAINT "trip_day_trip_id_trip_id_fk"
   FOREIGN KEY ("trip_id") REFERENCES "roam_poc"."trip"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."trip_checklist_item" ADD CONSTRAINT "trip_checklist_item_trip_id_trip_id_fk"
   FOREIGN KEY ("trip_id") REFERENCES "roam_poc"."trip"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "trip_user_idx" ON "roam_poc"."trip" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_status_idx" ON "roam_poc"."trip" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_user_start_idx" ON "roam_poc"."trip" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_day_trip_idx" ON "roam_poc"."trip_day" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_checklist_trip_idx" ON "roam_poc"."trip_checklist_item" USING btree ("trip_id");
