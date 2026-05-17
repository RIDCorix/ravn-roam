-- Per-stop preparation artifacts. These are intentionally JSONB so Lumi
-- can introduce ticket/reservation/booking/upload attachment flavors without
-- a migration for each new vendor or document type. Completion is normally
-- derived from the linked trip_checklist_item.done value.

ALTER TABLE "roam_poc"."trip_day_stop"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
