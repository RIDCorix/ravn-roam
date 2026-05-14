// Mapping helpers: convert Drizzle row shapes to the wire-format types the
// admin UI consumes. Keeping these in one place stops drift between routes
// (e.g. one handler returning camelCase, another returning snake_case).

import type {
  Product,
  ProductMappingWithPlan,
  ProductSupplierMapping,
  ProductWithMappings,
  SupplierPlan,
} from "@roam/catalog";

import type {
  product,
  productSupplierMapping,
  supplierPlan,
} from "../db/schema/index.js";

type ProductRow = typeof product.$inferSelect;
type MappingRow = typeof productSupplierMapping.$inferSelect;
type PlanRow = typeof supplierPlan.$inferSelect;

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    owner_vendor_id: row.ownerVendorId,
    category: row.category,
    display_name_i18n: row.displayNameI18n as Record<string, string>,
    description_i18n: row.descriptionI18n as Record<string, string>,
    marketing_destinations: row.marketingDestinations,
    data_amount_mb: row.dataAmountMb,
    validity_days: row.validityDays,
    activation_policy_display: row.activationPolicyDisplay,
    publication_state: row.publicationState,
    operational_state: row.operationalState,
    sales_window_start: row.salesWindowStart?.toISOString() ?? null,
    sales_window_end: row.salesWindowEnd?.toISOString() ?? null,
    sales_region_allow: row.salesRegionAllow,
    sales_region_deny: row.salesRegionDeny,
    purchase_cap_per_user: row.purchaseCapPerUser,
    purchase_cap_total: row.purchaseCapTotal,
    pricing: row.pricing as Product["pricing"],
    media: row.media as Product["media"],
    tags: row.tags,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function rowToPlan(row: PlanRow): SupplierPlan {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    external_id: row.externalId,
    name: row.name,
    destinations: row.destinations,
    data_amount_mb: row.dataAmountMb,
    validity_days: row.validityDays,
    activation_policy: row.activationPolicy,
    delivery_model: row.deliveryModel,
    cost_amount: Number(row.costAmount),
    cost_currency: row.costCurrency,
    available: row.available,
    inventory_hint: row.inventoryHint,
    last_synced_at: row.lastSyncedAt?.toISOString() ?? null,
  };
}

export function rowToMapping(row: MappingRow): ProductSupplierMapping {
  return {
    id: row.id,
    product_id: row.productId,
    supplier_plan_id: row.supplierPlanId,
    priority: row.priority,
    enabled: row.enabled,
    notes: row.notes,
  };
}

export function joinMapping(
  mapping: MappingRow,
  plan: PlanRow,
): ProductMappingWithPlan {
  return {
    ...rowToMapping(mapping),
    plan: rowToPlan(plan),
  };
}

export function hydrateProduct(
  productRow: ProductRow,
  mappings: ProductMappingWithPlan[],
): ProductWithMappings {
  return {
    ...rowToProduct(productRow),
    mappings,
  };
}
