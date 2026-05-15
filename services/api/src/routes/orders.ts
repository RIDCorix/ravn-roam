// Admin-facing order list + detail + lifecycle (ROA-100 admin redesign).
//
// Scope (Phase 2 admin-only):
//   GET    /admin/orders                          — list with filters
//   GET    /admin/orders/:id                      — detail (header + items)
//   POST   /admin/orders                          — create (manual entry by ops)
//   POST   /admin/orders/:id/transitions          — mark paid / fulfilled /
//                                                   cancelled / refunded
//   GET    /admin/orders/aggregates/dashboard     — KPIs for the redesigned
//                                                   dashboard (revenue, cost,
//                                                   margin, status counts,
//                                                   top vendors, top products,
//                                                   top destinations)
//
// No customer-facing checkout flow lives here yet — Phase 4's order
// orchestration spec will eventually replace this manual-create route with
// a proper supplier-routing one.

import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { actorFromContext, recordAudit } from "./audit.js";

export const ordersRouter = new Hono();

const orderStatusEnum = z.enum([
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
]);

const orderItemCreate = z.object({
  product_id: z.string().uuid().nullish(),
  supplier_plan_id: z.string().uuid(),
  qty: z.number().int().min(1).default(1),
  unit_price: z.number().min(0),
  unit_cost: z.number().min(0),
  currency: z.string().length(3),
});

const orderCreateSchema = z.object({
  order_number: z.string().min(1).max(64),
  vendor_id: z.string().uuid(),
  customer_email: z.string().email(),
  customer_name: z.string().nullish(),
  status: orderStatusEnum.default("pending"),
  currency: z.string().length(3),
  notes: z.string().nullish(),
  metadata: z.record(z.unknown()).default({}),
  items: z.array(orderItemCreate).min(1),
});

const orderTransitionSchema = z.object({
  status: orderStatusEnum,
});

type OrderRow = typeof schema.orderRecord.$inferSelect;
type OrderItemRow = typeof schema.orderItem.$inferSelect;

function rowToOrder(row: OrderRow) {
  return {
    id: row.id,
    order_number: row.orderNumber,
    vendor_id: row.vendorId,
    customer_email: row.customerEmail,
    customer_name: row.customerName,
    status: row.status,
    total_amount: Number(row.totalAmount),
    cost_amount: Number(row.costAmount),
    currency: row.currency,
    notes: row.notes,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
    paid_at: row.paidAt?.toISOString() ?? null,
    fulfilled_at: row.fulfilledAt?.toISOString() ?? null,
    cancelled_at: row.cancelledAt?.toISOString() ?? null,
  };
}

function rowToOrderItem(row: OrderItemRow) {
  return {
    id: row.id,
    order_id: row.orderId,
    product_id: row.productId,
    supplier_plan_id: row.supplierPlanId,
    qty: row.qty,
    unit_price: Number(row.unitPrice),
    unit_cost: Number(row.unitCost),
    currency: row.currency,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    fulfilled_at: row.fulfilledAt?.toISOString() ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────
// AGGREGATES (mount FIRST so /:id doesn't capture "/aggregates/dashboard")
// ────────────────────────────────────────────────────────────────────────
ordersRouter.get("/aggregates/dashboard", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 30 * 86400 * 1000);

  // Status counts. Use COUNT(*) FILTER for one round-trip.
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      paid: sql<number>`count(*) filter (where status = 'paid')::int`,
      fulfilled: sql<number>`count(*) filter (where status = 'fulfilled')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
      refunded: sql<number>`count(*) filter (where status = 'refunded')::int`,
      revenue: sql<string>`coalesce(sum(total_amount), 0)::text`,
      cost: sql<string>`coalesce(sum(cost_amount), 0)::text`,
    })
    .from(schema.orderRecord)
    .where(gte(schema.orderRecord.createdAt, since));

  const revenue = Number(counts?.revenue ?? 0);
  const cost = Number(counts?.cost ?? 0);
  const margin = revenue === 0 ? 0 : (revenue - cost) / revenue;

  // Top vendors by revenue.
  const topVendorRows = await db
    .select({
      vendor_id: schema.orderRecord.vendorId,
      vendor_code: schema.vendor.code,
      vendor_name: schema.vendor.displayName,
      revenue: sql<string>`coalesce(sum(${schema.orderRecord.totalAmount}), 0)::text`,
      orders: sql<number>`count(*)::int`,
    })
    .from(schema.orderRecord)
    .innerJoin(
      schema.vendor,
      eq(schema.vendor.id, schema.orderRecord.vendorId),
    )
    .where(gte(schema.orderRecord.createdAt, since))
    .groupBy(
      schema.orderRecord.vendorId,
      schema.vendor.code,
      schema.vendor.displayName,
    )
    .orderBy(desc(sql`sum(${schema.orderRecord.totalAmount})`))
    .limit(5);

  // Supplier cost share.
  const supplierCostRows = await db
    .select({
      supplier_id: schema.supplier.id,
      supplier_code: schema.supplier.code,
      supplier_name: schema.supplier.displayName,
      cost: sql<string>`coalesce(sum(${schema.orderItem.unitCost} * ${schema.orderItem.qty}), 0)::text`,
      items: sql<number>`count(*)::int`,
    })
    .from(schema.orderItem)
    .innerJoin(
      schema.supplierPlan,
      eq(schema.supplierPlan.id, schema.orderItem.supplierPlanId),
    )
    .innerJoin(
      schema.supplier,
      eq(schema.supplier.id, schema.supplierPlan.supplierId),
    )
    .innerJoin(
      schema.orderRecord,
      eq(schema.orderRecord.id, schema.orderItem.orderId),
    )
    .where(gte(schema.orderRecord.createdAt, since))
    .groupBy(
      schema.supplier.id,
      schema.supplier.code,
      schema.supplier.displayName,
    )
    .orderBy(desc(sql`sum(${schema.orderItem.unitCost} * ${schema.orderItem.qty})`))
    .limit(8);

  // Recent orders.
  const recentRows = await db
    .select()
    .from(schema.orderRecord)
    .orderBy(desc(schema.orderRecord.createdAt))
    .limit(8);

  return c.json({
    range: { since: since.toISOString() },
    totals: {
      orders: counts?.total ?? 0,
      revenue,
      cost,
      margin,
      pending: counts?.pending ?? 0,
      paid: counts?.paid ?? 0,
      fulfilled: counts?.fulfilled ?? 0,
      cancelled: counts?.cancelled ?? 0,
      refunded: counts?.refunded ?? 0,
    },
    top_vendors: topVendorRows.map((r) => ({
      vendor_id: r.vendor_id,
      vendor_code: r.vendor_code,
      vendor_name: r.vendor_name,
      revenue: Number(r.revenue),
      orders: r.orders,
    })),
    supplier_cost_share: supplierCostRows.map((r) => ({
      supplier_id: r.supplier_id,
      supplier_code: r.supplier_code,
      supplier_name: r.supplier_name,
      cost: Number(r.cost),
      items: r.items,
    })),
    recent_orders: recentRows.map(rowToOrder),
  });
});

// ────────────────────────────────────────────────────────────────────────
// LIST
// ────────────────────────────────────────────────────────────────────────
ordersRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const vendorId = url.searchParams.get("vendor_id");
  const search = url.searchParams.get("q");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(schema.orderRecord.status, status as never));
  if (vendorId) conditions.push(eq(schema.orderRecord.vendorId, vendorId));
  if (since)
    conditions.push(gte(schema.orderRecord.createdAt, new Date(since)));
  if (until)
    conditions.push(lte(schema.orderRecord.createdAt, new Date(until)));
  if (search) {
    const like = `%${search}%`;
    const orExpr = or(
      ilike(schema.orderRecord.orderNumber, like),
      ilike(schema.orderRecord.customerEmail, like),
    );
    if (orExpr) conditions.push(orExpr as never);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.orderRecord)
    .where(where)
    .orderBy(desc(schema.orderRecord.createdAt))
    .limit(200);

  return c.json({ orders: rows.map(rowToOrder) });
});

// ────────────────────────────────────────────────────────────────────────
// READ
// ────────────────────────────────────────────────────────────────────────
ordersRouter.get("/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(schema.orderRecord)
    .where(eq(schema.orderRecord.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);

  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, id))
    .orderBy(asc(schema.orderItem.createdAt));

  return c.json({
    order: rowToOrder(row),
    items: items.map(rowToOrderItem),
  });
});

// ────────────────────────────────────────────────────────────────────────
// CREATE
// ────────────────────────────────────────────────────────────────────────
ordersRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: schema.orderRecord.id })
    .from(schema.orderRecord)
    .where(eq(schema.orderRecord.orderNumber, parsed.data.order_number))
    .limit(1);
  if (existing) return c.json({ error: "order_number_conflict" }, 409);

  // Compute totals from line items so caller can't desync header math.
  const totalAmount = parsed.data.items.reduce(
    (sum, i) => sum + i.unit_price * i.qty,
    0,
  );
  const costAmount = parsed.data.items.reduce(
    (sum, i) => sum + i.unit_cost * i.qty,
    0,
  );

  const [orderRow] = await db
    .insert(schema.orderRecord)
    .values({
      orderNumber: parsed.data.order_number,
      vendorId: parsed.data.vendor_id,
      customerEmail: parsed.data.customer_email,
      customerName: parsed.data.customer_name ?? null,
      status: parsed.data.status,
      totalAmount: String(totalAmount),
      costAmount: String(costAmount),
      currency: parsed.data.currency,
      notes: parsed.data.notes ?? null,
      metadata: parsed.data.metadata,
    })
    .returning();

  await db.insert(schema.orderItem).values(
    parsed.data.items.map((i) => ({
      orderId: orderRow!.id,
      productId: i.product_id ?? null,
      supplierPlanId: i.supplier_plan_id,
      qty: i.qty,
      unitPrice: String(i.unit_price),
      unitCost: String(i.unit_cost),
      currency: i.currency,
    })),
  );

  const order = rowToOrder(orderRow!);
  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "order.create",
    targetType: "order",
    targetId: order.id,
    before: null,
    after: order as unknown as Record<string, unknown>,
  });

  return c.json({ order }, 201);
});

// ────────────────────────────────────────────────────────────────────────
// TRANSITION (paid / fulfilled / cancelled / refunded)
// ────────────────────────────────────────────────────────────────────────
ordersRouter.post("/:id/transitions", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = orderTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.orderRecord)
    .where(eq(schema.orderRecord.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);
  const before = rowToOrder(existing);

  const now = new Date();
  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "paid" && !existing.paidAt) patch.paidAt = now;
  if (parsed.data.status === "fulfilled" && !existing.fulfilledAt)
    patch.fulfilledAt = now;
  if (parsed.data.status === "cancelled" && !existing.cancelledAt)
    patch.cancelledAt = now;

  const [row] = await db
    .update(schema.orderRecord)
    .set(patch)
    .where(eq(schema.orderRecord.id, id))
    .returning();
  const after = rowToOrder(row!);
  await recordAudit(db, {
    actor: actorFromContext(c),
    action: `order.${parsed.data.status}`,
    targetType: "order",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });
  return c.json({ order: after });
});
