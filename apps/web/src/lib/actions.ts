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
} from "@roam/catalog";

import {
  ApiError,
  createProduct,
  patchProduct,
  publicationAction,
  removeMapping,
  reorderMappings,
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
