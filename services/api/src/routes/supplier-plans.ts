// Supplier-plan list endpoint for the admin "create product from plan"
// shortcut (regulation doc §7 step 2a).
//
// Admin UI uses filter params (country / data range / validity range / cost
// range) to narrow plans before picking one. The endpoint is read-only;
// supplier_plan rows are owned by the sync job, not the admin UI.

import { and, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { rowToPlan } from "./catalog-helpers.js";

export const supplierPlansRouter = new Hono();

supplierPlansRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const country = url.searchParams.get("country");
  const supplierId = url.searchParams.get("supplier_id");
  const search = url.searchParams.get("q");
  const minData = parseIntOrNull(url.searchParams.get("min_data_mb"));
  const maxValidity = parseIntOrNull(url.searchParams.get("max_validity_days"));
  const availableOnly = url.searchParams.get("available_only") !== "false";

  const conditions = [];
  if (supplierId) conditions.push(eq(schema.supplierPlan.supplierId, supplierId));
  if (availableOnly) conditions.push(eq(schema.supplierPlan.available, true));
  if (country) {
    // text[] contains check via @>.
    conditions.push(
      sql`${schema.supplierPlan.destinations} @> ARRAY[${country}]::text[]`,
    );
  }
  if (minData != null)
    conditions.push(gte(schema.supplierPlan.dataAmountMb, minData));
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
  return c.json({ plan: rowToPlan(row) });
});

function parseIntOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
