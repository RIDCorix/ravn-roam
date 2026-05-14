/**
 * Admin route tests. We mount `createAdminRouter` against an in-memory
 * repository + a stub adapter — no DB, no network. The point is to lock
 * in the auth check + the orchestrator wiring, not to re-test the
 * orchestrator (that's in `../jobs/supplier-plan-sync.test.ts`).
 */

import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import type { RawPlan, SupplierAdapter } from "../suppliers/adapter.js";
import { AdapterRegistry } from "../suppliers/adapter.js";
import { InMemorySyncRepository } from "../jobs/in-memory-sync-repository.js";
import type { DrizzleSyncRepository } from "../jobs/drizzle-sync-repository.js";
import { createAdminRouter } from "./admin.js";

const TOKEN = "test-token-1234567890abcdef";
const SUPPLIER_CODE = "fastmove";

function planFixture(externalId: string): RawPlan {
  return {
    externalId,
    name: `Plan ${externalId}`,
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
    rawPayload: { wmproductId: externalId },
  };
}

function stubAdapter(plans: RawPlan[]): SupplierAdapter {
  return {
    code: SUPPLIER_CODE,
    listPlans(): AsyncIterable<RawPlan> {
      async function* gen(): AsyncIterable<RawPlan> {
        for (const p of plans) yield p;
      }
      return gen();
    },
    async getPlan(externalId) {
      return plans.find((p) => p.externalId === externalId) ?? null;
    },
  };
}

/**
 * Adapt the in-memory orchestrator repo to the admin router's wider
 * `DrizzleSyncRepository` shape by tacking on the read-only
 * `listRecentSyncLogs` the GET endpoint needs.
 */
function asAdminRepo(repo: InMemorySyncRepository): DrizzleSyncRepository {
  const listRecentSyncLogs: DrizzleSyncRepository["listRecentSyncLogs"] =
    async ({ supplierId, limit }) => {
      const clamped = Math.min(Math.max(limit, 1), 200);
      return repo.logs
        .filter((l) => l.supplierId === supplierId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, clamped) as unknown as Awaited<
        ReturnType<DrizzleSyncRepository["listRecentSyncLogs"]>
      >;
    };
  return Object.assign(repo, {
    listRecentSyncLogs,
  }) as unknown as DrizzleSyncRepository;
}

function buildApp(opts: {
  adapter: SupplierAdapter;
  repo: InMemorySyncRepository;
  token?: string | null;
}): Hono {
  const registry = new AdapterRegistry();
  registry.register(opts.adapter);
  const adminRepo = asAdminRepo(opts.repo);

  const adminRouter = createAdminRouter({
    buildRegistry: () => registry,
    buildRepository: () => adminRepo,
    adminToken: opts.token === undefined ? TOKEN : opts.token,
  });

  const app = new Hono();
  app.route("/", adminRouter);
  return app;
}

describe("createAdminRouter — auth", () => {
  test("rejects requests without x-admin-token (401)", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({ adapter: stubAdapter([planFixture("WM-1")]), repo });

    const res = await app.request(`/admin/suppliers/${SUPPLIER_CODE}/sync`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("rejects requests with a wrong token (401)", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({ adapter: stubAdapter([planFixture("WM-1")]), repo });

    const res = await app.request(`/admin/suppliers/${SUPPLIER_CODE}/sync`, {
      method: "POST",
      headers: { "x-admin-token": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  test("returns 503 when ADMIN_API_TOKEN is not configured", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({
      adapter: stubAdapter([planFixture("WM-1")]),
      repo,
      token: null,
    });

    const res = await app.request(`/admin/suppliers/${SUPPLIER_CODE}/sync`, {
      method: "POST",
      headers: { "x-admin-token": "anything" },
    });
    expect(res.status).toBe(503);
  });
});

describe("createAdminRouter — POST /admin/suppliers/:code/sync", () => {
  test("runs the sync and records the admin trigger in the log", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({
      adapter: stubAdapter([planFixture("WM-1"), planFixture("WM-2")]),
      repo,
    });

    const res = await app.request(`/admin/suppliers/${SUPPLIER_CODE}/sync`, {
      method: "POST",
      headers: {
        "x-admin-token": TOKEN,
        "x-admin-user": "ridcorix",
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      summary: { inserted: number; plansFetched: number };
    };
    expect(body.ok).toBe(true);
    expect(body.summary.inserted).toBe(2);
    expect(body.summary.plansFetched).toBe(2);

    expect(repo.logs).toHaveLength(1);
    expect(repo.logs[0]?.trigger).toBe("admin");
    expect(repo.logs[0]?.triggeredBy).toBe("ridcorix");
  });

  test("returns 404 when adapter code is unknown", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({
      adapter: stubAdapter([planFixture("WM-1")]),
      repo,
    });

    const res = await app.request(`/admin/suppliers/unknown/sync`, {
      method: "POST",
      headers: { "x-admin-token": TOKEN },
    });
    expect(res.status).toBe(404);
  });
});

describe("createAdminRouter — GET /admin/suppliers/:code/sync-logs", () => {
  test("returns logs for the supplier (admin UI list view)", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({
      adapter: stubAdapter([planFixture("WM-1")]),
      repo,
    });

    const syncRes = await app.request(
      `/admin/suppliers/${SUPPLIER_CODE}/sync`,
      {
        method: "POST",
        headers: { "x-admin-token": TOKEN },
      },
    );
    expect(syncRes.status).toBe(200);

    const listRes = await app.request(
      `/admin/suppliers/${SUPPLIER_CODE}/sync-logs?limit=10`,
      { headers: { "x-admin-token": TOKEN } },
    );
    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as {
      supplierCode: string;
      logs: Array<{ trigger: string }>;
    };
    expect(body.supplierCode).toBe(SUPPLIER_CODE);
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
    expect(body.logs[0]?.trigger).toBe("admin");
  });

  test("returns 404 for unknown supplier", async () => {
    const repo = new InMemorySyncRepository();
    repo.seedSupplier(SUPPLIER_CODE);
    const app = buildApp({
      adapter: stubAdapter([planFixture("WM-1")]),
      repo,
    });

    const res = await app.request("/admin/suppliers/airalo/sync-logs", {
      headers: { "x-admin-token": TOKEN },
    });
    expect(res.status).toBe(404);
  });
});
