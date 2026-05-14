/**
 * Supplier plan sync orchestrator — Phase 2 §9.2 (Catalog Architecture).
 *
 * One pass = drain `adapter.listPlans()`, diff against the existing
 * `supplier_plan` rows for that supplier, write only what changed, mark
 * upstream-disappeared plans `available=false` (never delete), and append
 * a row to `supplier_plan_sync_log`.
 *
 * Pure orchestrator. All I/O goes through {@link SyncRepository} so this
 * layer is exercised by unit tests with an in-memory repo — the Drizzle
 * implementation lives next door in `./drizzle-sync-repository.ts`.
 *
 * "Unchanged plan does not bump updated_at" is the load-bearing property
 * (ROA-58 acceptance #2). We achieve it by computing a deterministic SHA-1
 * over the writable fields, comparing against the prior hash on file, and
 * skipping the row entirely when they match.
 */

import { createHash } from "node:crypto";

import type { RawPlan, SupplierAdapter } from "../suppliers/adapter.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SyncTrigger = "cron" | "admin" | "system";
export type SyncStatus = "success" | "partial" | "failed";

/**
 * Identity columns the orchestrator needs to know about. The Drizzle
 * implementation pulls these straight from `supplier_plan`; tests fabricate
 * them in-memory.
 */
export interface ExistingPlanRow {
  id: string;
  externalId: string;
  available: boolean;
  /** Content hash from the last sync, or `null` for rows pre-dating this job. */
  contentHash: string | null;
}

export interface SyncRepository {
  /** Resolves to `null` when the supplier code is unknown. */
  getSupplierIdByCode(code: string): Promise<string | null>;

  /** Returns every existing plan for the supplier, keyed by `externalId`. */
  listExistingPlans(supplierId: string): Promise<ExistingPlanRow[]>;

  /**
   * Insert a new plan row. Implementation must set `contentHash` so the
   * next run can short-circuit.
   */
  insertPlan(input: {
    supplierId: string;
    plan: RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<{ id: string }>;

  /**
   * Update an existing plan. Caller has already determined that
   * `contentHash` differs from the on-file value — implementation should
   * always write (no further short-circuit).
   */
  updatePlan(input: {
    id: string;
    plan: RawPlan;
    contentHash: string;
    syncedAt: Date;
  }): Promise<void>;

  /**
   * Bump `last_synced_at` without touching any other column. Used for
   * unchanged rows so we can still answer "when did we last verify this
   * plan was still in the upstream catalogue" — distinct from
   * `updated_at`, which stays put when content is unchanged.
   */
  touchLastSynced(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void>;

  /** Flip `available=false` on plans that vanished upstream; never delete. */
  markPlansUnavailable(input: {
    ids: string[];
    syncedAt: Date;
  }): Promise<void>;

  insertSyncLog(input: {
    supplierId: string;
    trigger: SyncTrigger;
    triggeredBy: string | null;
    startedAt: Date;
    finishedAt: Date;
    status: SyncStatus;
    summary: SyncSummary;
    errorMessage: string | null;
    planCount: number | null;
  }): Promise<{ id: string }>;
}

export interface SyncSummary {
  plansFetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  markedUnavailable: number;
  restoredAvailable: number;
  durationMs: number;
}

export interface SyncRunInput {
  supplierCode: string;
  adapter: SupplierAdapter;
  repository: SyncRepository;
  trigger: SyncTrigger;
  /** Free-form label written to the log (e.g. admin display name). */
  triggeredBy?: string | null;
  /**
   * Called after the sync writes commit, with every plan id whose
   * `available` flag changed direction this run. Phase 4 / 5 read-model
   * subscribers (sold_out recompute) hang off this. Errors here do NOT
   * fail the sync — they're swallowed and logged so a downstream bug
   * cannot wedge the catalogue refresh.
   */
  onAvailabilityChanged?: (planIds: string[]) => void | Promise<void>;
  /** Override the clock for tests. */
  now?: () => Date;
}

export interface SyncRunResult {
  status: SyncStatus;
  summary: SyncSummary;
  logId: string;
  /** Plans whose `available` flipped this run. Useful for callers that want
   *  the list synchronously instead of via the `onAvailabilityChanged` hook
   *  (the hook fires regardless). */
  availabilityChangedPlanIds: string[];
}

export class SyncRunFailedError extends Error {
  override readonly name = "SyncRunFailedError";
  constructor(message: string, public readonly logId: string | null) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

/**
 * Stable SHA-1 over the writable fields of a `RawPlan`. Stable means: two
 * RawPlans that round-trip to the same Postgres row hash equal, regardless
 * of upstream-JSON key ordering.
 *
 * We deliberately exclude `rawPayload`. The payload is an audit copy — it
 * may legitimately add new keys upstream without any of the normalised
 * fields changing, and we don't want that to count as "content changed"
 * (which would bump `updated_at` and noise up downstream subscribers).
 *
 * Exported for tests + the Drizzle repository (which needs to recompute
 * the hash for rows mid-flight).
 */
export function computePlanContentHash(plan: RawPlan): string {
  const canonical = canonicalise({
    name: plan.name,
    destinations: [...plan.destinations].sort(),
    networkOperators: plan.networkOperators,
    dataAmountMb: plan.dataAmountMb,
    validityDays: plan.validityDays,
    activationPolicy: plan.activationPolicy,
    deliveryModel: plan.deliveryModel,
    costAmount: plan.costAmount,
    costCurrency: plan.costCurrency,
    available: plan.available,
    inventoryHint: plan.inventoryHint,
  });
  return createHash("sha1").update(canonical, "utf8").digest("hex");
}

/** Recursive JSON.stringify with sorted object keys. */
function canonicalise(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalise(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalise(obj[k])}`);
    return `{${body.join(",")}}`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot canonicalise non-finite number: ${value}`);
    }
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runSupplierPlanSync(
  input: SyncRunInput,
): Promise<SyncRunResult> {
  const {
    supplierCode,
    adapter,
    repository,
    trigger,
    triggeredBy = null,
    onAvailabilityChanged,
    now = () => new Date(),
  } = input;

  if (adapter.code !== supplierCode) {
    throw new Error(
      `adapter code "${adapter.code}" does not match supplierCode "${supplierCode}"`,
    );
  }

  const startedAt = now();
  const supplierId = await repository.getSupplierIdByCode(supplierCode);
  if (!supplierId) {
    throw new Error(
      `no supplier row for code "${supplierCode}" — seed it before running sync`,
    );
  }

  try {
    const existing = await repository.listExistingPlans(supplierId);
    const existingByExternalId = new Map<string, ExistingPlanRow>(
      existing.map((row) => [row.externalId, row]),
    );

    let plansFetched = 0;
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let restoredAvailable = 0;
    const seenExternalIds = new Set<string>();
    const availabilityChangedPlanIds: string[] = [];
    const unchangedIds: string[] = [];

    for await (const plan of adapter.listPlans()) {
      plansFetched += 1;
      seenExternalIds.add(plan.externalId);
      const hash = computePlanContentHash(plan);
      const prior = existingByExternalId.get(plan.externalId);

      if (!prior) {
        const { id } = await repository.insertPlan({
          supplierId,
          plan,
          contentHash: hash,
          syncedAt: startedAt,
        });
        inserted += 1;
        // First-time insert with available=false should also fire the hook
        // so subscribers can immediately mark dependent products sold_out.
        if (!plan.available) availabilityChangedPlanIds.push(id);
        continue;
      }

      if (prior.contentHash === hash) {
        unchanged += 1;
        unchangedIds.push(prior.id);
        continue;
      }

      await repository.updatePlan({
        id: prior.id,
        plan,
        contentHash: hash,
        syncedAt: startedAt,
      });
      updated += 1;
      if (prior.available !== plan.available) {
        availabilityChangedPlanIds.push(prior.id);
        if (!prior.available && plan.available) restoredAvailable += 1;
      }
    }

    // Anything that existed but the adapter did not yield is "disappeared
    // upstream". Mark available=false (never delete) per ROA-58.
    const disappearedIds = existing
      .filter((row) => !seenExternalIds.has(row.externalId) && row.available)
      .map((row) => row.id);

    if (disappearedIds.length > 0) {
      await repository.markPlansUnavailable({
        ids: disappearedIds,
        syncedAt: startedAt,
      });
      availabilityChangedPlanIds.push(...disappearedIds);
    }

    if (unchangedIds.length > 0) {
      await repository.touchLastSynced({
        ids: unchangedIds,
        syncedAt: startedAt,
      });
    }

    const finishedAt = now();
    const summary: SyncSummary = {
      plansFetched,
      inserted,
      updated,
      unchanged,
      markedUnavailable: disappearedIds.length,
      restoredAvailable,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    const { id: logId } = await repository.insertSyncLog({
      supplierId,
      trigger,
      triggeredBy,
      startedAt,
      finishedAt,
      status: "success",
      summary,
      errorMessage: null,
      planCount: plansFetched,
    });

    if (availabilityChangedPlanIds.length > 0 && onAvailabilityChanged) {
      try {
        await onAvailabilityChanged(availabilityChangedPlanIds);
      } catch (err) {
        // Swallow — the catalogue refresh succeeded; a buggy subscriber
        // must not poison the next run.
        console.error(
          "[supplier-plan-sync] onAvailabilityChanged hook threw:",
          err,
        );
      }
    }

    return { status: "success", summary, logId, availabilityChangedPlanIds };
  } catch (err) {
    const finishedAt = now();
    const message = err instanceof Error ? err.message : String(err);
    let logId: string | null = null;
    try {
      const log = await repository.insertSyncLog({
        supplierId,
        trigger,
        triggeredBy,
        startedAt,
        finishedAt,
        status: "failed",
        summary: emptySummary(finishedAt.getTime() - startedAt.getTime()),
        errorMessage: message,
        planCount: null,
      });
      logId = log.id;
    } catch (logErr) {
      console.error(
        "[supplier-plan-sync] failed to write failure log:",
        logErr,
      );
    }
    throw new SyncRunFailedError(message, logId);
  }
}

function emptySummary(durationMs: number): SyncSummary {
  return {
    plansFetched: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    markedUnavailable: 0,
    restoredAvailable: 0,
    durationMs,
  };
}
