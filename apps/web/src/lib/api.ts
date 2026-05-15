// Thin client wrapper around the @roam/api admin endpoints. Server
// components import this with `await getProducts(...)`; client components
// import it via the bound action helpers in lib/actions.ts.

import type {
  Product,
  ProductWithMappings,
  Supplier,
  SupplierPlan,
  SupplierPlanDetail,
  SupplierPlanSyncLog,
  SupplierStatus,
} from "@roam/catalog";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:3001";
}

function adminUser(): string {
  return process.env.ROAM_ADMIN_USER ?? "admin";
}

function adminTokenHeaders(): Record<string, string> {
  const token = process.env.ROAM_ADMIN_TOKEN;
  const headers: Record<string, string> = {
    "x-admin-user": adminUser(),
  };
  if (token) headers["x-admin-token"] = token;
  return headers;
}

export interface ProductListFilters {
  publication_state?: string;
  category?: string;
  q?: string;
}

async function jsonFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-user": adminUser(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
  parsed<T = unknown>(): T | null {
    try {
      return JSON.parse(this.body) as T;
    } catch {
      return null;
    }
  }
}

export async function listProducts(
  filters: ProductListFilters = {},
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filters.publication_state)
    params.set("publication_state", filters.publication_state);
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  const { products } = await jsonFetch<{ products: Product[] }>(
    `/admin/products${qs ? `?${qs}` : ""}`,
  );
  return products;
}

export async function getProduct(id: string): Promise<ProductWithMappings> {
  const { product } = await jsonFetch<{ product: ProductWithMappings }>(
    `/admin/products/${id}`,
  );
  return product;
}

export async function createProduct(
  input: unknown,
): Promise<ProductWithMappings> {
  const { product } = await jsonFetch<{ product: ProductWithMappings }>(
    `/admin/products`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return product;
}

export async function patchProduct(
  id: string,
  input: unknown,
): Promise<ProductWithMappings> {
  const { product } = await jsonFetch<{ product: ProductWithMappings }>(
    `/admin/products/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return product;
}

export async function upsertMapping(
  productId: string,
  input: {
    supplier_plan_id: string;
    priority: number;
    enabled?: boolean;
    notes?: string | null;
  },
): Promise<void> {
  await jsonFetch(`/admin/products/${productId}/mappings`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reorderMappings(
  productId: string,
  order: string[],
): Promise<void> {
  await jsonFetch(`/admin/products/${productId}/mappings/order`, {
    method: "PUT",
    body: JSON.stringify({ order }),
  });
}

export async function removeMapping(
  productId: string,
  planId: string,
): Promise<void> {
  await jsonFetch(`/admin/products/${productId}/mappings/${planId}`, {
    method: "DELETE",
  });
}

export async function publicationAction(
  productId: string,
  action: string,
): Promise<void> {
  await jsonFetch(`/admin/products/${productId}/publication`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export interface SupplierPlanFilters {
  country?: string;
  q?: string;
  supplier_id?: string;
  available_only?: boolean;
  admin_enabled?: "true" | "false";
  min_data_mb?: number;
  min_validity_days?: number;
  max_validity_days?: number;
}

export async function listSupplierPlans(
  filters: SupplierPlanFilters = {},
): Promise<SupplierPlan[]> {
  const params = new URLSearchParams();
  if (filters.country) params.set("country", filters.country);
  if (filters.q) params.set("q", filters.q);
  if (filters.supplier_id) params.set("supplier_id", filters.supplier_id);
  if (filters.available_only === false) params.set("available_only", "false");
  if (filters.admin_enabled) params.set("admin_enabled", filters.admin_enabled);
  if (filters.min_data_mb != null)
    params.set("min_data_mb", String(filters.min_data_mb));
  if (filters.min_validity_days != null)
    params.set("min_validity_days", String(filters.min_validity_days));
  if (filters.max_validity_days != null)
    params.set("max_validity_days", String(filters.max_validity_days));
  const qs = params.toString();
  const { plans } = await jsonFetch<{ plans: SupplierPlan[] }>(
    `/admin/supplier-plans${qs ? `?${qs}` : ""}`,
  );
  return plans;
}

export async function getSupplierPlan(id: string): Promise<SupplierPlanDetail> {
  const { plan } = await jsonFetch<{ plan: SupplierPlanDetail }>(
    `/admin/supplier-plans/${id}`,
  );
  return plan;
}

export async function patchSupplierPlan(
  id: string,
  input: { admin_enabled: boolean },
): Promise<SupplierPlanDetail> {
  const { plan } = await jsonFetch<{ plan: SupplierPlanDetail }>(
    `/admin/supplier-plans/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return plan;
}

export interface SupplierListFilters {
  status?: SupplierStatus;
  q?: string;
}

export async function listSuppliers(
  filters: SupplierListFilters = {},
): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  const { suppliers } = await jsonFetch<{ suppliers: Supplier[] }>(
    `/admin/suppliers${qs ? `?${qs}` : ""}`,
  );
  return suppliers;
}

export async function getSupplier(id: string): Promise<{
  supplier: Supplier;
  sync_logs: SupplierPlanSyncLog[];
}> {
  return jsonFetch<{ supplier: Supplier; sync_logs: SupplierPlanSyncLog[] }>(
    `/admin/suppliers/${id}`,
  );
}

export async function createSupplier(input: unknown): Promise<Supplier> {
  const { supplier } = await jsonFetch<{ supplier: Supplier }>(
    `/admin/suppliers`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return supplier;
}

export async function patchSupplier(
  id: string,
  input: unknown,
): Promise<Supplier> {
  const { supplier } = await jsonFetch<{ supplier: Supplier }>(
    `/admin/suppliers/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return supplier;
}

export async function pauseSupplier(
  id: string,
  status: "active" | "paused",
): Promise<Supplier> {
  const { supplier } = await jsonFetch<{ supplier: Supplier }>(
    `/admin/suppliers/${id}/pause`,
    { method: "POST", body: JSON.stringify({ status }) },
  );
  return supplier;
}

export async function triggerSupplierSync(
  code: string,
): Promise<{ ok: boolean; logId?: string; status?: string }> {
  return jsonFetch<{ ok: boolean; logId?: string; status?: string }>(
    `/admin/suppliers/${code}/sync`,
    {
      method: "POST",
      body: "{}",
      headers: adminTokenHeaders(),
    },
  );
}

// ────────────────────────────────────────────────────────────────────────
// VENDORS (ROA-100 admin redesign — tier-1 RBAC + commercial metadata)
// ────────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  code: string;
  display_name: string;
  tier: "platform" | "tier1" | "tier2";
  status: "active" | "paused" | "terminated";
  grade: "A" | "B" | "C" | null;
  contact_email: string | null;
  commission_rate: number | null;
  contract_terms: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorFilters {
  status?: Vendor["status"];
  tier?: Vendor["tier"];
  grade?: Vendor["grade"] extends infer T ? Exclude<T, null> : never;
  q?: string;
}

export async function listVendors(
  filters: VendorFilters = {},
): Promise<Vendor[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  const { vendors } = await jsonFetch<{ vendors: Vendor[] }>(
    `/admin/vendors${qs ? `?${qs}` : ""}`,
  );
  return vendors;
}

export async function getVendor(id: string): Promise<Vendor> {
  const { vendor } = await jsonFetch<{ vendor: Vendor }>(`/admin/vendors/${id}`);
  return vendor;
}

export async function createVendor(input: {
  code: string;
  display_name: string;
  tier?: Vendor["tier"];
  status?: Vendor["status"];
  grade?: Vendor["grade"];
  contact_email?: string | null;
  commission_rate?: number | null;
  contract_terms?: Record<string, unknown>;
  notes?: string | null;
}): Promise<Vendor> {
  const { vendor } = await jsonFetch<{ vendor: Vendor }>(`/admin/vendors`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return vendor;
}

export async function patchVendor(
  id: string,
  input: Partial<Omit<Vendor, "id" | "code" | "created_at" | "updated_at">>,
): Promise<Vendor> {
  const { vendor } = await jsonFetch<{ vendor: Vendor }>(
    `/admin/vendors/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return vendor;
}

// ────────────────────────────────────────────────────────────────────────
// ORDERS (ROA-100)
// ────────────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  order_number: string;
  vendor_id: string;
  customer_email: string;
  customer_name: string | null;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  total_amount: number;
  cost_amount: number;
  currency: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  supplier_plan_id: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  currency: string;
  status: "pending_fulfilment" | "fulfilled" | "failed" | "refunded";
  created_at: string;
  fulfilled_at: string | null;
}

export interface OrderFilters {
  status?: Order["status"];
  vendor_id?: string;
  q?: string;
  since?: string;
  until?: string;
}

export async function listOrders(
  filters: OrderFilters = {},
): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.vendor_id) params.set("vendor_id", filters.vendor_id);
  if (filters.q) params.set("q", filters.q);
  if (filters.since) params.set("since", filters.since);
  if (filters.until) params.set("until", filters.until);
  const qs = params.toString();
  const { orders } = await jsonFetch<{ orders: Order[] }>(
    `/admin/orders${qs ? `?${qs}` : ""}`,
  );
  return orders;
}

export async function getOrder(id: string): Promise<{
  order: Order;
  items: OrderItem[];
}> {
  return jsonFetch<{ order: Order; items: OrderItem[] }>(`/admin/orders/${id}`);
}

export async function transitionOrder(
  id: string,
  status: Order["status"],
): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>(
    `/admin/orders/${id}/transitions`,
    { method: "POST", body: JSON.stringify({ status }) },
  );
  return order;
}

export interface DashboardAggregates {
  range: { since: string };
  totals: {
    orders: number;
    revenue: number;
    cost: number;
    margin: number;
    pending: number;
    paid: number;
    fulfilled: number;
    cancelled: number;
    refunded: number;
  };
  top_vendors: Array<{
    vendor_id: string;
    vendor_code: string;
    vendor_name: string;
    revenue: number;
    orders: number;
  }>;
  supplier_cost_share: Array<{
    supplier_id: string;
    supplier_code: string;
    supplier_name: string;
    cost: number;
    items: number;
  }>;
  recent_orders: Order[];
}

export async function getDashboardAggregates(
  since?: string,
): Promise<DashboardAggregates> {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  const qs = params.toString();
  return jsonFetch<DashboardAggregates>(
    `/admin/orders/aggregates/dashboard${qs ? `?${qs}` : ""}`,
  );
}
