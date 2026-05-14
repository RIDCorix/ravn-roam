import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";
import { product } from "./product";
import { supplierPlan } from "./supplier-plan";

// Many-to-many between product and supplier_plan. Phase 4's ordering service
// reads this in (priority ASC, enabled=true, plan.available=true) order to
// pick the active fulfilment plan. Regulation doc §6 governs substitution
// rules — fallback plans must dominate the primary on duration / data /
// destinations; that check is enforced in admin UI, not the DB.
export const productSupplierMapping = roamPoc.table(
  "product_supplier_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    supplierPlanId: uuid("supplier_plan_id")
      .notNull()
      .references(() => supplierPlan.id, { onDelete: "restrict" }),
    // 0 = primary; 1, 2, ... = fallback. Ordered ASC.
    priority: integer("priority").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("product_supplier_mapping_unique").on(
      t.productId,
      t.supplierPlanId,
    ),
    // Phase 4 fallback walk reads (product_id, priority ASC).
    index("product_supplier_mapping_priority_idx").on(t.productId, t.priority),
  ],
);
