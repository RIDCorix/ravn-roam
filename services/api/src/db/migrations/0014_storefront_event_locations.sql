ALTER TABLE "roam_poc"."storefront_event"
  ADD COLUMN IF NOT EXISTS "location_i18n" jsonb NOT NULL DEFAULT '{}'::jsonb;
