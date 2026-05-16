-- Trip companions + checklist assignee.

CREATE TABLE IF NOT EXISTS "roam_poc"."trip_companion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "color" text DEFAULT '#0FB8B4' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "user_id" text,
  "invite_token" uuid DEFAULT gen_random_uuid(),
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."trip_companion" ADD CONSTRAINT "trip_companion_trip_id_trip_id_fk"
   FOREIGN KEY ("trip_id") REFERENCES "roam_poc"."trip"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "trip_companion_trip_idx" ON "roam_poc"."trip_companion" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trip_companion_invite_token_unique" ON "roam_poc"."trip_companion" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_companion_user_idx" ON "roam_poc"."trip_companion" USING btree ("user_id");--> statement-breakpoint

ALTER TABLE "roam_poc"."trip_checklist_item" ADD COLUMN IF NOT EXISTS "assigned_companion_id" uuid;
