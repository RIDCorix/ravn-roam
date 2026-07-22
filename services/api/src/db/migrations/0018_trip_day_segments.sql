ALTER TABLE "roam_poc"."trip_day"
  ADD COLUMN IF NOT EXISTS "segments" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint

UPDATE "roam_poc"."trip_day"
SET "segments" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'city',
      value,
      'start_part',
      CASE
        WHEN city_count = 1 THEN 'full_day'
        WHEN ordinal = 1 THEN 'morning'
        WHEN ordinal = 2 THEN 'afternoon'
        ELSE 'evening'
      END,
      'end_part',
      CASE
        WHEN city_count = 1 THEN 'full_day'
        WHEN ordinal = 1 THEN 'morning'
        WHEN ordinal = 2 THEN 'afternoon'
        ELSE 'evening'
      END,
      'note',
      ''
    )
    ORDER BY ordinal
  )
  FROM (
    SELECT
      value,
      ordinal,
      count(*) OVER () AS city_count
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("cities") = 'array' AND jsonb_array_length("cities") > 0
          THEN "cities"
        WHEN trim("city") <> ''
          THEN jsonb_build_array("city")
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS city_names(value, ordinal)
    WHERE trim(value) <> ''
  ) AS city_parts
)
WHERE jsonb_typeof("segments") <> 'array'
  OR jsonb_array_length("segments") = 0;
