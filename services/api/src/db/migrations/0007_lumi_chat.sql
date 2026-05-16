-- Persistent Lumi chat history.

CREATE TABLE IF NOT EXISTS "roam_poc"."lumi_conversation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "trip_id" uuid,
  "title" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roam_poc"."lumi_message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."lumi_conversation" ADD CONSTRAINT "lumi_conversation_trip_id_trip_id_fk"
   FOREIGN KEY ("trip_id") REFERENCES "roam_poc"."trip"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "roam_poc"."lumi_message" ADD CONSTRAINT "lumi_message_conversation_id_lumi_conversation_id_fk"
   FOREIGN KEY ("conversation_id") REFERENCES "roam_poc"."lumi_conversation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "lumi_conversation_user_idx" ON "roam_poc"."lumi_conversation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lumi_conversation_trip_idx" ON "roam_poc"."lumi_conversation" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lumi_message_conversation_idx" ON "roam_poc"."lumi_message" USING btree ("conversation_id","created_at");
