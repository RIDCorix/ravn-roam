import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";
import { supplier } from "./supplier";

// supplier_plan_sync.trigger — who/what kicked the run. `cron` = scheduled
// pull, `admin` = admin UI button, `system` = catch-all for internal callers
// (e.g. a recovery script). Keep small; new sources should add a row in
// admin UI before claiming a new value.
export const supplierPlanSyncTrigger = roamPoc.enum(
  "supplier_plan_sync_trigger",
  ["cron", "admin", "system"],
);

// supplier_plan_sync.status — `partial` is reserved for the "we wrote some
// plans but the upstream feed cut off mid-stream" case. The orchestrator
// records `failed` when nothing was persisted and re-raises.
export const supplierPlanSyncStatus = roamPoc.enum(
  "supplier_plan_sync_status",
  ["success", "partial", "failed"],
);

export const supplierPlanSyncLog = roamPoc.table(
  "supplier_plan_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    trigger: supplierPlanSyncTrigger("trigger").notNull(),
    // Free-form label (e.g. admin username). Surfaced verbatim in the admin
    // UI list view — keep this human-readable, not an opaque token.
    triggeredBy: text("triggered_by"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: supplierPlanSyncStatus("status").notNull(),
    // Counters at the end of the run. Shape:
    //   { plansFetched, inserted, updated, unchanged, markedUnavailable,
    //     restoredAvailable, durationMs }
    summary: jsonb("summary").notNull().default(sql`'{}'::jsonb`),
    // Short error string when status='failed' or 'partial'. Full stack /
    // adapter payload stays out of the row — admin UI shows this verbatim
    // and we don't want to render multi-KB blobs in the table.
    errorMessage: text("error_message"),
    // Convenience pointer when a single non-numeric metric matters more than
    // the JSON summary (e.g. the adapter returned 0 plans).
    planCount: integer("plan_count"),
  },
  (t) => [
    // Admin UI hits "latest 50 for this supplier" repeatedly; this is the
    // primary access path.
    index("supplier_plan_sync_log_supplier_started_idx").on(
      t.supplierId,
      t.startedAt,
    ),
  ],
);
