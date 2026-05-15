import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  roamPoc,
  supplierPlanActivationPolicy,
  supplierPlanDeliveryModel,
} from "./_schema";
import { supplier } from "./supplier";

// supplier_plan rows are owned by the sync job — admins do NOT mutate
// cost / inclusion fields. The Phase 4 ordering service joins through
// product_supplier_mapping to pick which plan to fulfill against.
export const supplierPlan = roamPoc.table(
  "supplier_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    // Upstream SKU. (supplier_id, external_id) is the natural key.
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    // ISO 3166-1 alpha-2 country codes. Regional / global plans hold many.
    destinations: text("destinations").array().notNull().default(sql`'{}'`),
    networkOperators: jsonb("network_operators")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // -1 means unlimited per the regulation doc §2.2.
    dataAmountMb: integer("data_amount_mb").notNull(),
    validityDays: integer("validity_days").notNull(),
    activationPolicy: supplierPlanActivationPolicy("activation_policy")
      .notNull(),
    deliveryModel: supplierPlanDeliveryModel("delivery_model").notNull(),
    costAmount: numeric("cost_amount", { precision: 12, scale: 4 }).notNull(),
    costCurrency: text("cost_currency").notNull(),
    available: boolean("available").notNull().default(true),
    // Admin-controlled gate. `available` is owned by the sync job and tracks
    // upstream supplier state; `admin_enabled` is the operator's local kill
    // switch. Storefront eligibility = available AND admin_enabled.
    adminEnabled: boolean("admin_enabled").notNull().default(true),
    inventoryHint: integer("inventory_hint"),
    // Original supplier response — kept as a parseable archive so renaming
    // upstream fields does not lose history.
    rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("supplier_plan_supplier_external_unique").on(
      t.supplierId,
      t.externalId,
    ),
    // Hot path for Phase 4 fallback selection: "give me all available plans
    // owned by supplier X".
    index("supplier_plan_supplier_available_idx").on(
      t.supplierId,
      t.available,
    ),
  ],
);
