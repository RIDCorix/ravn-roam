import { sql } from "drizzle-orm";
import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";

// Append-only stream of admin mutations. Captures who/when/what for the
// ROA-60 acceptance criterion. `actor` is the verbatim `x-admin-user`
// header until a real auth layer lands in Phase 3.
export const auditLog = roamPoc.table(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetType, t.targetId, t.occurredAt),
  ],
);
