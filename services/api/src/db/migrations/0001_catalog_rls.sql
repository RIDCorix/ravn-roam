-- Phase 2 RLS posture for the catalog tables.
--
-- Intent (ROA-53):
--   * anon / authenticated may SELECT only `product` rows where
--     publication_state = 'published'. They see no supplier-side tables.
--   * service_role bypasses RLS (built-in Supabase attribute) and remains
--     the only writer in Phase 2 — multi-vendor RBAC arrives in Phase 3.
--   * The PoC's own backend role (`roam_poc_user`, see
--     agent-rules/06-shared-supabase.md) also gets BYPASSRLS, because the
--     Hono API on Node writes through that connection, not through
--     PostgREST. RLS would otherwise lock the backend out of its own data.
--
-- The role-existence guards keep this migration idempotent against a
-- local Postgres that has no Supabase-managed roles.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'roam_poc_user') THEN
    EXECUTE 'ALTER ROLE "roam_poc_user" BYPASSRLS';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "roam_poc"."vendor" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roam_poc"."supplier" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roam_poc"."supplier_plan" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roam_poc"."product" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roam_poc"."product_supplier_mapping" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Public read: storefront / marketing surfaces hit `product` through the
-- anon (and JWT-bearing authenticated) PostgREST roles. No other catalog
-- table is exposed. We create one policy per role so the migration stays
-- runnable on plain Postgres where only one of the two Supabase roles
-- exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE $POLICY$
      CREATE POLICY "product_public_read_anon"
        ON "roam_poc"."product"
        FOR SELECT
        TO "anon"
        USING (publication_state = 'published')
    $POLICY$;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE $POLICY$
      CREATE POLICY "product_public_read_authenticated"
        ON "roam_poc"."product"
        FOR SELECT
        TO "authenticated"
        USING (publication_state = 'published')
    $POLICY$;
  END IF;
END
$$;
