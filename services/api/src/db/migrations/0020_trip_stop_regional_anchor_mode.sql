UPDATE "roam_poc"."trip_day_stop"
SET "anchor_mode" = 'regional'
WHERE "anchor_mode" = 'suggested_places';
