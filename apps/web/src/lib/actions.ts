"use server";

// Server actions that proxy to the catalog API. Components call these from
// onClick handlers; revalidatePath bumps the cached list / detail view so
// Next.js re-renders with fresh data after a mutation.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  publicationActionSchema,
  productCreateSchema,
  productUpdateSchema,
  mappingUpsertSchema,
  mappingReorderSchema,
  supplierCreateSchema,
  supplierPauseSchema,
  supplierPlanAdminPatchSchema,
  supplierUpdateSchema,
} from "@roam/catalog";

import {
  ApiError,
  createProduct,
  createSupplier,
  patchProduct,
  patchSupplier,
  patchSupplierPlan,
  pauseSupplier,
  publicationAction,
  removeMapping,
  reorderMappings,
  triggerSupplierSync,
  upsertMapping,
} from "./api";

export interface ActionResult {
  ok: boolean;
  error?: string;
  status?: number;
  details?: unknown;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return { ok: false, error: err.message, status: err.status, details: err.parsed() };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "unknown_error" };
}

const createInputSchema = productCreateSchema;

export async function createProductAction(
  lang: string,
  raw: z.infer<typeof createInputSchema>,
): Promise<ActionResult & { id?: string }> {
  try {
    const parsed = createInputSchema.parse(raw);
    const product = await createProduct(parsed);
    revalidatePath(`/${lang}/admin/products`);
    redirect(`/${lang}/admin/products/${product.id}/edit`);
  } catch (err) {
    // redirect throws — re-throw the redirect so Next.js handles it
    if (err && typeof err === "object" && "digest" in err) throw err;
    return toResult(err);
  }
  return { ok: true };
}

export async function updateProductAction(
  lang: string,
  id: string,
  raw: z.infer<typeof productUpdateSchema>,
): Promise<ActionResult> {
  try {
    await patchProduct(id, raw);
    revalidatePath(`/${lang}/admin/products`);
    revalidatePath(`/${lang}/admin/products/${id}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addMappingAction(
  lang: string,
  productId: string,
  raw: z.infer<typeof mappingUpsertSchema>,
): Promise<ActionResult> {
  try {
    await upsertMapping(productId, raw);
    revalidatePath(`/${lang}/admin/products/${productId}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function reorderMappingsAction(
  lang: string,
  productId: string,
  raw: z.infer<typeof mappingReorderSchema>,
): Promise<ActionResult> {
  try {
    await reorderMappings(productId, raw.order);
    revalidatePath(`/${lang}/admin/products/${productId}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeMappingAction(
  lang: string,
  productId: string,
  planId: string,
): Promise<ActionResult> {
  try {
    await removeMapping(productId, planId);
    revalidatePath(`/${lang}/admin/products/${productId}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function publicationActionRunner(
  lang: string,
  productId: string,
  raw: z.infer<typeof publicationActionSchema>,
): Promise<ActionResult> {
  try {
    await publicationAction(productId, raw.action);
    revalidatePath(`/${lang}/admin/products`);
    revalidatePath(`/${lang}/admin/products/${productId}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Supplier actions (ROA-60)
// ──────────────────────────────────────────────────────────────────────

export async function createSupplierAction(
  lang: string,
  raw: z.infer<typeof supplierCreateSchema>,
): Promise<ActionResult & { id?: string }> {
  try {
    const parsed = supplierCreateSchema.parse(raw);
    const supplier = await createSupplier(parsed);
    revalidatePath(`/${lang}/admin/suppliers`);
    redirect(`/${lang}/admin/suppliers/${supplier.id}`);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return toResult(err);
  }
  return { ok: true };
}

export async function updateSupplierAction(
  lang: string,
  id: string,
  raw: z.infer<typeof supplierUpdateSchema>,
): Promise<ActionResult> {
  try {
    const parsed = supplierUpdateSchema.parse(raw);
    await patchSupplier(id, parsed);
    revalidatePath(`/${lang}/admin/suppliers`);
    revalidatePath(`/${lang}/admin/suppliers/${id}`);
    revalidatePath(`/${lang}/admin/suppliers/${id}/edit`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function pauseSupplierAction(
  lang: string,
  id: string,
  raw: z.infer<typeof supplierPauseSchema>,
): Promise<ActionResult> {
  try {
    const parsed = supplierPauseSchema.parse(raw);
    await pauseSupplier(id, parsed.status);
    revalidatePath(`/${lang}/admin/suppliers`);
    revalidatePath(`/${lang}/admin/suppliers/${id}`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function triggerSupplierSyncAction(
  lang: string,
  supplierId: string,
  code: string,
): Promise<ActionResult & { logId?: string }> {
  try {
    const result = await triggerSupplierSync(code);
    revalidatePath(`/${lang}/admin/suppliers/${supplierId}`);
    revalidatePath(`/${lang}/admin/supplier-plans`);
    return { ok: result.ok, logId: result.logId };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleSupplierPlanAction(
  lang: string,
  planId: string,
  raw: z.infer<typeof supplierPlanAdminPatchSchema>,
): Promise<ActionResult> {
  try {
    const parsed = supplierPlanAdminPatchSchema.parse(raw);
    await patchSupplierPlan(planId, parsed);
    revalidatePath(`/${lang}/admin/supplier-plans`);
    revalidatePath(`/${lang}/admin/supplier-plans/${planId}`);
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
