import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { orderItemStatus, orderStatus, roamPoc } from "./_schema";
import { product } from "./product";
import { supplierPlan } from "./supplier-plan";
import { vendor } from "./vendor";

// Order header. Money figures are stored as `numeric` so downstream margin
// math is exact — never roll into JS floats. `vendor_id` is the *seller of
// record* (the tier-1 partner the customer transacted with), distinct from
// the upstream supplier whose plan ultimately gets fulfilled (lives on
// order_item).
export const orderRecord = roamPoc.table(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Public-facing identifier shown on receipts. Format set by the seller
    // (e.g., "RAVN-2026-0001"); unique within the platform.
    orderNumber: text("order_number").notNull().unique(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "restrict" }),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    status: orderStatus("status").notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull(),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 })
      .notNull(),
    currency: text("currency").notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("order_status_idx").on(t.status),
    index("order_vendor_idx").on(t.vendorId),
    index("order_created_at_idx").on(t.createdAt),
  ],
);

// Order line item. Each line resolves to one supplier_plan (and therefore
// one supplier route); ROA-58's sync job is the upstream source of truth
// for cost — we snapshot `unit_cost` at order time so a later sync that
// drops the cost doesn't retroactively change historical margins.
export const orderItem = roamPoc.table(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orderRecord.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, {
      onDelete: "set null",
    }),
    supplierPlanId: uuid("supplier_plan_id")
      .notNull()
      .references(() => supplierPlan.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    status: orderItemStatus("status")
      .notNull()
      .default("pending_fulfilment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (t) => [
    index("order_item_order_idx").on(t.orderId),
    index("order_item_supplier_plan_idx").on(t.supplierPlanId),
  ],
);
