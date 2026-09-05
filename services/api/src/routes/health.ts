// Liveness and readiness.
//
//   GET /healthz  → the process is up. Never touches the database, so the
//                   service still boots and reports green without any
//                   credentials (services/api AGENTS.md requirement).
//   GET /readyz   → the process can actually serve storefront data.
//
// The 2026-09 storefront outage is the reason `/readyz` exists. `/healthz`
// answered 200 for the whole incident because it only proves the event loop
// is alive; meanwhile every route that reached Postgres was returning 500.
// `/readyz` walks the same dependency chain the storefront routes walk and
// names the first broken link.

import { Hono } from "hono";
import { sql } from "drizzle-orm";

import { deploymentSha, env } from "../env.js";
import { getDb } from "../db/client.js";
import { describeError } from "../errors.js";
import { countServableProducts } from "./storefront-catalog.js";

/** Relations every storefront read path depends on. */
export const STOREFRONT_RELATIONS = [
  "product",
  "product_supplier_mapping",
  "supplier",
  "supplier_plan",
  "storefront_event",
] as const;

export interface CatalogInventory {
  /**
   * Products `GET /storefront/products` could actually return, counted with
   * that route's own predicate (see ./storefront-catalog.ts): live publication
   * state, an enabled supplier mapping, an available + admin-enabled supplier
   * plan, and at least one marketing destination. This is the number that
   * decides whether the shop renders anything.
   */
  servable_products: number;
  /** Raw publication-state tallies, for context when `servable_products` is 0. */
  published_products: number;
  draft_products: number;
  active_events: number;
}

/** The database work `/readyz` needs, isolated so tests can stub it. */
export interface ReadinessProbe {
  /** Round-trip a trivial statement. Throws when the connection is broken. */
  ping(): Promise<void>;
  /** Relation names visible to the connection role inside `roam_poc`. */
  visibleRelations(): Promise<string[]>;
  countCatalog(): Promise<CatalogInventory>;
}

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export interface ReadinessCheck {
  name: string;
  status: CheckStatus;
  detail?: string;
}

export interface HealthRouterDeps {
  probe?: ReadinessProbe;
  /** Defaults to the real `DATABASE_URL` from env. */
  databaseUrlConfigured?: () => boolean;
  /** Structured log sink; injectable so tests can assert on the record. */
  log?: (line: string) => void;
  /** Defaults to the real deployment commit; injectable for tests. */
  sha?: () => string | null;
}

/**
 * `/readyz` is unauthenticated, so a failure detail may only ever be one of
 * our own curated hints. A driver message can carry the host, the role, the
 * database name or a fragment of the failing statement — that belongs in the
 * log, not in a public response body.
 */
const OPAQUE_DETAIL =
  "check failed — see this deployment's log for msg=readiness_check_failed";

// `db.execute` hands back the driver's raw result, which is an array on
// postgres-js but a `{ rows }` envelope on node-postgres. Accept both.
function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function drizzleProbe(): ReadinessProbe {
  return {
    async ping() {
      await getDb().execute(sql`SELECT 1`);
    },
    async visibleRelations() {
      // information_schema only lists relations the current role may touch,
      // so this doubles as a privilege check: a revoked GRANT looks the same
      // as a missing table, and both are things `/readyz` should fail on.
      const rows = resultRows<{ table_name: string }>(
        await getDb().execute(
          sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'roam_poc'`,
        ),
      );
      return rows.map((r) => r.table_name);
    },
    async countCatalog() {
      const db = getDb();
      // The number that matters comes from the storefront's own predicate,
      // not from a publication_state tally that ignores the supplier chain.
      const servable = await countServableProducts(db);
      const rows = resultRows<Omit<CatalogInventory, "servable_products">>(
        await db.execute(sql`
          SELECT
            (SELECT count(*) FROM roam_poc.product WHERE publication_state = 'published')::int AS published_products,
            (SELECT count(*) FROM roam_poc.product WHERE publication_state = 'draft')::int     AS draft_products,
            (SELECT count(*) FROM roam_poc.storefront_event WHERE active)::int                 AS active_events
        `),
      );
      const row = rows[0];
      return {
        servable_products: servable,
        published_products: Number(row?.published_products ?? 0),
        draft_products: Number(row?.draft_products ?? 0),
        active_events: Number(row?.active_events ?? 0),
      };
    },
  };
}

export function createHealthRouter(deps: HealthRouterDeps = {}): Hono {
  const router = new Hono();
  const databaseUrlConfigured =
    deps.databaseUrlConfigured ?? (() => Boolean(env.DATABASE_URL));
  const log = deps.log ?? ((line: string) => console.error(line));
  const sha = deps.sha ?? (() => deploymentSha());

  router.get("/healthz", (c) => c.json({ ok: true, sha: sha() }));

  router.get("/readyz", async (c) => {
    const checks: ReadinessCheck[] = [];
    let catalog: CatalogInventory | null = null;

    const finish = () => {
      const ok = !checks.some((check) => check.status === "fail");
      return c.json(
        { ok, sha: sha(), checks, catalog },
        ok ? 200 : 503,
      );
    };
    const skip = (...names: string[]) => {
      for (const name of names) checks.push({ name, status: "skip" });
    };
    // Record the failure in full, expose only what is safe to say out loud.
    const failed = (name: string, err: unknown) => {
      const described = describeError(err);
      log(
        JSON.stringify({
          level: "error",
          msg: "readiness_check_failed",
          check: name,
          ...described,
          stack: err instanceof Error ? err.stack : undefined,
        }),
      );
      checks.push({
        name,
        status: "fail",
        detail: described.hint ?? OPAQUE_DETAIL,
      });
    };

    if (!databaseUrlConfigured()) {
      checks.push({
        name: "database_url",
        status: "fail",
        detail: "DATABASE_URL is not set on this deployment",
      });
      skip("connection", "schema", "catalog");
      return finish();
    }
    checks.push({ name: "database_url", status: "pass" });

    const probe = deps.probe ?? drizzleProbe();

    try {
      await probe.ping();
      checks.push({ name: "connection", status: "pass" });
    } catch (err) {
      failed("connection", err);
      skip("schema", "catalog");
      return finish();
    }

    let relations: string[];
    try {
      relations = await probe.visibleRelations();
    } catch (err) {
      failed("schema", err);
      skip("catalog");
      return finish();
    }
    const visible = new Set(relations);
    const missing = STOREFRONT_RELATIONS.filter((name) => !visible.has(name));
    if (missing.length > 0) {
      checks.push({
        name: "schema",
        status: "fail",
        detail:
          `roam_poc is missing (or the role cannot read) ${missing.join(", ")} — ` +
          "apply the pending drizzle migrations to this database",
      });
      skip("catalog");
      return finish();
    }
    checks.push({ name: "schema", status: "pass" });

    try {
      catalog = await probe.countCatalog();
    } catch (err) {
      failed("catalog", err);
      return finish();
    }
    // An empty catalog is a content problem, not a reason to pull the
    // service out of rotation — a Railway healthcheck pointed at /readyz
    // must not roll back a deploy because ops has not published a SKU yet.
    // It is still surfaced so an external monitor can alert on it.
    checks.push(
      catalog.servable_products === 0
        ? {
            name: "catalog",
            status: "warn",
            detail:
              "no servable products — the shop will render empty " +
              `(${catalog.published_products} published / ${catalog.draft_products} draft ` +
              "exist, so check supplier mappings, plan availability and marketing_destinations)",
          }
        : { name: "catalog", status: "pass" },
    );

    return finish();
  });

  return router;
}
