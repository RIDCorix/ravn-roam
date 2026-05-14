CREATE TYPE "roam_poc"."supplier_plan_sync_status" AS ENUM('success', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "roam_poc"."supplier_plan_sync_trigger" AS ENUM('cron', 'admin', 'system');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."supplier_plan_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"trigger" "roam_poc"."supplier_plan_sync_trigger" NOT NULL,
	"triggered_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "roam_poc"."supplier_plan_sync_status" NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"plan_count" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."supplier_plan_sync_log" ADD CONSTRAINT "supplier_plan_sync_log_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "roam_poc"."supplier"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_plan_sync_log_supplier_started_idx" ON "roam_poc"."supplier_plan_sync_log" USING btree ("supplier_id","started_at");--> statement-breakpoint
-- Sync log is supplier-side data — anon / authenticated never see it.
-- Match the posture of the other catalog tables (see 0001_catalog_rls.sql):
-- service_role + roam_poc_user (BYPASSRLS) are the writers/readers; no policy
-- is created for anon/authenticated, so RLS denies them by default.
ALTER TABLE "roam_poc"."supplier_plan_sync_log" ENABLE ROW LEVEL SECURITY;