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
