// Append-only audit-log writer used by the admin mutation routes (supplier
// CRUD/pause, supplier_plan toggle, manual sync trigger). Actor is the
// verbatim `x-admin-user` header until Phase 3 introduces real auth.

import type { Context } from "hono";

import { auditLog } from "../db/schema/index.js";
import type { Db } from "../db/client.js";

export type AuditAction =
  | "supplier.create"
  | "supplier.update"
  | "supplier.pause"
  | "supplier.resume"
  | "supplier_plan.toggle"
  | "supplier.sync"
  | "vendor.create"
  | "vendor.update"
  | "order.create"
  | "order.pending"
  | "order.paid"
  | "order.fulfilled"
  | "order.cancelled"
  | "order.refunded";

export interface AuditEntry {
  actor: string;
  action: AuditAction;
  targetType: "supplier" | "supplier_plan" | "vendor" | "order";
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export function actorFromContext(c: Context): string {
  return c.req.header("x-admin-user") ?? "anonymous";
}

export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
