/**
 * Regression guard for the response that misdirected the 2026-09 outage
 * triage: `/storefront/products` with no `destinations` answered
 * `200 {"products":[]}` *before* touching the database, so a totally broken
 * data layer read as "the catalog is empty".
 *
 * The route is asserted through the real router. No database is configured
 * in this test process, so reaching the query layer would throw — which is
 * itself the proof that the 400 is returned without a DB round-trip.
 */

import { describe, expect, test } from "vitest";

import { storefrontRouter } from "./storefront.js";

describe("GET /storefront/products", () => {
  test("rejects a request with no destinations instead of faking an empty catalog", async () => {
    const res = await storefrontRouter.request("/products");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("destinations");
    expect(body).not.toHaveProperty("products");
  });

  test("also rejects a blank / comma-only destinations value", async () => {
    for (const qs of ["?destinations=", "?destinations=,%20,"]) {
      const res = await storefrontRouter.request(`/products${qs}`);
      expect(res.status, qs).toBe(400);
    }
  });
});
