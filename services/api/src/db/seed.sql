-- Catalog seed (ROA-53).
--
-- Phase 2 leaves `product.owner_vendor_id` pointing at a single placeholder
-- "platform" vendor row. Tier-1 vendor self-service lands in Phase 3, which
-- extends the `vendor` table with RBAC fields and switches this row into
-- the special platform-owner case.
--
-- The constant UUID below is deliberate — code that needs to reference
-- "the platform vendor" before there is a real catalog of vendors can use
-- this literal instead of doing a runtime lookup.
--
-- Idempotent: rerunning the seed is a no-op.

INSERT INTO "roam_poc"."vendor" (id, code, display_name)
VALUES (
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'platform',
  'Roam Platform'
)
ON CONFLICT (id) DO NOTHING;

-- Supplier seed (ROA-100).
--
-- The supplier_plan_sync orchestrator looks up the supplier row by `code`
-- before pulling plans; if the row is missing it throws
-- `no supplier row for code "fastmove" — seed it before running sync`.
-- Bootstrapping a fresh env (staging / new Supabase project) therefore
-- needs this row to exist before either the CLI or the admin manual-sync
-- button can populate supplier_plan. Per ROA-86 D1 the first integration
-- is Fastmove / 世界移動; currency TWD matches its quoted prices.

INSERT INTO "roam_poc"."supplier" (code, display_name, status, integration_type, default_currency)
VALUES ('fastmove', '世界移動 Fastmove', 'active', 'api', 'TWD')
ON CONFLICT (code) DO NOTHING;
