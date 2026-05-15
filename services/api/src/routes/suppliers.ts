// Admin-facing supplier CRUD + pause/resume.
//
// Scope (ROA-60):
//   GET    /admin/suppliers             — list
//   GET    /admin/suppliers/:id         — detail (with recent sync logs)
//   POST   /admin/suppliers             — create
//   PATCH  /admin/suppliers/:id         — partial update (no `code` change)
//   POST   /admin/suppliers/:id/pause   — explicit active↔paused state set
//
// Audit: every mutation appends to roam_poc.audit_log with the verbatim
// `x-admin-user` header as the actor. No auth middleware — matches the
// posture of /admin/products and /admin/supplier-plans for Phase 2. The
// catalog tables are RLS-protected at the DB layer; the Node API connects
// through `roam_poc_user` (BYPASSRLS).

import {
  supplierCreateSchema,
  supplierPauseSchema,
  supplierUpdateSchema,
} from "@roam/catalog";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { actorFromContext, recordAudit } from "./audit.js";
import { rowToSupplier, rowToSyncLog } from "./catalog-helpers.js";

export const suppliersRouter = new Hono();

// ────────────────────────────────────────────────────────────────────────
// LIST
// ────────────────────────────────────────────────────────────────────────
suppliersRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) {
    conditions.push(eq(schema.supplier.status, status as never));
  }
  if (search) {
    const like = `%${search}%`;
    const orExpr = or(
      ilike(schema.supplier.code, like),
      ilike(schema.supplier.displayName, like),
    );
    if (orExpr) conditions.push(orExpr as never);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.supplier)
    .where(where)
    .orderBy(asc(schema.supplier.code))
    .limit(200);

  return c.json({ suppliers: rows.map(rowToSupplier) });
});

// ────────────────────────────────────────────────────────────────────────
// READ ONE (with last sync logs)
// ────────────────────────────────────────────────────────────────────────
suppliersRouter.get("/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(schema.supplier)
    .where(eq(schema.supplier.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);

  const logRows = await db
    .select()
    .from(schema.supplierPlanSyncLog)
    .where(eq(schema.supplierPlanSyncLog.supplierId, id))
    .orderBy(desc(schema.supplierPlanSyncLog.startedAt))
    .limit(20);

  return c.json({
    supplier: rowToSupplier(row),
    sync_logs: logRows.map(rowToSyncLog),
  });
});

// ────────────────────────────────────────────────────────────────────────
// CREATE
// ────────────────────────────────────────────────────────────────────────
suppliersRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = supplierCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();

  // Surface the unique-code collision as a 409 rather than a generic 500
  // — admin form needs to render a friendly message.
  const [existing] = await db
    .select({ id: schema.supplier.id })
    .from(schema.supplier)
    .where(eq(schema.supplier.code, parsed.data.code))
    .limit(1);
  if (existing) {
    return c.json({ error: "code_conflict" }, 409);
  }

  const [row] = await db
    .insert(schema.supplier)
    .values({
      code: parsed.data.code,
      displayName: parsed.data.display_name,
      status: parsed.data.status,
      integrationType: parsed.data.integration_type,
      defaultCurrency: parsed.data.default_currency,
      contact: parsed.data.contact,
      credentialsRef: parsed.data.credentials_ref ?? null,
    })
    .returning();

  const supplier = rowToSupplier(row!);

  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "supplier.create",
    targetType: "supplier",
    targetId: supplier.id,
    before: null,
    after: supplier as unknown as Record<string, unknown>,
  });

  return c.json({ supplier }, 201);
});

// ────────────────────────────────────────────────────────────────────────
// UPDATE (no code change; status changes go through /pause)
// ────────────────────────────────────────────────────────────────────────
suppliersRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = supplierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.supplier)
    .where(eq(schema.supplier.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const before = rowToSupplier(existing);

  const patch: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.display_name !== undefined) patch.displayName = d.display_name;
  if (d.status !== undefined) patch.status = d.status;
  if (d.integration_type !== undefined)
    patch.integrationType = d.integration_type;
  if (d.default_currency !== undefined)
    patch.defaultCurrency = d.default_currency;
  if (d.contact !== undefined) patch.contact = d.contact;
  if (d.credentials_ref !== undefined)
    patch.credentialsRef = d.credentials_ref ?? null;
  patch.updatedAt = new Date();

  const [row] = await db
    .update(schema.supplier)
    .set(patch)
    .where(eq(schema.supplier.id, id))
    .returning();

  const after = rowToSupplier(row!);

  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "supplier.update",
    targetType: "supplier",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return c.json({ supplier: after });
});

// ────────────────────────────────────────────────────────────────────────
// PAUSE / RESUME
// ────────────────────────────────────────────────────────────────────────
suppliersRouter.post("/:id/pause", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = supplierPauseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.supplier)
    .where(eq(schema.supplier.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);

  // Terminated is a one-way ladder; refuse to bounce it back through the
  // pause endpoint. UI never offers the action either.
  if (existing.status === "terminated") {
    return c.json({ error: "supplier_terminated" }, 409);
  }

  const before = rowToSupplier(existing);

  const [row] = await db
    .update(schema.supplier)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(schema.supplier.id, id))
    .returning();

  const after = rowToSupplier(row!);

  await recordAudit(db, {
    actor: actorFromContext(c),
    action: parsed.data.status === "paused" ? "supplier.pause" : "supplier.resume",
    targetType: "supplier",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return c.json({ supplier: after });
});
