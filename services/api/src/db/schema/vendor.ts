import { sql } from "drizzle-orm";
import {
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc, vendorGrade, vendorStatus, vendorTier } from "./_schema";

// Vendor table — extended in ROA-100 admin redesign with the tier-1 RBAC +
// commercial fields originally scoped for Phase 3. Phase 2 still only
// references this table via `product.owner_vendor_id`; everything past
// `display_name` is admin-only metadata for now.
//
// The `tier='platform'` row seeded in ROA-53 keeps its placeholder semantics
// — Phase 3 will widen this with auth identifiers (roles, member list).
export const vendor = roamPoc.table(
  "vendor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
    tier: vendorTier("tier").notNull().default("platform"),
    status: vendorStatus("status").notNull().default("active"),
    grade: vendorGrade("grade"),
    contactEmail: text("contact_email"),
    // 0.0 — 1.0 (e.g. 0.12 = 12%). Numeric so we don't lose precision on
    // tier-2 rounding. NULL for the platform owner row.
    commissionRate: numeric("commission_rate", {
      precision: 5,
      scale: 4,
    }),
    contractTerms: jsonb("contract_terms").notNull().default(sql`'{}'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("vendor_code_unique").on(t.code)],
);
