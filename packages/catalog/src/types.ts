// Domain types for the catalog admin workflow. Mirrors the database column
// shape declared in services/api/src/db/schema, but lives here so the admin
// UI can import it without pulling drizzle / postgres into the Next.js bundle.
//
// Keep this file UI-agnostic and server-agnostic — only plain TS + enums.

export type ProductCategory =
  | "single_country"
  | "regional"
  | "global"
  | "addon_topup";

export type ProductPublicationState =
  | "draft"
  | "in_review"
  | "published"
  | "archived";

export type ProductOperationalState =
  | "ok"
  | "sold_out"
  | "suspended"
  | "out_of_window";

export type SupplierPlanActivationPolicy =
  | "on_install"
  | "on_first_use"
  | "fixed_date";

export type SupplierPlanDeliveryModel =
  | "lpa_direct"
  | "redemption_required"
  | "iccid_smdp_pair"
  | "physical";

export type MarkupMode =
  | "fixed_amount"
  | "percentage"
  | "target_margin"
  | "manual";

export type FxPolicy = "snapshot_at_publish" | "daily_refresh" | "manual";

export type I18nText = Record<string, string>;

export interface ProductPricing {
  currency: string;
  retail: number;
  msrp?: number;
  markup_mode: MarkupMode;
  markup_value: number;
  cost_snapshot?: {
    plan_id: string;
    cost: number;
    currency: string;
    fx_rate: number;
    snapshot_at: string;
  };
  fx_policy: FxPolicy;
}

export interface ProductMedia {
  thumbnail?: string;
  hero?: string;
}

export interface SupplierPlan {
  id: string;
  supplier_id: string;
  external_id: string;
  name: string;
  destinations: string[];
  data_amount_mb: number;
  validity_days: number;
  activation_policy: SupplierPlanActivationPolicy;
  delivery_model: SupplierPlanDeliveryModel;
  cost_amount: number;
  cost_currency: string;
  available: boolean;
  inventory_hint: number | null;
  last_synced_at: string | null;
}

export interface ProductSupplierMapping {
  id: string;
  product_id: string;
  supplier_plan_id: string;
  priority: number;
  enabled: boolean;
  notes: string | null;
}

export interface Product {
  id: string;
  slug: string;
  owner_vendor_id: string;
  category: ProductCategory;
  display_name_i18n: I18nText;
  description_i18n: I18nText;
  marketing_destinations: string[];
  data_amount_mb: number;
  validity_days: number;
  activation_policy_display: SupplierPlanActivationPolicy;
  publication_state: ProductPublicationState;
  operational_state: ProductOperationalState;
  sales_window_start: string | null;
  sales_window_end: string | null;
  sales_region_allow: string[];
  sales_region_deny: string[];
  purchase_cap_per_user: number | null;
  purchase_cap_total: number | null;
  pricing: ProductPricing;
  media: ProductMedia;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Hydrated mapping with the joined supplier_plan row. Admin UI consumes this
// shape; the raw mapping row stays internal to the API.
export interface ProductMappingWithPlan extends ProductSupplierMapping {
  plan: SupplierPlan;
}

export interface ProductWithMappings extends Product {
  mappings: ProductMappingWithPlan[];
}
