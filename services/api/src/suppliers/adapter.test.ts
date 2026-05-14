import { describe, expect, test } from "vitest";

import { AdapterRegistry, type RawPlan, type SupplierAdapter } from "./adapter.js";

function stubAdapter(code: string): SupplierAdapter {
  return {
    code,
    listPlans(): AsyncIterable<RawPlan> {
      async function* gen(): AsyncIterable<RawPlan> {}
      return gen();
    },
    async getPlan() {
      return null;
    },
  };
}

describe("AdapterRegistry", () => {
  test("routes lookups by supplier.code", () => {
    const registry = new AdapterRegistry();
    const a = stubAdapter("fastmove");
    const b = stubAdapter("airalo");
    registry.register(a);
    registry.register(b);

    expect(registry.get("fastmove")).toBe(a);
    expect(registry.get("airalo")).toBe(b);
    expect(registry.get("unknown")).toBeUndefined();
    expect(registry.codes().sort()).toEqual(["airalo", "fastmove"]);
  });

  test("require() throws on missing code", () => {
    const registry = new AdapterRegistry();
    expect(() => registry.require("nope")).toThrow(/no SupplierAdapter/);
  });

  test("register() rejects duplicate codes", () => {
    const registry = new AdapterRegistry();
    registry.register(stubAdapter("fastmove"));
    expect(() => registry.register(stubAdapter("fastmove"))).toThrow(
      /already registered/,
    );
  });
});
