// Admin-facing catalog routes.
//
// Phase 2 RBAC is "platform admin only" — there's no auth middleware here
// yet. The migration that ENABLE'd RLS keeps anon / authenticated locked to
// `publication_state = 'published'`; this service connects through
// `roam_poc_user` (BYPASSRLS) so it sees every row regardless of state.
// Phase 3 will add JWT-bound vendor scoping in front of these handlers.

import {
  type ProductWithMappings,
  areMappingsLocked,
  checkPrimaryParity,
  checkSubstitution,
  isFieldLocked,
  isPricingLocked,
  isProductEditable,
  mappingReorderSchema,
  mappingUpsertSchema,
  missingLocales,
  productCreateSchema,
  productUpdateSchema,
  publicationActionSchema,
  tryTransition,
} from "@roam/catalog";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import {
  hydrateProduct,
  joinMapping,
  rowToPlan,
  rowToProduct,
} from "./catalog-helpers.js";

const PLATFORM_VENDOR_ID = "00000000-0000-0000-0000-0000000000a1";

export const productsRouter = new Hono();

// ────────────────────────────────────────────────────────────────────────
// LIST
// ────────────────────────────────────────────────────────────────────────
productsRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const state = url.searchParams.get("publication_state");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("q");

  const conditions: ReturnType<typeof eq>[] = [];
  if (state) conditions.push(eq(schema.product.publicationState, state as never));
  if (category) conditions.push(eq(schema.product.category, category as never));
  if (search) {
    const like = `%${search}%`;
    const orExpr = or(
      ilike(schema.product.slug, like),
      sql`(${schema.product.displayNameI18n}->>'en') ILIKE ${like}`,
      sql`(${schema.product.displayNameI18n}->>'zh-TW') ILIKE ${like}`,
    );
    if (orExpr) conditions.push(orExpr as never);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(desc(schema.product.updatedAt))
    .limit(200);

  return c.json({ products: rows.map(rowToProduct) });
});

// ────────────────────────────────────────────────────────────────────────
// READ ONE (with mappings)
// ────────────────────────────────────────────────────────────────────────
async function loadProductWithMappings(
  id: string,
): Promise<ProductWithMappings | null> {
  const db = getDb();
  const [productRow] = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.id, id))
    .limit(1);

  if (!productRow) return null;

  const mappingRows = await db
    .select({
      mapping: schema.productSupplierMapping,
      plan: schema.supplierPlan,
    })
    .from(schema.productSupplierMapping)
    .innerJoin(
      schema.supplierPlan,
      eq(schema.productSupplierMapping.supplierPlanId, schema.supplierPlan.id),
    )
    .where(eq(schema.productSupplierMapping.productId, id))
    .orderBy(asc(schema.productSupplierMapping.priority));

  return hydrateProduct(
    productRow,
    mappingRows.map(({ mapping, plan }) => joinMapping(mapping, plan)),
  );
}

productsRouter.get("/:id", async (c) => {
  const product = await loadProductWithMappings(c.req.param("id"));
  if (!product) return c.json({ error: "not_found" }, 404);
  return c.json({ product });
});

// ────────────────────────────────────────────────────────────────────────
// CREATE
// ────────────────────────────────────────────────────────────────────────
productsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [row] = await db
    .insert(schema.product)
    .values({
      slug: parsed.data.slug,
      ownerVendorId: PLATFORM_VENDOR_ID,
      category: parsed.data.category,
      displayNameI18n: parsed.data.display_name_i18n,
      descriptionI18n: parsed.data.description_i18n,
      marketingDestinations: parsed.data.marketing_destinations,
      dataAmountMb: parsed.data.data_amount_mb,
      validityDays: parsed.data.validity_days,
      activationPolicyDisplay: parsed.data.activation_policy_display,
      salesWindowStart: parsed.data.sales_window_start
        ? new Date(parsed.data.sales_window_start)
        : null,
      salesWindowEnd: parsed.data.sales_window_end
        ? new Date(parsed.data.sales_window_end)
        : null,
      salesRegionAllow: parsed.data.sales_region_allow,
      salesRegionDeny: parsed.data.sales_region_deny,
      purchaseCapPerUser: parsed.data.purchase_cap_per_user ?? null,
      purchaseCapTotal: parsed.data.purchase_cap_total ?? null,
      pricing: parsed.data.pricing,
      media: parsed.data.media,
      tags: parsed.data.tags,
    })
    .returning();

  return c.json({ product: rowToProduct(row!) }, 201);
});

// ────────────────────────────────────────────────────────────────────────
// UPDATE
// ────────────────────────────────────────────────────────────────────────
productsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = productUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await loadProductWithMappings(id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  if (!isProductEditable(existing.publication_state)) {
    return c.json(
      {
        error: "product_archived",
        message: "Archived products are not editable — unarchive first.",
      },
      409,
    );
  }

  // Enforce the regulation doc §4 "published lock" — only the whitelisted
  // fields may change once the product is live.
  const requested = Object.keys(parsed.data) as Array<
    keyof typeof parsed.data
  >;
  const locked = requested.filter((field) => {
    // The map below converts the request-body key to the Product field
    // name the lock predicate knows about.
    const productField = REQUEST_TO_PRODUCT_FIELD[field];
    return productField
      ? isFieldLocked(existing.publication_state, productField)
      : false;
  });
  if (locked.length > 0) {
    return c.json(
      {
        error: "field_locked",
        message: `These fields are locked on ${existing.publication_state} products: ${locked.join(", ")}`,
        locked,
      },
      409,
    );
  }

  if ("pricing" in parsed.data && isPricingLocked(existing.publication_state)) {
    return c.json({ error: "pricing_locked" }, 409);
  }

  const db = getDb();
  const patch: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.slug !== undefined) patch.slug = d.slug;
  if (d.category !== undefined) patch.category = d.category;
  if (d.display_name_i18n !== undefined)
    patch.displayNameI18n = d.display_name_i18n;
  if (d.description_i18n !== undefined)
    patch.descriptionI18n = d.description_i18n;
  if (d.marketing_destinations !== undefined)
    patch.marketingDestinations = d.marketing_destinations;
  if (d.data_amount_mb !== undefined) patch.dataAmountMb = d.data_amount_mb;
  if (d.validity_days !== undefined) patch.validityDays = d.validity_days;
  if (d.activation_policy_display !== undefined)
    patch.activationPolicyDisplay = d.activation_policy_display;
  if (d.sales_window_start !== undefined)
    patch.salesWindowStart = d.sales_window_start
      ? new Date(d.sales_window_start)
      : null;
  if (d.sales_window_end !== undefined)
    patch.salesWindowEnd = d.sales_window_end
      ? new Date(d.sales_window_end)
      : null;
  if (d.sales_region_allow !== undefined)
    patch.salesRegionAllow = d.sales_region_allow;
  if (d.sales_region_deny !== undefined)
    patch.salesRegionDeny = d.sales_region_deny;
  if (d.purchase_cap_per_user !== undefined)
    patch.purchaseCapPerUser = d.purchase_cap_per_user ?? null;
  if (d.purchase_cap_total !== undefined)
    patch.purchaseCapTotal = d.purchase_cap_total ?? null;
  if (d.pricing !== undefined) patch.pricing = d.pricing;
  if (d.media !== undefined) patch.media = d.media;
  if (d.tags !== undefined) patch.tags = d.tags;
  patch.updatedAt = new Date();

  const [row] = await db
    .update(schema.product)
    .set(patch)
    .where(eq(schema.product.id, id))
    .returning();

  return c.json({ product: rowToProduct(row!) });
});

// Map request-body keys → Product type keys for the lock-check helper.
const REQUEST_TO_PRODUCT_FIELD = {
  slug: "slug",
  category: "category",
  display_name_i18n: "display_name_i18n",
  description_i18n: "description_i18n",
  marketing_destinations: "marketing_destinations",
  data_amount_mb: "data_amount_mb",
  validity_days: "validity_days",
  activation_policy_display: "activation_policy_display",
  sales_window_start: "sales_window_start",
  sales_window_end: "sales_window_end",
  sales_region_allow: "sales_region_allow",
  sales_region_deny: "sales_region_deny",
  purchase_cap_per_user: "purchase_cap_per_user",
  purchase_cap_total: "purchase_cap_total",
  pricing: "pricing",
  media: "media",
  tags: "tags",
} as const;

// ────────────────────────────────────────────────────────────────────────
// MAPPINGS
// ────────────────────────────────────────────────────────────────────────
productsRouter.post("/:id/mappings", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = mappingUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await loadProductWithMappings(id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (areMappingsLocked(existing.publication_state)) {
    return c.json({ error: "mappings_locked" }, 409);
  }

  const db = getDb();
  const [planRow] = await db
    .select()
    .from(schema.supplierPlan)
    .where(eq(schema.supplierPlan.id, parsed.data.supplier_plan_id))
    .limit(1);
  if (!planRow) return c.json({ error: "plan_not_found" }, 404);
  const candidate = rowToPlan(planRow);

  if (parsed.data.priority === 0) {
    // New primary — enforce parity, then propagate the plan's data /
    // validity / activation policy onto the product.
    const parityViolations = checkPrimaryParity(existing, candidate);
    if (parityViolations.length > 0) {
      return c.json(
        { error: "primary_parity", violations: parityViolations },
        422,
      );
    }
  } else {
    // Fallback — needs a primary to compare against.
    const primary = existing.mappings.find((m) => m.priority === 0);
    if (!primary) {
      return c.json({ error: "no_primary" }, 422);
    }
    const violations = checkSubstitution({
      primary: primary.plan,
      candidate,
      marketingDestinations: existing.marketing_destinations,
    });
    if (violations.length > 0) {
      return c.json({ error: "substitution_violation", violations }, 422);
    }
  }

  const [row] = await db
    .insert(schema.productSupplierMapping)
    .values({
      productId: id,
      supplierPlanId: parsed.data.supplier_plan_id,
      priority: parsed.data.priority,
      enabled: parsed.data.enabled,
      notes: parsed.data.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [
        schema.productSupplierMapping.productId,
        schema.productSupplierMapping.supplierPlanId,
      ],
      set: {
        priority: parsed.data.priority,
        enabled: parsed.data.enabled,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ mapping: { ...row!, plan: candidate } });
});

productsRouter.put("/:id/mappings/order", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = mappingReorderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await loadProductWithMappings(id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (areMappingsLocked(existing.publication_state)) {
    return c.json({ error: "mappings_locked" }, 409);
  }

  const knownIds = new Set(existing.mappings.map((m) => m.supplier_plan_id));
  if (
    parsed.data.order.length !== existing.mappings.length ||
    !parsed.data.order.every((pid) => knownIds.has(pid))
  ) {
    return c.json({ error: "order_mismatch" }, 422);
  }

  const db = getDb();
  // Two-phase update to dodge the unique (product_id, priority) collision —
  // there isn't one today, but planned indexes in Phase 4 may add one.
  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.order.length; i++) {
      await tx
        .update(schema.productSupplierMapping)
        .set({ priority: 1000 + i, updatedAt: new Date() })
        .where(
          and(
            eq(schema.productSupplierMapping.productId, id),
            eq(
              schema.productSupplierMapping.supplierPlanId,
              parsed.data.order[i]!,
            ),
          ),
        );
    }
    for (let i = 0; i < parsed.data.order.length; i++) {
      await tx
        .update(schema.productSupplierMapping)
        .set({ priority: i, updatedAt: new Date() })
        .where(
          and(
            eq(schema.productSupplierMapping.productId, id),
            eq(
              schema.productSupplierMapping.supplierPlanId,
              parsed.data.order[i]!,
            ),
          ),
        );
    }
  });

  const updated = await loadProductWithMappings(id);
  return c.json({ product: updated });
});

productsRouter.delete("/:id/mappings/:planId", async (c) => {
  const id = c.req.param("id");
  const planId = c.req.param("planId");

  const existing = await loadProductWithMappings(id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (areMappingsLocked(existing.publication_state)) {
    return c.json({ error: "mappings_locked" }, 409);
  }

  const db = getDb();
  await db
    .delete(schema.productSupplierMapping)
    .where(
      and(
        eq(schema.productSupplierMapping.productId, id),
        eq(schema.productSupplierMapping.supplierPlanId, planId),
      ),
    );

  const updated = await loadProductWithMappings(id);
  return c.json({ product: updated });
});

// ────────────────────────────────────────────────────────────────────────
// PUBLICATION ACTIONS
// ────────────────────────────────────────────────────────────────────────
productsRouter.post("/:id/publication", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = publicationActionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await loadProductWithMappings(id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const next = tryTransition(existing.publication_state, parsed.data.action);
  if (!next.ok) {
    return c.json({ error: "invalid_transition", reason: next.reason }, 409);
  }

  // Publish-time gates: must have a primary mapping, must have name in both
  // required locales. These are publish-step-only — drafts are allowed to be
  // incomplete.
  if (next.to === "published" || next.to === "in_review") {
    const primary = existing.mappings.find((m) => m.priority === 0);
    if (!primary) {
      return c.json(
        { error: "missing_primary_mapping", required: "primary" },
        422,
      );
    }
    const missing = missingLocales(existing.display_name_i18n);
    if (missing.length > 0) {
      return c.json(
        {
          error: "missing_locales",
          message: `Missing translations: ${missing.join(", ")}`,
          missing,
        },
        422,
      );
    }
  }

  const db = getDb();
  await db
    .update(schema.product)
    .set({ publicationState: next.to!, updatedAt: new Date() })
    .where(eq(schema.product.id, id));

  const updated = await loadProductWithMappings(id);
  return c.json({ product: updated });
});
