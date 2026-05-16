import { pgSchema } from "drizzle-orm/pg-core";

// Roam owns the `roam_poc` schema on the shared Supabase project — see
// agent-rules/06-shared-supabase.md. All catalog tables live here so the
// `roam_poc_user` role's search_path picks them up by default.
export const roamPoc = pgSchema("roam_poc");

// supplier.status
export const supplierStatus = roamPoc.enum("supplier_status", [
  "active",
  "paused",
  "terminated",
]);

// supplier.integration_type — CSV path retained for the PoC window (Phase 2
// regulation doc §2.1) where a supplier ships plans manually before the API
// adapter lands.
export const supplierIntegrationType = roamPoc.enum(
  "supplier_integration_type",
  ["api", "manual_csv"],
);

// supplier_plan.activation_policy — when the eSIM clock starts.
export const supplierPlanActivationPolicy = roamPoc.enum(
  "supplier_plan_activation_policy",
  ["on_install", "on_first_use", "fixed_date"],
);

// supplier_plan.delivery_model — set by ROA-50's research conclusion: the
// original `delivery_method` four-value enum was renamed and re-scoped to
// describe how the upstream supplier ships activation credentials, not what
// our storefront ends up rendering. The render-side fallback ladder is the
// concern of the future `esim_profile` table (Phase 4).
export const supplierPlanDeliveryModel = roamPoc.enum(
  "supplier_plan_delivery_model",
  ["lpa_direct", "redemption_required", "iccid_smdp_pair", "physical"],
);

// product.category
export const productCategory = roamPoc.enum("product_category", [
  "single_country",
  "regional",
  "global",
  "addon_topup",
]);

// product.publication_state — lifecycle from regulation doc §4.
export const productPublicationState = roamPoc.enum(
  "product_publication_state",
  ["draft", "in_review", "published", "archived"],
);

// product.operational_state — orthogonal sub-state that gates "can this be
// sold right now?" without moving the lifecycle. Storefront query is
// publication_state='published' AND operational_state='ok' AND now ∈ window.
export const productOperationalState = roamPoc.enum(
  "product_operational_state",
  ["ok", "sold_out", "suspended", "out_of_window"],
);

// vendor.tier — Phase 3 RBAC scaffolding (ROA-100 admin redesign).
//   platform — Roam itself, the placeholder owner for all Phase 2 products.
//   tier1    — direct partner (OTA, reseller, travel agency) we sign a
//              contract with and pay commission to.
//   tier2    — sub-agent under a tier1 (out of scope for the PoC but the
//              enum value is reserved so a downgrade isn't a schema change).
export const vendorTier = roamPoc.enum("vendor_tier", [
  "platform",
  "tier1",
  "tier2",
]);

// vendor.status — operational state for a tier-1 partner. Mirrors the
// supplier_status semantics so the admin badges and filters can share the
// same colour ramp without a value mapping.
export const vendorStatus = roamPoc.enum("vendor_status", [
  "active",
  "paused",
  "terminated",
]);

// vendor.grade — operational quality score the ops team assigns (A best,
// C worst). Drives downstream commission tier and feature flags later.
export const vendorGrade = roamPoc.enum("vendor_grade", ["A", "B", "C"]);

// order.status — top-level order lifecycle. Money state lives in the same
// enum as fulfilment state until we split them in Phase 4.
export const orderStatus = roamPoc.enum("order_status", [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
]);

// order_item.status — per-item delivery state. An order can be `paid` while
// some items are still `pending_fulfilment` (the upstream supplier hasn't
// produced an eSIM profile yet).
export const orderItemStatus = roamPoc.enum("order_item_status", [
  "pending_fulfilment",
  "fulfilled",
  "failed",
  "refunded",
]);

// trip.status — consumer-facing lifecycle. Computed from start/end dates
// in most read paths, but stored so the admin can pin a trip in a state
// (e.g., manually mark cancelled).
export const tripStatus = roamPoc.enum("trip_status", [
  "upcoming",
  "active",
  "past",
  "cancelled",
]);
