/**
 * The monitor is the thing that has to notice the next outage, so each test
 * below is a real production shape it must not sleep through.
 */

import { describe, expect, test } from "vitest";

import { probeStorefront, summarize } from "./storefront-probe.js";

type Route = { status: number; body?: unknown } | { throws: string };

const HEALTHY: Record<string, Route> = {
  "/healthz": { status: 200, body: { ok: true, sha: "abc1234" } },
  "/readyz": {
    status: 200,
    body: {
      ok: true,
      checks: [
        { name: "database_url", status: "pass" },
        { name: "connection", status: "pass" },
        { name: "schema", status: "pass" },
        { name: "catalog", status: "pass" },
      ],
      catalog: { servable_products: 12 },
    },
  },
  "/storefront/events": { status: 200, body: { events: [{ id: "e1" }] } },
  "/storefront/region-stats": { status: 200, body: { stats: [{ iso: "JP" }] } },
  "/storefront/products?destinations=JP": {
    status: 200,
    body: { products: [{ id: "p1" }] },
  },
  "/storefront/products": { status: 400, body: { error: { message: "…" } } },
};

function stubFetch(overrides: Record<string, Route> = {}) {
  const routes = { ...HEALTHY, ...overrides };
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const key = `${url.pathname}${url.search}`;
    const route = routes[key];
    if (!route) throw new Error(`unstubbed route ${key}`);
    if ("throws" in route) throw new Error(route.throws);
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function run(overrides: Record<string, Route> = {}) {
  return probeStorefront({
    baseUrl: "https://api.example.test",
    fetchImpl: stubFetch(overrides),
  });
}

function check(report: Awaited<ReturnType<typeof run>>, name: string) {
  const found = report.checks.find((c) => c.name === name);
  if (!found) throw new Error(`no ${name} check in ${JSON.stringify(report)}`);
  return found;
}

describe("storefront monitor", () => {
  test("passes when every storefront endpoint serves", async () => {
    const report = await run();
    expect(report.ok).toBe(true);
    expect(report.degraded).toBe(false);
    expect(report.sha).toBe("abc1234");
    expect(report.checks.map((c) => c.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
  });

  /** The exact 2026-09-05 production signature. */
  test("fails on the observed outage shape: /healthz 200 but the data routes 500", async () => {
    const report = await run({
      "/readyz": {
        status: 503,
        body: {
          ok: false,
          checks: [
            { name: "database_url", status: "pass" },
            {
              name: "connection",
              status: "fail",
              detail: "DNS lookup failed — the DATABASE_URL host is wrong",
            },
          ],
        },
      },
      "/storefront/events": { status: 500 },
      "/storefront/region-stats": { status: 500 },
      "/storefront/products?destinations=JP": { status: 500 },
    });
    expect(report.ok).toBe(false);
    expect(check(report, "liveness").status).toBe("pass");
    expect(check(report, "readiness").detail).toContain("DNS lookup failed");
    expect(check(report, "events").status).toBe("fail");
    expect(check(report, "region_stats").status).toBe("fail");
    expect(check(report, "catalog").status).toBe("fail");
    expect(summarize(report)).toContain("events=fail");
  });

  test("fails when the process itself is unreachable", async () => {
    const report = await run({
      "/healthz": { throws: "fetch failed" },
      "/readyz": { throws: "fetch failed" },
      "/storefront/events": { throws: "fetch failed" },
      "/storefront/region-stats": { throws: "fetch failed" },
      "/storefront/products?destinations=JP": { throws: "fetch failed" },
      "/storefront/products": { throws: "fetch failed" },
    });
    expect(report.ok).toBe(false);
    expect(check(report, "liveness")).toMatchObject({
      status: "fail",
      http_status: null,
      detail: "fetch failed",
    });
  });

  test("flags a deployment that predates /readyz instead of calling it healthy", async () => {
    const report = await run({ "/readyz": { status: 404, body: {} } });
    expect(report.ok).toBe(false);
    expect(check(report, "readiness").detail).toContain("/readyz is missing");
  });

  /**
   * Acceptance criterion 6's second half: an unexpectedly empty catalog is
   * not a 5xx, so nothing else would ever surface it.
   */
  test("reports degraded — not failing — when the catalog serves nothing", async () => {
    const report = await run({
      "/readyz": {
        status: 200,
        body: {
          ok: true,
          checks: [
            { name: "catalog", status: "warn", detail: "no servable products" },
          ],
          catalog: { servable_products: 0 },
        },
      },
      "/storefront/products?destinations=JP": {
        status: 200,
        body: { products: [] },
      },
    });
    expect(report.ok).toBe(true);
    expect(report.degraded).toBe(true);
    expect(check(report, "catalog")).toMatchObject({ status: "warn" });
    expect(check(report, "catalog").detail).toContain("renders empty");
  });

  test("warns when the deployment cannot say which build is live", async () => {
    const report = await run({
      "/healthz": { status: 200, body: { ok: true, sha: null } },
    });
    expect(report.degraded).toBe(true);
    expect(check(report, "liveness")).toMatchObject({ status: "warn" });
    expect(check(report, "liveness").detail).toContain("GIT_SHA");
  });

  /**
   * If the paramless empty list ever comes back, the monitor's catalog check
   * could be satisfied by a broken data layer again — so guard the contract.
   */
  test("fails when a paramless /products answers 200 instead of 400", async () => {
    const report = await run({
      "/storefront/products": { status: 200, body: { products: [] } },
    });
    expect(report.ok).toBe(false);
    expect(check(report, "paramless_products_contract").detail).toContain(
      "hide behind this response",
    );
  });

  test("treats a 200 with a malformed body as a failure", async () => {
    const report = await run({
      "/storefront/events": { status: 200, body: { unexpected: true } },
    });
    expect(report.ok).toBe(false);
    expect(check(report, "events").detail).toContain("no `events` array");
  });

  test("probes the destination it was asked about", async () => {
    const seen: string[] = [];
    const report = await probeStorefront({
      baseUrl: "https://api.example.test/",
      destination: "kr",
      fetchImpl: (async (input: string | URL | Request) => {
        const url = new URL(String(input));
        seen.push(`${url.pathname}${url.search}`);
        const key = `${url.pathname}${url.search}`;
        if (key === "/storefront/products?destinations=KR") {
          return new Response(JSON.stringify({ products: [{ id: "p" }] }), {
            status: 200,
          });
        }
        return stubFetch()(input as never);
      }) as unknown as typeof fetch,
    });
    expect(seen).toContain("/storefront/products?destinations=KR");
    // A trailing slash on the base URL must not produce `//healthz`.
    expect(seen).toContain("/healthz");
    expect(report.ok).toBe(true);
  });
});
