import { sql } from "drizzle-orm";
import { text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";

// Stub vendor table: the catalog regulation doc §3 sets `product.owner_vendor_id`
// = platform vendor in Phase 2, with multi-vendor RBAC deferred to Phase 3.
// We materialize a minimal one-column-shape row so the FK on product.owner_vendor_id
// is honest from day one; Phase 3 extends the table with RBAC fields.
export const vendor = roamPoc.table(
  "vendor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("vendor_code_unique").on(t.code)],
);
