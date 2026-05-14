-- Schema is normally pre-provisioned by the human op against the shared
-- Supabase project (docs/INFRA.md §2). IF NOT EXISTS keeps this migration
-- runnable on a fresh local Postgres too, which matches ROA-53's "乾淨
-- schema 上順跑" acceptance criterion.
CREATE SCHEMA IF NOT EXISTS "roam_poc";
--> statement-breakpoint
CREATE TYPE "roam_poc"."product_category" AS ENUM('single_country', 'regional', 'global', 'addon_topup');--> statement-breakpoint
CREATE TYPE "roam_poc"."product_operational_state" AS ENUM('ok', 'sold_out', 'suspended', 'out_of_window');--> statement-breakpoint
CREATE TYPE "roam_poc"."product_publication_state" AS ENUM('draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "roam_poc"."supplier_integration_type" AS ENUM('api', 'manual_csv');--> statement-breakpoint
CREATE TYPE "roam_poc"."supplier_plan_activation_policy" AS ENUM('on_install', 'on_first_use', 'fixed_date');--> statement-breakpoint
CREATE TYPE "roam_poc"."supplier_plan_delivery_model" AS ENUM('lpa_direct', 'redemption_required', 'iccid_smdp_pair', 'physical');--> statement-breakpoint
CREATE TYPE "roam_poc"."supplier_status" AS ENUM('active', 'paused', 'terminated');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "roam_poc"."supplier_status" DEFAULT 'active' NOT NULL,
	"integration_type" "roam_poc"."supplier_integration_type" DEFAULT 'api' NOT NULL,
	"default_currency" text NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credentials_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."supplier_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"destinations" text[] DEFAULT '{}' NOT NULL,
	"network_operators" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_amount_mb" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"activation_policy" "roam_poc"."supplier_plan_activation_policy" NOT NULL,
	"delivery_model" "roam_poc"."supplier_plan_delivery_model" NOT NULL,
	"cost_amount" numeric(12, 4) NOT NULL,
	"cost_currency" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"inventory_hint" integer,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_vendor_id" uuid NOT NULL,
	"category" "roam_poc"."product_category" NOT NULL,
	"display_name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"marketing_destinations" text[] DEFAULT '{}' NOT NULL,
	"data_amount_mb" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"activation_policy_display" "roam_poc"."supplier_plan_activation_policy" NOT NULL,
	"publication_state" "roam_poc"."product_publication_state" DEFAULT 'draft' NOT NULL,
	"operational_state" "roam_poc"."product_operational_state" DEFAULT 'ok' NOT NULL,
	"sales_window_start" timestamp with time zone,
	"sales_window_end" timestamp with time zone,
	"sales_region_allow" text[] DEFAULT '{}' NOT NULL,
	"sales_region_deny" text[] DEFAULT '{}' NOT NULL,
	"purchase_cap_per_user" integer,
	"purchase_cap_total" integer,
	"pricing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."product_supplier_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_plan_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."supplier_plan" ADD CONSTRAINT "supplier_plan_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "roam_poc"."supplier"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."product" ADD CONSTRAINT "product_owner_vendor_id_vendor_id_fk" FOREIGN KEY ("owner_vendor_id") REFERENCES "roam_poc"."vendor"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."product_supplier_mapping" ADD CONSTRAINT "product_supplier_mapping_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "roam_poc"."product"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roam_poc"."product_supplier_mapping" ADD CONSTRAINT "product_supplier_mapping_supplier_plan_id_supplier_plan_id_fk" FOREIGN KEY ("supplier_plan_id") REFERENCES "roam_poc"."supplier_plan"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_code_unique" ON "roam_poc"."vendor" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_code_unique" ON "roam_poc"."supplier" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_plan_supplier_external_unique" ON "roam_poc"."supplier_plan" USING btree ("supplier_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_plan_supplier_available_idx" ON "roam_poc"."supplier_plan" USING btree ("supplier_id","available");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_slug_unique" ON "roam_poc"."product" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_publication_state_idx" ON "roam_poc"."product" USING btree ("publication_state");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_supplier_mapping_unique" ON "roam_poc"."product_supplier_mapping" USING btree ("product_id","supplier_plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_supplier_mapping_priority_idx" ON "roam_poc"."product_supplier_mapping" USING btree ("product_id","priority");