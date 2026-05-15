// Admin-facing vendor CRUD (ROA-100 admin redesign).
//
// The vendor table started life in ROA-53 as a placeholder (one row,
// `platform`, to honour the FK on product.owner_vendor_id). ROA-100 widens
// it with tier-1 RBAC + commercial fields so the new /admin/vendors page
// has something real to render — actual auth/membership lands in Phase 3.
//
// Audit and the unauthenticated posture both mirror suppliers.ts.

import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { actorFromContext, recordAudit } from "./audit.js";

export const vendorsRouter = new Hono();

const vendorTierEnum = z.enum(["platform", "tier1", "tier2"]);
const vendorStatusEnum = z.enum(["active", "paused", "terminated"]);
const vendorGradeEnum = z.enum(["A", "B", "C"]);

const vendorCreateSchema = z.object({
  code: z.string().min(1).max(64),
  display_name: z.string().min(1).max(200),
  tier: vendorTierEnum.default("tier1"),
  status: vendorStatusEnum.default("active"),
  grade: vendorGradeEnum.nullish(),
  contact_email: z.string().email().nullish(),
  commission_rate: z.number().min(0).max(1).nullish(),
  contract_terms: z.record(z.unknown()).default({}),
  notes: z.string().nullish(),
});

const vendorUpdateSchema = vendorCreateSchema.partial().omit({ code: true });

type VendorRow = typeof schema.vendor.$inferSelect;

function rowToVendor(row: VendorRow) {
  return {
    id: row.id,
    code: row.code,
    display_name: row.displayName,
    tier: row.tier,
    status: row.status,
    grade: row.grade,
    contact_email: row.contactEmail,
    // Drizzle returns numeric as string to preserve precision; the admin UI
    // wants a number for formatting. Null stays null.
    commission_rate:
      row.commissionRate == null ? null : Number(row.commissionRate),
    contract_terms: row.contractTerms,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// LIST
vendorsRouter.get("/", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const tier = url.searchParams.get("tier");
  const grade = url.searchParams.get("grade");
  const search = url.searchParams.get("q");

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(schema.vendor.status, status as never));
  if (tier) conditions.push(eq(schema.vendor.tier, tier as never));
  if (grade) conditions.push(eq(schema.vendor.grade, grade as never));
  if (search) {
    const like = `%${search}%`;
    const orExpr = or(
      ilike(schema.vendor.code, like),
      ilike(schema.vendor.displayName, like),
    );
    if (orExpr) conditions.push(orExpr as never);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.vendor)
    .where(where)
    .orderBy(asc(schema.vendor.code))
    .limit(200);

  return c.json({ vendors: rows.map(rowToVendor) });
});

// READ
vendorsRouter.get("/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(schema.vendor)
    .where(eq(schema.vendor.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ vendor: rowToVendor(row) });
});

// CREATE
vendorsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = vendorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  const [existing] = await db
    .select({ id: schema.vendor.id })
    .from(schema.vendor)
    .where(eq(schema.vendor.code, parsed.data.code))
    .limit(1);
  if (existing) return c.json({ error: "code_conflict" }, 409);

  const [row] = await db
    .insert(schema.vendor)
    .values({
      code: parsed.data.code,
      displayName: parsed.data.display_name,
      tier: parsed.data.tier,
      status: parsed.data.status,
      grade: parsed.data.grade ?? null,
      contactEmail: parsed.data.contact_email ?? null,
      commissionRate:
        parsed.data.commission_rate == null
          ? null
          : String(parsed.data.commission_rate),
      contractTerms: parsed.data.contract_terms,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  const vendor = rowToVendor(row!);
  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "vendor.create",
    targetType: "vendor",
    targetId: vendor.id,
    before: null,
    after: vendor as unknown as Record<string, unknown>,
  });
  return c.json({ vendor }, 201);
});

// UPDATE
vendorsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = vendorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.vendor)
    .where(eq(schema.vendor.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);
  const before = rowToVendor(existing);

  const patch: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.display_name !== undefined) patch.displayName = d.display_name;
  if (d.tier !== undefined) patch.tier = d.tier;
  if (d.status !== undefined) patch.status = d.status;
  if (d.grade !== undefined) patch.grade = d.grade ?? null;
  if (d.contact_email !== undefined)
    patch.contactEmail = d.contact_email ?? null;
  if (d.commission_rate !== undefined)
    patch.commissionRate =
      d.commission_rate == null ? null : String(d.commission_rate);
  if (d.contract_terms !== undefined) patch.contractTerms = d.contract_terms;
  if (d.notes !== undefined) patch.notes = d.notes ?? null;
  patch.updatedAt = new Date();

  const [row] = await db
    .update(schema.vendor)
    .set(patch)
    .where(eq(schema.vendor.id, id))
    .returning();
  const after = rowToVendor(row!);
  await recordAudit(db, {
    actor: actorFromContext(c),
    action: "vendor.update",
    targetType: "vendor",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });
  return c.json({ vendor: after });
});
