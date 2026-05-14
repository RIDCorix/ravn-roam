import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  productCategory,
  productOperationalState,
  productPublicationState,
  roamPoc,
  supplierPlanActivationPolicy,
} from "./_schema";
import { vendor } from "./vendor";

// Outward-facing "what we sell". Regulation doc §2.3 — pricing is embedded as
// jsonb for v0 and gets pulled into a `price_book` table when multi-currency
// retail goes live (open question #1 in the regulation doc).
export const product = roamPoc.table(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    // Phase 2: always points at the single platform vendor row seeded by
    // seed.sql. Phase 3 opens this up to tier-1 vendors.
    ownerVendorId: uuid("owner_vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "restrict" }),
    category: productCategory("category").notNull(),
    // i18n stays inlined as jsonb until we exceed ~3 locales (open
    // question #6).
    displayNameI18n: jsonb("display_name_i18n")
      .notNull()
      .default(sql`'{}'::jsonb`),
    descriptionI18n: jsonb("description_i18n")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Marketing destinations may be a strict subset of the primary plan's
    // destinations (§3 rule 1). Validation runs at publish time, not via a
    // DB check, because it depends on the joined supplier_plan row.
    marketingDestinations: text("marketing_destinations")
      .array()
      .notNull()
      .default(sql`'{}'`),
    dataAmountMb: integer("data_amount_mb").notNull(),
    validityDays: integer("validity_days").notNull(),
    activationPolicyDisplay: supplierPlanActivationPolicy(
      "activation_policy_display",
    ).notNull(),
    publicationState: productPublicationState("publication_state")
      .notNull()
      .default("draft"),
    operationalState: productOperationalState("operational_state")
      .notNull()
      .default("ok"),
    salesWindowStart: timestamp("sales_window_start", { withTimezone: true }),
    salesWindowEnd: timestamp("sales_window_end", { withTimezone: true }),
    salesRegionAllow: text("sales_region_allow")
      .array()
      .notNull()
      .default(sql`'{}'`),
    salesRegionDeny: text("sales_region_deny")
      .array()
      .notNull()
      .default(sql`'{}'`),
    purchaseCapPerUser: integer("purchase_cap_per_user"),
    purchaseCapTotal: integer("purchase_cap_total"),
    // Pricing shape: { currency, retail, msrp?, markup_mode, markup_value,
    // cost_snapshot, fx_policy }. See regulation doc §5.
    pricing: jsonb("pricing").notNull().default(sql`'{}'::jsonb`),
    media: jsonb("media").notNull().default(sql`'{}'::jsonb`),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("product_slug_unique").on(t.slug),
    // Storefront's primary filter — see regulation doc §4. A partial index
    // on the published rows would be marginally faster but harder to keep
    // honest as the storefront grows other filters.
    index("product_publication_state_idx").on(t.publicationState),
  ],
);
