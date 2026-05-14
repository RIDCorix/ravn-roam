/**
 * In-memory {@link SyncRepository} for unit tests.
 *
 * Lives in `src/` instead of `test-utils/` so the orchestrator test and any
 * future test that wants to drive the sync end-to-end can import it without
 * a path-alias dance. NOT used in production paths — the orchestrator
 * pulls `DrizzleSyncRepository` in production.
 *
 * The implementation mirrors the Drizzle one's observable behaviour:
 *   - `unchanged` rows have `updated_at` untouched and `last_synced_at`
 *     bumped
 *   - `markPlansUnavailable` flips `available=false` AND bumps
 *     `updated_at` (because the row content effectively changed)
 *   - insertSyncLog gives back a stable id so test assertions can read it
 *     back from `logs`
 */

import { randomUUID } from "node:crypto";

import type { RawPlan } from "../suppliers/adapter.js";
import type {
  ExistingPlanRow,
  SyncRepository,
  SyncStatus,
  SyncSummary,
  SyncTrigger,
} from "./supplier-plan-sync.js";

interface InternalPlanRow {
  id: string;
  supplierId: string;
  plan: RawPlan;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

interface InternalSyncLog {
  id: string;
  supplierId: string;
  trigger: SyncTrigger;
  triggeredBy: string | null;
  startedAt: Date;
  finishedAt: Date;
  status: SyncStatus;
  summary: SyncSummary;
  errorMessage: string | null;
  planCount: number | null;
}

export class InMemorySyncRepository implements SyncRepository {
  private readonly suppliers = new Map<string, string>(); // code → id
  readonly plans: InternalPlanRow[] = [];
  readonly logs: InternalSyncLog[] = [];

  seedSupplier(code: string, id?: string): string {
    const supplierId = id ?? randomUUID();
    this.suppliers.set(code, supplierId);
    return supplierId;
  }

  /**
   * Force-insert a plan as if it pre-existed (no sync run). Useful for
   * "second-run" tests that want a known-state catalogue going in.
   */
  seedPlan(input: {
    supplierId: string;
    plan: RawPlan;
    contentHash: string;
    createdAt?: Date;
    updatedAt?: Date;
    lastSyncedAt?: Date;
  }): InternalPlanRow {
    const now = new Date();
    const row: InternalPlanRow = {
      id: randomUUID(),
      supplierId: input.supplierId,
      plan: { ...input.plan, rawPayload: { ...input.plan.rawPayload } },
      contentHash: input.contentHash,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      lastSyncedAt: input.lastSyncedAt ?? now,
    };
    this.plans.push(row);
    return row;
  }

  async getSupplierIdByCode(code: string): Promise<string | null> {
    return this.suppliers.get(code) ?? null;
  }

  async listExistingPlans(supplierId: string): Promise<ExistingPlanRow[]> {
    return this.plans
      .filter((p) => p.supplierId === supplierId)
      .map((p) => ({
        id: p.id,
        externalId: p.plan.externalId,
        available: p.plan.available,
        contentHash: p.contentHash,
      }));
  }

  async insertPlan(input: {
    supplierId: string;
    plan: RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<{ id: string }> {
    const row: InternalPlanRow = {
      id: randomUUID(),
      supplierId: input.supplierId,
      plan: { ...input.plan, rawPayload: { ...input.plan.rawPayload } },
      contentHash: input.contentHash,
      createdAt: input.syncedAt,
      updatedAt: input.syncedAt,
      lastSyncedAt: input.syncedAt,
    };
    this.plans.push(row);
    return { id: row.id };
  }

  async updatePlan(input: {
    id: string;
    plan: RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<void> {
    const row = this.plans.find((p) => p.id === input.id);
    if (!row) throw new Error(`updatePlan: no plan with id ${input.id}`);
    row.plan = { ...input.plan, rawPayload: { ...input.plan.rawPayload } };
    row.contentHash = input.contentHash;
    row.updatedAt = input.syncedAt;
    row.lastSyncedAt = input.syncedAt;
  }

  async touchLastSynced(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void> {
    for (const id of input.ids) {
      const row = this.plans.find((p) => p.id === id);
      if (row) row.lastSyncedAt = input.syncedAt;
    }
  }

  async markPlansUnavailable(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void> {
    for (const id of input.ids) {
      const row = this.plans.find((p) => p.id === id);
      if (row && row.plan.available) {
        row.plan = { ...row.plan, available: false };
        row.updatedAt = input.syncedAt;
        row.lastSyncedAt = input.syncedAt;
      }
    }
  }

  async insertSyncLog(input: Omit<InternalSyncLog, "id">): Promise<{ id: string }> {
    const log: InternalSyncLog = { ...input, id: randomUUID() };
    this.logs.push(log);
    return { id: log.id };
  }
}
