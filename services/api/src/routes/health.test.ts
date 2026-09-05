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
  servable_products: 12,
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
  /** Raw response text, for asserting on what did NOT leak into it. */
  raw: string;
  logs: string[];
}> {
  const logs: string[] = [];
  const res = await createHealthRouter({
    log: (line) => logs.push(line),
    ...deps,
  }).request("/readyz");
  const raw = await res.text();
  const body = JSON.parse(raw) as {
    ok: boolean;
    checks: ReadinessCheck[];
    catalog: CatalogInventory | null;
  };
  return { status: res.status, raw, logs, ...body };
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
          servable_products: 0,
          published_products: 0,
          draft_products: 0,
          active_events: 0,
        }),
      }),
    });
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(check(result.checks, "catalog")).toMatchObject({ status: "warn" });
    expect(result.catalog?.servable_products).toBe(0);
  });

  /**
   * The failure `/readyz` used to miss entirely. Every product is published,
   * so a `publication_state` tally says the catalog is fine — but not one of
   * them has an enabled supplier mapping with an available plan, so
   * `/storefront/products` returns `[]` for every destination. The count now
   * comes from the route's own predicate (see ./storefront-catalog.ts), so
   * this reads as a warning instead of a pass.
   */
  test("warns when products are published but none are servable", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        countCatalog: async () => ({
          servable_products: 0,
          published_products: 24,
          draft_products: 2,
          active_events: 6,
        }),
      }),
    });
    expect(result.status).toBe(200);
    const catalog = check(result.checks, "catalog");
    expect(catalog.status).toBe("warn");
    // The detail has to point at the supplier chain, because that is where a
    // published-but-unservable catalog actually breaks.
    expect(catalog.detail).toContain("24 published");
    expect(catalog.detail).toContain("supplier mappings");
    expect(result.catalog?.servable_products).toBe(0);
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
    expect(check(result.checks, "catalog").status).toBe("fail");
  });
});

/**
 * `/readyz` is unauthenticated. A driver error carries the database host, the
 * role, and often a fragment of the failing statement; none of that may reach
 * an anonymous caller, and all of it has to reach the log.
 */
describe("/readyz does not leak internals", () => {
  const SECRET =
    'password authentication failed for user "roam_poc_admin" at db.tthcypfhjipwtmumvsqs.supabase.co';

  for (const stage of ["ping", "visibleRelations", "countCatalog"] as const) {
    test(`keeps the raw driver message out of a ${stage} failure`, async () => {
      const result = await readyz({
        databaseUrlConfigured: () => true,
        probe: probe({
          [stage]: async () => {
            throw new Error(SECRET);
          },
        } as Partial<ReadinessProbe>),
      });
      expect(result.status).toBe(503);
      expect(result.raw).not.toContain(SECRET);
      expect(result.raw).not.toContain("roam_poc_admin");
      expect(result.raw).not.toContain("supabase.co");
      // ...but an operator can still find it, in full, in the log.
      const logged = result.logs.map(
        (line) => JSON.parse(line) as { msg: string; message: string },
      );
      expect(logged.map((l) => l.msg)).toContain("readiness_check_failed");
      expect(logged.map((l) => l.message)).toContain(SECRET);
    });
  }

  test("still returns the curated hint, which is safe to say out loud", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        ping: async () => {
          throw Object.assign(
            new Error(`connect ENOTFOUND db.tthcypfhjipwtmumvsqs.supabase.co`),
            { code: "ENOTFOUND" },
          );
        },
      }),
    });
    expect(check(result.checks, "connection").detail).toContain("DNS lookup failed");
    expect(result.raw).not.toContain("tthcypfhjipwtmumvsqs");
  });

  test("falls back to an opaque detail when the error is unrecognised", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe({
        visibleRelations: async () => {
          throw new Error("SELECT table_name FROM information_schema.tables — boom");
        },
      }),
    });
    const schema = check(result.checks, "schema");
    expect(schema.detail).toContain("readiness_check_failed");
    expect(schema.detail).not.toContain("information_schema");
  });
});

describe("deployment identification", () => {
  test("/healthz reports the deployment commit", async () => {
    const res = await createHealthRouter({ sha: () => "abc1234" }).request(
      "/healthz",
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, sha: "abc1234" });
  });

  test("/healthz reports null — not '' — when the commit is unknown", async () => {
    // A deployment that answers `sha: ""` looks configured but identifies
    // nothing; the 2026-09 outage lost a day to exactly that ambiguity.
    const res = await createHealthRouter({ sha: () => null }).request(
      "/healthz",
    );
    await expect(res.json()).resolves.toEqual({ ok: true, sha: null });
  });

  test("/readyz carries the same commit as /healthz", async () => {
    const result = await readyz({
      databaseUrlConfigured: () => true,
      probe: probe(),
      sha: () => "abc1234",
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.raw).sha).toBe("abc1234");
  });
});
