/**
 * Drizzle-backed {@link SyncRepository}. Thin — no orchestration logic, no
 * adapter calls. The orchestrator (`./supplier-plan-sync.ts`) owns the
 * decision tree; this file only translates those decisions into SQL.
 *
 * Why a custom hash column instead of letting Postgres compute one:
 *   we need the hash to be byte-identical to what the in-memory test repo
 *   produces, otherwise the "unchanged plan does not bump updated_at"
 *   property only holds in production and quietly regresses in unit tests.
 *   Computing in JS keeps the contract single-sourced in
 *   `computePlanContentHash`.
 *
 * The hash lives inside `raw_payload.__content_hash` — chosen to avoid a
 * second migration on every iteration of the sync logic. `raw_payload` is
 * already a free-form jsonb owned by the sync job (see
 * services/api/src/db/schema/supplier-plan.ts), so reusing it is a Phase-2
 * tactical move; if the hash becomes load-bearing for anything beyond
 * sync, lift it into a real column.
 */

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  supplier,
  supplierPlan,
  supplierPlanSyncLog,
} from "../db/schema/index.js";
import type { Db } from "../db/client.js";
import type {
  ExistingPlanRow,
  SyncRepository,
  SyncStatus,
  SyncSummary,
  SyncTrigger,
} from "./supplier-plan-sync.js";

const HASH_KEY = "__content_hash";

export class DrizzleSyncRepository implements SyncRepository {
  constructor(private readonly db: Db) {}

  async getSupplierIdByCode(code: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.code, code))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async listExistingPlans(supplierId: string): Promise<ExistingPlanRow[]> {
    const rows = await this.db
      .select({
        id: supplierPlan.id,
        externalId: supplierPlan.externalId,
        available: supplierPlan.available,
        rawPayload: supplierPlan.rawPayload,
      })
      .from(supplierPlan)
      .where(eq(supplierPlan.supplierId, supplierId));
    return rows.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      available: row.available,
      contentHash: readHash(row.rawPayload),
    }));
  }

  async insertPlan(input: {
    supplierId: string;
    plan: import("../suppliers/adapter.js").RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<{ id: string }> {
    const rows = await this.db
      .insert(supplierPlan)
      .values({
        supplierId: input.supplierId,
        externalId: input.plan.externalId,
        name: input.plan.name,
        destinations: input.plan.destinations,
        networkOperators: input.plan.networkOperators,
        dataAmountMb: input.plan.dataAmountMb,
        validityDays: input.plan.validityDays,
        activationPolicy: input.plan.activationPolicy,
        deliveryModel: input.plan.deliveryModel,
        costAmount: input.plan.costAmount,
        costCurrency: input.plan.costCurrency,
        available: input.plan.available,
        inventoryHint: input.plan.inventoryHint,
        rawPayload: withHash(input.plan.rawPayload, input.contentHash),
        lastSyncedAt: input.syncedAt,
      })
      .returning({ id: supplierPlan.id });
    const id = rows[0]?.id;
    if (!id) throw new Error("insertPlan: no id returned from RETURNING");
    return { id };
  }

  async updatePlan(input: {
    id: string;
    plan: import("../suppliers/adapter.js").RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<void> {
    await this.db
      .update(supplierPlan)
      .set({
        name: input.plan.name,
        destinations: input.plan.destinations,
        networkOperators: input.plan.networkOperators,
        dataAmountMb: input.plan.dataAmountMb,
        validityDays: input.plan.validityDays,
        activationPolicy: input.plan.activationPolicy,
        deliveryModel: input.plan.deliveryModel,
        costAmount: input.plan.costAmount,
        costCurrency: input.plan.costCurrency,
        available: input.plan.available,
        inventoryHint: input.plan.inventoryHint,
        rawPayload: withHash(input.plan.rawPayload, input.contentHash),
        lastSyncedAt: input.syncedAt,
        updatedAt: input.syncedAt,
      })
      .where(eq(supplierPlan.id, input.id));
  }

  async touchLastSynced(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void> {
    if (input.ids.length === 0) return;
    // Bumping `last_synced_at` alone — NOT `updated_at`. That's the whole
    // point of the unchanged-plan code path.
    await this.db
      .update(supplierPlan)
      .set({ lastSyncedAt: input.syncedAt })
      .where(inArray(supplierPlan.id, input.ids));
  }

  async markPlansUnavailable(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void> {
    if (input.ids.length === 0) return;
    await this.db
      .update(supplierPlan)
      .set({
        available: false,
        lastSyncedAt: input.syncedAt,
        updatedAt: input.syncedAt,
      })
      .where(
        and(inArray(supplierPlan.id, input.ids), eq(supplierPlan.available, true)),
      );
  }

  async insertSyncLog(input: {
    supplierId: string;
    trigger: SyncTrigger;
    triggeredBy: string | null;
    startedAt: Date;
    finishedAt: Date;
    status: SyncStatus;
    summary: SyncSummary;
    errorMessage: string | null;
    planCount: number | null;
  }): Promise<{ id: string }> {
    const rows = await this.db
      .insert(supplierPlanSyncLog)
      .values({
        supplierId: input.supplierId,
        trigger: input.trigger,
        triggeredBy: input.triggeredBy,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        status: input.status,
        summary: input.summary as unknown as Record<string, unknown>,
        errorMessage: input.errorMessage,
        planCount: input.planCount,
      })
      .returning({ id: supplierPlanSyncLog.id });
    const id = rows[0]?.id;
    if (!id) throw new Error("insertSyncLog: no id returned from RETURNING");
    return { id };
  }

  /**
   * Admin UI "list recent syncs for supplier X". Sibling read used by the
   * admin endpoint. Kept here so the SQL stays next to the writers.
   */
  async listRecentSyncLogs(input: {
    supplierId: string;
    limit: number;
  }): Promise<Array<typeof supplierPlanSyncLog.$inferSelect>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    return this.db
      .select()
      .from(supplierPlanSyncLog)
      .where(eq(supplierPlanSyncLog.supplierId, input.supplierId))
      .orderBy(sql`${supplierPlanSyncLog.startedAt} DESC`)
      .limit(limit);
  }
}

function readHash(rawPayload: unknown): string | null {
  if (
    rawPayload &&
    typeof rawPayload === "object" &&
    !Array.isArray(rawPayload)
  ) {
    const value = (rawPayload as Record<string, unknown>)[HASH_KEY];
    return typeof value === "string" ? value : null;
  }
  return null;
}

function withHash(
  rawPayload: Record<string, unknown>,
  hash: string,
): Record<string, unknown> {
  return { ...rawPayload, [HASH_KEY]: hash };
}
