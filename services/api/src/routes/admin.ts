/**
 * Admin routes for supplier-plan sync.
 *
 *   POST /admin/suppliers/:code/sync         — manual trigger (admin UI button)
 *   GET  /admin/suppliers/:code/sync-logs    — recent runs for admin UI list
 *
 * Auth: shared-secret header `x-admin-token` matched against
 * `env.ADMIN_API_TOKEN`. Until the post-Phase 2 auth layer lands, the
 * route returns 503 when the token is unset — that's safer than shipping
 * a no-auth trigger to staging by accident.
 *
 * The HTTP path is intentionally orthogonal to the CLI path
 * (`src/cli/sync-supplier-plans.ts`). Both feed the same orchestrator;
 * they exist as two entry points because cron and a UI button have very
 * different ergonomics — one wants a fresh node process and structured
 * stdout, the other wants an in-process response in the same DB pool.
 */

import { Hono } from "hono";

import { getDb } from "../db/client.js";
import { env } from "../env.js";
import {
  SyncRunFailedError,
  runSupplierPlanSync,
} from "../jobs/index.js";
import { DrizzleSyncRepository } from "../jobs/drizzle-sync-repository.js";
import {
  AdapterRegistry,
  FASTMOVE_CODE,
  FastmoveAdapter,
} from "../suppliers/index.js";
import { recordAudit } from "./audit.js";

/** Just the slice of repository methods the admin routes use. Wider than
 *  the orchestrator's SyncRepository because we also need the read-side
 *  `listRecentSyncLogs` for the GET endpoint. */
export interface AdminRepository
  extends Pick<DrizzleSyncRepository, "getSupplierIdByCode" | "listRecentSyncLogs"> {
  // The orchestrator's SyncRepository methods are reached through
  // `runSupplierPlanSync`, which takes the full interface; the
  // DrizzleSyncRepository implements both shapes, so we just require the
  // class shape here.
}

export interface AdminRouterDeps {
  /** Override for tests. When omitted, deps are pulled from env at request time. */
  buildRegistry?: () => AdapterRegistry;
  /** Override for tests. When omitted, wraps `getDb()` in DrizzleSyncRepository. */
  buildRepository?: () => DrizzleSyncRepository;
  /** Override for tests; defaults to `env.ADMIN_API_TOKEN`. */
  adminToken?: string | null;
  /** Override for tests; defaults to writing through `getDb()`. */
  recordAudit?: (entry: {
    actor: string;
    action: "supplier.sync";
    targetType: "supplier";
    targetId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }) => Promise<void>;
}

export function createAdminRouter(deps: AdminRouterDeps = {}): Hono {
  const router = new Hono();

  const tokenSource =
    deps.adminToken !== undefined ? deps.adminToken : env.ADMIN_API_TOKEN ?? null;
  const buildRepository =
    deps.buildRepository ?? (() => new DrizzleSyncRepository(getDb()));
  const auditWriter =
    deps.recordAudit ??
    (async (entry) => {
      await recordAudit(getDb(), entry);
    });

  router.use("/admin/*", async (c, next) => {
    if (!tokenSource) {
      return c.json(
        {
          error:
            "admin routes are disabled: ADMIN_API_TOKEN is not configured on this deployment",
        },
        503,
      );
    }
    const presented = c.req.header("x-admin-token");
    if (!presented || presented !== tokenSource) {
      return c.json({ error: "unauthorised" }, 401);
    }
    await next();
  });

  router.post("/admin/suppliers/:code/sync", async (c) => {
    const code = c.req.param("code");
    const triggeredBy = c.req.header("x-admin-user") ?? null;

    const registry = (deps.buildRegistry ?? defaultBuildRegistry)();
    const adapter = registry.get(code);
    if (!adapter) {
      return c.json({ error: `no adapter registered for code "${code}"` }, 404);
    }

    const repository = buildRepository();

    try {
      const result = await runSupplierPlanSync({
        supplierCode: code,
        adapter,
        repository,
        trigger: "admin",
        triggeredBy,
      });
      try {
        const supplierId = await repository.getSupplierIdByCode(code);
        if (supplierId) {
          await auditWriter({
            actor: triggeredBy ?? "anonymous",
            action: "supplier.sync",
            targetType: "supplier",
            targetId: supplierId,
            before: null,
            after: {
              logId: result.logId,
              summary: result.summary,
              status: result.status,
            },
          });
        }
      } catch (auditErr) {
        // Audit failures must not break a successful sync. The sync_log
        // row already records the run; audit is for the cross-cutting
        // "who did what" stream.
        console.error("[admin.sync] audit write failed:", auditErr);
      }
      return c.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof SyncRunFailedError) {
        return c.json(
          { ok: false, error: err.message, logId: err.logId },
          502,
        );
      }
      throw err;
    }
  });

  router.get("/admin/suppliers/:code/sync-logs", async (c) => {
    const code = c.req.param("code");
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;
    if (!Number.isFinite(limit) || limit < 1) {
      return c.json({ error: "invalid limit" }, 400);
    }

    const repository = buildRepository();
    const supplierId = await repository.getSupplierIdByCode(code);
    if (!supplierId) {
      return c.json({ error: `unknown supplier code "${code}"` }, 404);
    }

    const rows = await repository.listRecentSyncLogs({ supplierId, limit });
    return c.json({ supplierCode: code, logs: rows });
  });

  return router;
}

/**
 * Default registry: just Fastmove. Phase 4+ will replace this with a real
 * factory that walks `supplier.integration_type` and instantiates the
 * matching adapter — for now there's exactly one supplier, so a hard-coded
 * branch is honest.
 */
function defaultBuildRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  const missing: string[] = [];
  if (!env.FASTMOVE_BASE_URL) missing.push("FASTMOVE_BASE_URL");
  if (!env.FASTMOVE_MERCHANT_ID) missing.push("FASTMOVE_MERCHANT_ID");
  if (!env.FASTMOVE_DEPT_ID) missing.push("FASTMOVE_DEPT_ID");
  if (!env.FASTMOVE_MERCHANT_KEY) missing.push("FASTMOVE_MERCHANT_KEY");
  if (missing.length > 0) {
    throw new Error(
      `[admin] missing Fastmove env vars: ${missing.join(", ")}`,
    );
  }
  registry.register(
    new FastmoveAdapter({
      baseUrl: env.FASTMOVE_BASE_URL!,
      merchantId: env.FASTMOVE_MERCHANT_ID!,
      deptId: env.FASTMOVE_DEPT_ID!,
      merchantKey: env.FASTMOVE_MERCHANT_KEY!,
    }),
  );
  // Touch the constant so a future renamer can find the call site.
  void FASTMOVE_CODE;
  return registry;
}
