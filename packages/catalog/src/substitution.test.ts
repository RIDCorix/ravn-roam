import { describe, expect, it } from "vitest";

import {
  canBeFallback,
  checkMarketingDestinations,
  checkPrimaryParity,
  checkSubstitution,
} from "./substitution";
import type { SupplierPlan } from "./types";

function plan(overrides: Partial<SupplierPlan> = {}): SupplierPlan {
  return {
    id: "plan-1",
    supplier_id: "sup-1",
    external_id: "ext-1",
    name: "Test plan",
    destinations: ["JP", "KR"],
    data_amount_mb: 5120,
    validity_days: 7,
    activation_policy: "on_first_use",
    delivery_model: "lpa_direct",
    cost_amount: 4,
    cost_currency: "USD",
    available: true,
    admin_enabled: true,
    inventory_hint: null,
    last_synced_at: null,
    ...overrides,
  };
}

describe("checkSubstitution", () => {
  it("accepts an equal-spec plan as a valid fallback", () => {
    const primary = plan();
    const candidate = plan({ id: "plan-2" });
    expect(
      checkSubstitution({
        primary,
        candidate,
        marketingDestinations: ["JP"],
      }),
    ).toEqual([]);
  });

  it("flags candidates with less data", () => {
    const primary = plan({ data_amount_mb: 5120 });
    const candidate = plan({ id: "plan-2", data_amount_mb: 3072 });
    const violations = checkSubstitution({
      primary,
      candidate,
      marketingDestinations: ["JP"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe("data_amount_mb_too_low");
  });

  it("treats -1 (unlimited) as the maximum data tier", () => {
    const unlimited = plan({ id: "p1", data_amount_mb: -1 });
    const finite = plan({ id: "p2", data_amount_mb: 100000 });
    expect(
      checkSubstitution({
        primary: finite,
        candidate: unlimited,
        marketingDestinations: ["JP"],
      }),
    ).toEqual([]);
    expect(
      checkSubstitution({
        primary: unlimited,
        candidate: finite,
        marketingDestinations: ["JP"],
      }),
    ).toEqual([
      expect.objectContaining({ code: "data_amount_mb_too_low" }),
    ]);
  });

  it("flags shorter-validity candidates", () => {
    const primary = plan({ validity_days: 7 });
    const candidate = plan({ id: "plan-2", validity_days: 5 });
    expect(
      checkSubstitution({
        primary,
        candidate,
        marketingDestinations: ["JP"],
      }),
    ).toEqual([
      expect.objectContaining({ code: "validity_days_too_short" }),
    ]);
  });

  it("flags candidates missing marketing destinations", () => {
    const primary = plan({ destinations: ["JP", "KR", "TW"] });
    const candidate = plan({ id: "plan-2", destinations: ["JP"] });
    const violations = checkSubstitution({
      primary,
      candidate,
      marketingDestinations: ["JP", "KR"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe("destinations_missing");
    expect(violations[0].detail).toEqual({ missing: ["KR"] });
  });

  it("can report multiple violations at once", () => {
    const primary = plan({ data_amount_mb: 5120, validity_days: 7 });
    const candidate = plan({
      id: "plan-2",
      data_amount_mb: 3072,
      validity_days: 5,
      destinations: ["TW"],
    });
    const violations = checkSubstitution({
      primary,
      candidate,
      marketingDestinations: ["JP"],
    });
    expect(violations.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "data_amount_mb_too_low",
        "validity_days_too_short",
        "destinations_missing",
      ]),
    );
  });
});

describe("canBeFallback", () => {
  it("returns ok=true on clean candidates", () => {
    expect(
      canBeFallback({
        primary: plan(),
        candidate: plan({ id: "p2" }),
        marketingDestinations: ["JP"],
      }),
    ).toEqual({ ok: true });
  });

  it("surfaces reasons on dirty candidates", () => {
    const result = canBeFallback({
      primary: plan(),
      candidate: plan({ id: "p2", validity_days: 3 }),
      marketingDestinations: ["JP"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons[0].code).toBe("validity_days_too_short");
    }
  });
});

describe("checkMarketingDestinations", () => {
  it("rejects marketing destinations not covered by primary", () => {
    const violations = checkMarketingDestinations(
      ["JP", "VN"],
      { destinations: ["JP", "KR"] },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toMatchObject({ extras: ["VN"] });
  });

  it("accepts a strict subset", () => {
    expect(
      checkMarketingDestinations(["JP"], { destinations: ["JP", "KR"] }),
    ).toEqual([]);
  });
});

describe("checkPrimaryParity", () => {
  it("requires data / validity / activation policy parity", () => {
    const primary = plan({
      data_amount_mb: 5120,
      validity_days: 7,
      activation_policy: "on_first_use",
    });
    const violations = checkPrimaryParity(
      {
        data_amount_mb: 3072,
        validity_days: 5,
        activation_policy_display: "on_install",
      },
      primary,
    );
    expect(violations).toHaveLength(3);
  });

  it("passes when the product mirrors the primary plan", () => {
    const primary = plan({
      data_amount_mb: 5120,
      validity_days: 7,
      activation_policy: "on_first_use",
    });
    expect(
      checkPrimaryParity(
        {
          data_amount_mb: 5120,
          validity_days: 7,
          activation_policy_display: "on_first_use",
        },
        primary,
      ),
    ).toEqual([]);
  });
});
