ALTER TABLE roam_poc.trip_checklist_item
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS group_label text,
  ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE roam_poc.trip_checklist_item c
SET
  phase = COALESCE(
    c.phase,
    CASE
      WHEN c.kind IN ('stay', 'ticket', 'visa', 'insurance') THEN 'early'
      WHEN c.kind = 'gear' THEN 'days_before'
      WHEN c.kind = 'transit' THEN 'travel_day'
      WHEN c.kind IN ('flight', 'esim', 'doc') THEN 'week_before'
      ELSE 'week_before'
    END
  ),
  group_label = COALESCE(
    c.group_label,
    CASE
      WHEN c.kind IN ('stay', 'ticket', 'visa') THEN '訂票與預訂'
      WHEN c.kind IN ('flight', 'doc', 'insurance') THEN '文件與確認'
      WHEN c.kind = 'esim' THEN '通訊與網路'
      WHEN c.kind = 'gear' THEN '行李整理'
      WHEN c.kind = 'transit' THEN '出發當天'
      ELSE '旅行準備'
    END
  ),
  start_date = COALESCE(
    c.start_date,
    CASE
      WHEN c.due_date IS NOT NULL THEN c.due_date
      WHEN c.kind IN ('stay', 'ticket', 'visa', 'insurance') THEN t.start_date - INTERVAL '30 days'
      WHEN c.kind = 'gear' THEN t.start_date - INTERVAL '3 days'
      WHEN c.kind = 'transit' THEN t.start_date
      ELSE t.start_date - INTERVAL '7 days'
    END::date
  )
FROM roam_poc.trip t
WHERE c.trip_id = t.id
  AND (c.phase IS NULL OR c.group_label IS NULL OR c.start_date IS NULL);
