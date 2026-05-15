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
