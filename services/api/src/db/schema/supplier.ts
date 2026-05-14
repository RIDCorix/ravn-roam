import { sql } from "drizzle-orm";
import { jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  roamPoc,
  supplierIntegrationType,
  supplierStatus,
} from "./_schema";

export const supplier = roamPoc.table(
  "supplier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Internal short code used to route SupplierAdapter implementations in
    // Phase 2 §9.1 (e.g. `fastmove`, `airalo`). Unique.
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
    status: supplierStatus("status").notNull().default("active"),
    integrationType: supplierIntegrationType("integration_type")
      .notNull()
      .default("api"),
    // ISO 4217 — the upstream's quoted currency, not our retail currency.
    defaultCurrency: text("default_currency").notNull(),
    // Free-form contact + SLA notes. Field-level structure deferred until
    // we have more than one supplier to compare.
    contact: jsonb("contact").notNull().default(sql`'{}'::jsonb`),
    // Pointer (e.g. hub secret path) — never the credential itself. See
    // agent-rules/10-secrets-via-linear.md.
    credentialsRef: text("credentials_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("supplier_code_unique").on(t.code)],
);
