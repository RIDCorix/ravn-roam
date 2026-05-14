import { describe, expect, test, vi } from "vitest";

import type { RawPlan, SupplierAdapter } from "../suppliers/adapter.js";
import { InMemorySyncRepository } from "./in-memory-sync-repository.js";
import {
  computePlanContentHash,
  runSupplierPlanSync,
  SyncRunFailedError,
} from "./supplier-plan-sync.js";

const SUPPLIER_CODE = "fastmove";

function basePlan(overrides: Partial<RawPlan> = {}): RawPlan {
  return {
    externalId: "WM-JP-7D",
    name: "Japan 7-day 3GB",
    destinations: ["JP"],
    networkOperators: {},
    dataAmountMb: 3072,
    validityDays: 7,
    activationPolicy: "on_first_use",
    deliveryModel: "redemption_required",
    costAmount: "390",
    costCurrency: "TWD",
    available: true,
    inventoryHint: null,
    rawPayload: { wmproductId: "WM-JP-7D", productPrice: 390 },
    ...overrides,
  };
}

function stubAdapter(plans: RawPlan[]): SupplierAdapter {
  return {
    code: SUPPLIER_CODE,
    listPlans(): AsyncIterable<RawPlan> {
      async function* gen(): AsyncIterable<RawPlan> {
        for (const plan of plans) yield plan;
      }
      return gen();
    },
    async getPlan(externalId) {
      return plans.find((p) => p.externalId === externalId) ?? null;
    },
  };
}

describe("computePlanContentHash", () => {
  test("is stable across key order of networkOperators / rawPayload", () => {
    const a = basePlan({
      networkOperators: { JP: { name: "Docomo" } as Record<string, unknown> },
    });
    // Same logical content, different key insertion order.
    const b = basePlan({
      networkOperators: { JP: { name: "Docomo" } as Record<string, unknown> },
      // rawPayload changing shape must NOT affect the hash — it's excluded
      // from the canonicalisation deliberately.
      rawPayload: { productPrice: 390, wmproductId: "WM-JP-7D", extra: 1 },
    });
    expect(computePlanContentHash(a)).toBe(computePlanContentHash(b));
  });

  test("changes when a normalised field changes", () => {
    const a = basePlan();
    const b = basePlan({ dataAmountMb: 5120 });
    expect(computePlanContentHash(a)).not.toBe(computePlanContentHash(b));
  });

  test("is destination-order-insensitive", () => {
    const a = basePlan({ destinations: ["JP", "KR", "TW"] });
    const b = basePlan({ destinations: ["TW", "KR", "JP"] });
    expect(computePlanContentHash(a)).toBe(computePlanContentHash(b));
  });
});

describe("runSupplierPlanSync — first run (acceptance #1)", () => {
  test("inserts every plan from the adapter exactly once", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);

    const plans = [
      basePlan({ externalId: "WM-JP-7D" }),
      basePlan({ externalId: "WM-KR-7D", destinations: ["KR"] }),
      basePlan({ externalId: "WM-TW-7D", destinations: ["TW"] }),
    ];

    const result = await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter(plans),
      repository: repo,
      trigger: "cron",
    });

    expect(result.status).toBe("success");
    expect(result.summary.plansFetched).toBe(3);
    expect(result.summary.inserted).toBe(3);
    expect(result.summary.updated).toBe(0);
    expect(result.summary.unchanged).toBe(0);
    expect(repo.plans).toHaveLength(3);
    expect(repo.logs).toHaveLength(1);
    expect(repo.logs[0]?.status).toBe("success");
    expect(repo.logs[0]?.trigger).toBe("cron");
  });
});

describe("runSupplierPlanSync — second run (acceptance #2)", () => {
  test("identical plans leave updated_at untouched (only last_synced_at bumps)", async () => {
    const repo = new InMemorySyncRepository();
    const supplierId = repo.seedSupplier(SUPPLIER_CODE);

    const plan = basePlan();
    const seededAt = new Date("2026-01-01T00:00:00Z");
    repo.seedPlan({
      supplierId,
      plan,
      contentHash: computePlanContentHash(plan),
      createdAt: seededAt,
      updatedAt: seededAt,
      lastSyncedAt: seededAt,
    });

    const now = new Date("2026-05-14T03:00:00Z");
    const result = await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([plan]),
      repository: repo,
      trigger: "cron",
      now: () => now,
    });

    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.inserted).toBe(0);
    expect(result.summary.updated).toBe(0);

    const row = repo.plans[0];
    expect(row).toBeDefined();
    // updated_at MUST NOT move when content is unchanged — that's the
    // whole acceptance criterion. last_synced_at MAY move (and does).
    expect(row!.updatedAt).toEqual(seededAt);
    expect(row!.lastSyncedAt).toEqual(now);
  });

  test("content change bumps updated_at and increments `updated` counter", async () => {
    const repo = new InMemorySyncRepository();
    const supplierId = repo.seedSupplier(SUPPLIER_CODE);

    const before = basePlan({ costAmount: "390" });
    const seededAt = new Date("2026-01-01T00:00:00Z");
    repo.seedPlan({
      supplierId,
      plan: before,
      contentHash: computePlanContentHash(before),
      createdAt: seededAt,
      updatedAt: seededAt,
    });

    const after = basePlan({ costAmount: "420" }); // upstream price bump
    const now = new Date("2026-05-14T03:00:00Z");
    const result = await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([after]),
      repository: repo,
      trigger: "cron",
      now: () => now,
    });

    expect(result.summary.updated).toBe(1);
    expect(result.summary.unchanged).toBe(0);
    expect(repo.plans[0]?.updatedAt).toEqual(now);
    expect(repo.plans[0]?.plan.costAmount).toBe("420");
  });
});

describe("runSupplierPlanSync — disappearance (acceptance #3)", () => {
  test("plans missing from the adapter feed flip available=false but are not deleted", async () => {
    const repo = new InMemorySyncRepository();
    const supplierId = repo.seedSupplier(SUPPLIER_CODE);

    const kept = basePlan({ externalId: "WM-JP-7D" });
    const retired = basePlan({ externalId: "WM-OLD-30D", available: true });
    const seededAt = new Date("2026-01-01T00:00:00Z");
    for (const plan of [kept, retired]) {
      repo.seedPlan({
        supplierId,
        plan,
        contentHash: computePlanContentHash(plan),
        createdAt: seededAt,
        updatedAt: seededAt,
      });
    }

    const now = new Date("2026-05-14T03:00:00Z");
    const result = await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([kept]), // retired is gone
      repository: repo,
      trigger: "cron",
      now: () => now,
    });

    expect(result.summary.markedUnavailable).toBe(1);
    expect(repo.plans).toHaveLength(2); // not deleted

    const retiredRow = repo.plans.find(
      (p) => p.plan.externalId === "WM-OLD-30D",
    );
    expect(retiredRow?.plan.available).toBe(false);
    expect(retiredRow?.updatedAt).toEqual(now); // availability flip == content change
  });
});

describe("runSupplierPlanSync — availability-change hook (sold_out recompute wiring)", () => {
  test("fires onAvailabilityChanged with the flipped plan ids", async () => {
    const repo = new InMemorySyncRepository();
    const supplierId = repo.seedSupplier(SUPPLIER_CODE);

    const plan = basePlan();
    repo.seedPlan({
      supplierId,
      plan,
      contentHash: computePlanContentHash(plan),
    });

    const onAvailabilityChanged = vi.fn();
    await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([]), // upstream has retired everything
      repository: repo,
      trigger: "cron",
      onAvailabilityChanged,
    });

    expect(onAvailabilityChanged).toHaveBeenCalledTimes(1);
    const [calledWith] = onAvailabilityChanged.mock.calls[0]!;
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0]).toBe(repo.plans[0]?.id);
  });

  test("does not fire when nothing changed (cron heartbeat case)", async () => {
    const repo = new InMemorySyncRepository();
    const supplierId = repo.seedSupplier(SUPPLIER_CODE);

    const plan = basePlan();
    repo.seedPlan({
      supplierId,
      plan,
      contentHash: computePlanContentHash(plan),
    });

    const onAvailabilityChanged = vi.fn();
    await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([plan]),
      repository: repo,
      trigger: "cron",
      onAvailabilityChanged,
    });

    expect(onAvailabilityChanged).not.toHaveBeenCalled();
  });

  test("hook errors do not fail the sync (success log still written)", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runSupplierPlanSync({
      supplierCode: SUPPLIER_CODE,
      adapter: stubAdapter([basePlan({ available: false })]),
      repository: repo,
      trigger: "cron",
      onAvailabilityChanged: () => {
        throw new Error("subscriber bug");
      },
    });

    expect(result.status).toBe("success");
    expect(repo.logs[0]?.status).toBe("success");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("runSupplierPlanSync — failure paths", () => {
  test("adapter throw is captured in the sync log as `failed`", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);

    const adapter: SupplierAdapter = {
      code: SUPPLIER_CODE,
      listPlans(): AsyncIterable<RawPlan> {
        async function* gen(): AsyncIterable<RawPlan> {
          throw new Error("upstream 503");
        }
        return gen();
      },
      async getPlan() {
        return null;
      },
    };

    await expect(
      runSupplierPlanSync({
        supplierCode: SUPPLIER_CODE,
        adapter,
        repository: repo,
        trigger: "cron",
      }),
    ).rejects.toBeInstanceOf(SyncRunFailedError);

    expect(repo.logs).toHaveLength(1);
    expect(repo.logs[0]?.status).toBe("failed");
    expect(repo.logs[0]?.errorMessage).toBe("upstream 503");
  });

  test("unknown supplier code throws before any DB writes", async () => {
    const repo = new InMemorySyncRepository();
    // Note: no seedSupplier call.

    await expect(
      runSupplierPlanSync({
        supplierCode: SUPPLIER_CODE,
        adapter: stubAdapter([basePlan()]),
        repository: repo,
        trigger: "cron",
      }),
    ).rejects.toThrow(/no supplier row/);

    expect(repo.plans).toHaveLength(0);
    expect(repo.logs).toHaveLength(0);
  });

  test("adapter.code / supplierCode mismatch is a programming error", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier("airalo");

    await expect(
      runSupplierPlanSync({
        supplierCode: "airalo",
        adapter: stubAdapter([basePlan()]), // adapter.code === 'fastmove'
        repository: repo,
        trigger: "cron",
      }),
    ).rejects.toThrow(/does not match/);
  });
});
