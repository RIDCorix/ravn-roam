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
