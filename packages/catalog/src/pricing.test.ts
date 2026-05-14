import { describe, expect, it } from "vitest";

import { buildPricing, computeMargin, computeRetail } from "./pricing";

describe("computeRetail", () => {
  it("applies a fixed amount on top of FX-converted cost", () => {
    expect(
      computeRetail({
        costAmount: 4,
        fxRate: 31.5,
        markupMode: "fixed_amount",
        markupValue: 50,
      }),
    ).toBe(176);
  });

  it("applies a percentage markup", () => {
    expect(
      computeRetail({
        costAmount: 10,
        fxRate: 1,
        markupMode: "percentage",
        markupValue: 25,
      }),
    ).toBe(12.5);
  });

  it("solves for retail at a target margin", () => {
    expect(
      computeRetail({
        costAmount: 10,
        fxRate: 1,
        markupMode: "target_margin",
        markupValue: 50,
      }),
    ).toBe(20);
  });

  it("throws on unreachable target margin (>= 100%)", () => {
    expect(() =>
      computeRetail({
        costAmount: 10,
        fxRate: 1,
        markupMode: "target_margin",
        markupValue: 100,
      }),
    ).toThrow();
  });

  it("passes through manual retail", () => {
    expect(
      computeRetail({
        costAmount: 999,
        fxRate: 999,
        markupMode: "manual",
        markupValue: 0,
        manualRetail: 19.99,
      }),
    ).toBe(19.99);
  });
});

describe("computeMargin", () => {
  it("returns null for zero retail", () => {
    expect(computeMargin(0, 5)).toBeNull();
  });

  it("computes margin for typical price", () => {
    expect(computeMargin(20, 10)).toBeCloseTo(50, 4);
  });
});

describe("buildPricing", () => {
  it("assembles the canonical pricing blob", () => {
    const out = buildPricing({
      currency: "TWD",
      markupMode: "percentage",
      markupValue: 30,
      costSnapshot: {
        plan_id: "00000000-0000-0000-0000-000000000001",
        cost: 4,
        currency: "USD",
        fx_rate: 31.5,
        snapshot_at: "2026-01-01T00:00:00Z",
      },
    });
    expect(out.currency).toBe("TWD");
    expect(out.markup_mode).toBe("percentage");
    expect(out.markup_value).toBe(30);
    expect(out.retail).toBeCloseTo(163.8, 1);
    expect(out.fx_policy).toBe("snapshot_at_publish");
  });
});
