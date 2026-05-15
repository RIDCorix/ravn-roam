// Supplier-plan list + admin-toggle endpoints.
//
// Numeric / inclusion fields (cost, destinations, data, validity, …) are
// owned by the sync job and must NOT be edited from the UI. PATCH only
// accepts `admin_enabled`; the route refuses to read other fields.

import { supplierPlanAdminPatchSchema } from "@roam/catalog";
import { and, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { actorFromContext, recordAudit } from "./audit.js";
import { rowToPlan, rowToPlanDetail } from "./catalog-helpers.js";

export const supplierPlansRouter = new Hono();

supplierPlansRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const country = url.searchParams.get("country");
  const supplierId = url.searchParams.get("supplier_id");
  const search = url.searchParams.get("q");
  const minData = parseIntOrNull(url.searchParams.get("min_data_mb"));
  const minValidity = parseIntOrNull(url.searchParams.get("min_validity_days"));
  const maxValidity = parseIntOrNull(url.searchParams.get("max_validity_days"));
  const availableOnly = url.searchParams.get("available_only") !== "false";
  const adminEnabledParam = url.searchParams.get("admin_enabled");

  const conditions = [];
  if (supplierId) conditions.push(eq(schema.supplierPlan.supplierId, supplierId));
  if (availableOnly) conditions.push(eq(schema.supplierPlan.available, true));
  if (adminEnabledParam === "true")
    conditions.push(eq(schema.supplierPlan.adminEnabled, true));
  if (adminEnabledParam === "false")
    conditions.push(eq(schema.supplierPlan.adminEnabled, false));
  if (country) {
    // text[] contains check via @>.
    conditions.push(
      sql`${schema.supplierPlan.destinations} @> ARRAY[${country}]::text[]`,
    );
  }
  if (minData != null)
    conditions.push(gte(schema.supplierPlan.dataAmountMb, minData));
  if (minValidity != null)
    conditions.push(gte(schema.supplierPlan.validityDays, minValidity));
  if (maxValidity != null)
    conditions.push(lte(schema.supplierPlan.validityDays, maxValidity));
  if (search) {
    const like = `%${search}%`;
    const orExpr = or(
      ilike(schema.supplierPlan.name, like),
      ilike(schema.supplierPlan.externalId, like),
    );
    if (orExpr) conditions.push(orExpr);
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(schema.supplierPlan)
    .where(where)
    .orderBy(asc(schema.supplierPlan.costAmount))
    .limit(200);

  return c.json({ plans: rows.map(rowToPlan) });
});

supplierPlansRouter.get("/:id", async (c) => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.supplierPlan)
    .where(eq(schema.supplierPlan.id, c.req.param("id")))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ plan: rowToPlanDetail(row) });
});

// Admin-controlled enable/disable. Only `admin_enabled` is patchable —
// numeric / inclusion columns are sync-owned. The Zod schema enforces that
// shape; the route additionally rejects any unknown keys so an over-eager
// caller can't slip a `cost_amount` field past the strict()-less default.
supplierPlansRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const rawBody = await c.req.json();

  if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
    const extra = Object.keys(rawBody).filter((k) => k !== "admin_enabled");
    if (extra.length > 0) {
      return c.json(
        {
          error: "fields_locked",
          message:
            "supplier_plan rows are sync-owned; only `admin_enabled` is mutable.",
          locked: extra,
        },
        409,
      );
    }
  }

  const parsed = supplierPlanAdminPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.supplierPlan)
    .where(eq(schema.supplierPlan.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const before = rowToPlan(existing);

  const [row] = await db
    .update(schema.supplierPlan)
    .set({ adminEnabled: parsed.data.admin_enabled, updatedAt: new Date() })
    .where(eq(schema.supplierPlan.id, id))
    .returning();

  const after = rowToPlanDetail(row!);

  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "supplier_plan.toggle",
    targetType: "supplier_plan",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: { admin_enabled: after.admin_enabled },
  });

  return c.json({ plan: after });
});

function parseIntOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
