// Thin client wrapper around the @roam/api admin endpoints. Server
// components import this with `await getProducts(...)`; client components
// import it via the bound action helpers in lib/actions.ts.

import type {
  Product,
  ProductWithMappings,
  SupplierPlan,
} from "@roam/catalog";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:3001";
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
  min_data_mb?: number;
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
  if (filters.min_data_mb != null)
    params.set("min_data_mb", String(filters.min_data_mb));
  if (filters.max_validity_days != null)
    params.set("max_validity_days", String(filters.max_validity_days));
  const qs = params.toString();
  const { plans } = await jsonFetch<{ plans: SupplierPlan[] }>(
    `/admin/supplier-plans${qs ? `?${qs}` : ""}`,
  );
  return plans;
}

export async function getSupplierPlan(id: string): Promise<SupplierPlan> {
  const { plan } = await jsonFetch<{ plan: SupplierPlan }>(
    `/admin/supplier-plans/${id}`,
  );
  return plan;
}
