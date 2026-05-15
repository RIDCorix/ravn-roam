-- ROA-60: admin UI for Supplier & SupplierPlan
--
-- Two changes:
--   1. supplier_plan.admin_enabled — admin-controlled gate, orthogonal to
--      the sync-job-owned `available` flag. Storefront eligibility requires
--      BOTH (available AND admin_enabled). The numeric / inclusion columns
--      on supplier_plan stay sync-owned and untouched.
--   2. audit_log — single append-only stream for admin mutations. Keeps
--      who / when / what for supplier create/edit/pause, supplier_plan
--      toggle, and manual sync triggers. Schema is intentionally simple;
--      Phase 3+ will widen actor_id into a real FK once auth lands.

ALTER TABLE "roam_poc"."supplier_plan"
  ADD COLUMN IF NOT EXISTS "admin_enabled" boolean NOT NULL DEFAULT true;
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

CREATE INDEX IF NOT EXISTS "audit_log_target_idx"
  ON "roam_poc"."audit_log" USING btree ("target_type", "target_id", "occurred_at");
--> statement-breakpoint

-- Match the catalog RLS posture: anon / authenticated never see audit data.
-- service_role + roam_poc_user (BYPASSRLS) are the only readers/writers.
ALTER TABLE "roam_poc"."audit_log" ENABLE ROW LEVEL SECURITY;
