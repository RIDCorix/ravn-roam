-- ROA-100: orders + vendors RBAC extension.
--
-- This migration is **idempotent**:
--   * `audit_log` and `supplier_plan.admin_enabled` were created in 0003
--     manually (drizzle-kit generate's snapshot didn't include them since
--     0003 was a hand-written migration). The auto-generated diff repeats
--     those statements; wrapping them in IF NOT EXISTS / DO blocks lets
--     drizzle-kit migrate skip them on the Railway DB while still working
--     on a fresh checkout.
--   * `CREATE TYPE` is not idempotent in Postgres, so each new enum is
--     guarded by a `pg_type` existence check.

DO $$ BEGIN
  CREATE TYPE "roam_poc"."order_item_status" AS ENUM('pending_fulfilment', 'fulfilled', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "roam_poc"."order_status" AS ENUM('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "roam_poc"."vendor_grade" AS ENUM('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "roam_poc"."vendor_status" AS ENUM('active', 'paused', 'terminated');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "roam_poc"."vendor_tier" AS ENUM('platform', 'tier1', 'tier2');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"supplier_plan_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "roam_poc"."order_item_status" DEFAULT 'pending_fulfilment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"status" "roam_poc"."order_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"cost_amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "tier" "roam_poc"."vendor_tier" DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "status" "roam_poc"."vendor_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "grade" "roam_poc"."vendor_grade";--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "contact_email" text;--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "commission_rate" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "contract_terms" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "roam_poc"."vendor" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "roam_poc"."supplier_plan" ADD COLUMN IF NOT EXISTS "admin_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "roam_poc"."order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "roam_poc"."product"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."order_item" ADD CONSTRAINT "order_item_supplier_plan_id_supplier_plan_id_fk" FOREIGN KEY ("supplier_plan_id") REFERENCES "roam_poc"."supplier_plan"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."order" ADD CONSTRAINT "order_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "roam_poc"."vendor"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_target_idx" ON "roam_poc"."audit_log" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_order_idx" ON "roam_poc"."order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_supplier_plan_idx" ON "roam_poc"."order_item" USING btree ("supplier_plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_idx" ON "roam_poc"."order" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_vendor_idx" ON "roam_poc"."order" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_created_at_idx" ON "roam_poc"."order" USING btree ("created_at");
