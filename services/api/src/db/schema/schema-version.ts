import { pgSchema, serial, text, timestamp } from "drizzle-orm/pg-core";

// ROA-94: first migration that proves the Drizzle pipeline can reach the
// shared `roam_poc` schema as `roam_poc_backend`. The table doubles as a
// human-readable migration ledger — drizzle-kit writes its own `__drizzle_migrations`
// table, this one is for ops to eyeball without needing a query tool.
export const roamPoc = pgSchema("roam_poc");

export const schemaVersion = roamPoc.table("schema_version", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});
