/**
 * `/readyz` is the detection mechanism the 2026-09 storefront outage was
 * missing. Each test below is one production failure mode that answered
 * `/healthz` 200 for the whole incident.
 */

import { describe, expect, test } from "vitest";

import {
  STOREFRONT_RELATIONS,
  createHealthRouter,
  type CatalogInventory,
  type ReadinessCheck,
  type ReadinessProbe,
} from "./health.js";

const HEALTHY_CATALOG: CatalogInventory = {
  published_products: 12,
  draft_products: 3,
  active_events: 4,
};

function probe(overrides: Partial<ReadinessProbe> = {}): ReadinessProbe {
  return {
    ping: async () => {},
    visibleRelations: async () => [...STOREFRONT_RELATIONS],
    countCatalog: async () => HEALTHY_CATALOG,
    ...overrides,
  };
}

async function readyz(
  deps: Parameters<typeof createHealthRouter>[0],
): Promise<{
  status: number;
  ok: boolean;
  checks: ReadinessCheck[];
  catalog: CatalogInventory | null;
}> {
  const res = await createHealthRouter(deps).request("/readyz");
  const body = (await res.json()) as {
    ok: boolean;
    checks: ReadinessCheck[];
    catalog: CatalogInventory | null;
  };
  return { status: res.status, ...body };
}

function check(checks: ReadinessCheck[], name: string): ReadinessCheck {
  const found = checks.find((c) => c.name === name);
  if (!found) throw new Error(`no ${name} check in ${JSON.stringify(checks)}`);
  return found;
}

describe("/healthz", () => {
  test("stays green without any database credentials", async () => {
    const res = await createHealthRouter({
      databaseUrlConfigured: () => false,
    }).request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe("/readyz", () => {
  test("is 200 and reports the catalog when everything works", async () => {
    const result = await readyz({
      probe: probe(),
      databaseUrlConfigured: () => true,
    });
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.catalog).toEqual(HEALTHY_CATALOG);
    expect(result.checks.map((c) => c.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
  });

  test("fails loudly when DATABASE_URL was never set on the deployment", async () => {
    const result = await readyz({
      probe: probe(),
      databaseUrlConfigured: () => false,
    });
    expect(result.status).toBe(503);
    expect(check(result.checks, "database_url")).toMatchObject({
      status: "fail",
    });
    // Nothing downstream is claimed to be healthy.
    expect(check(result.checks, "connection").status).toBe("skip");
    expect(check(result.checks, "schema").status).toBe("skip");
  });

  test("fails when the database refuses the connection", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        ping: async () => {
          throw Object.assign(new Error("connect ECONNREFUSED"), {
            code: "ECONNREFUSED",
          });
        },
      }),
    });
    expect(result.status).toBe(503);
    expect(check(result.checks, "connection").detail).toContain("unreachable");
  });

  /**
   * The actual 2026-09 root-cause signature: the connection is fine, the
   * roam_poc migrations were never applied, so every storefront query dies
   * with SQLSTATE 42P01 while /healthz keeps answering 200.
   */
  test("names the missing relations when migrations were never applied", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({ visibleRelations: async () => [] }),
    });
    expect(result.status).toBe(503);
    const schema = check(result.checks, "schema");
    expect(schema.status).toBe("fail");
    for (const relation of STOREFRONT_RELATIONS) {
      expect(schema.detail).toContain(relation);
    }
    expect(schema.detail).toContain("migrations");
  });

  test("fails on a partially migrated database and names only the gap", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        visibleRelations: async () =>
          STOREFRONT_RELATIONS.filter((r) => r !== "storefront_event"),
      }),
    });
    expect(result.status).toBe(503);
    const schema = check(result.checks, "schema");
    expect(schema.detail).toContain("storefront_event");
    expect(schema.detail).not.toContain("product_supplier_mapping");
  });

  /**
   * A revoked GRANT hides the relation from information_schema, so it is
   * reported the same way a missing table is — both need a human.
   */
  test("treats an unreadable relation as a schema failure", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        visibleRelations: async () =>
          STOREFRONT_RELATIONS.filter((r) => r !== "product"),
      }),
    });
    expect(result.status).toBe(503);
    expect(check(result.checks, "schema").status).toBe("fail");
  });

  /**
   * Deliberately NOT a 503: a Railway healthcheck on /readyz must not roll
   * back a good deploy just because ops has not published a SKU yet.
   */
  test("warns but stays 200 when the catalog is empty", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        countCatalog: async () => ({
          published_products: 0,
          draft_products: 0,
          active_events: 0,
        }),
      }),
    });
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(check(result.checks, "catalog")).toMatchObject({ status: "warn" });
    expect(result.catalog?.published_products).toBe(0);
  });

  test("does not throw out of the handler when a probe explodes", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        countCatalog: async () => {
          throw new Error("statement timeout");
        },
      }),
    });
    expect(result.status).toBe(503);
    expect(check(result.checks, "catalog")).toMatchObject({
      status: "fail",
      detail: "statement timeout",
    });
  });
});
