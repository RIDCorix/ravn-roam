import { describe, expect, test } from "vitest";

import type { QuoteMgQuoteItem } from "../../clients/fastmove/types.js";
import { mapFastmoveQuoteToRawPlan } from "./mapping.js";

/**
 * Acceptance criterion (ROA-56): mapping covers
 *   1. regional plan 多國
 *   2. 不限量 -1
 *   3. 上游空欄位
 */
describe("mapFastmoveQuoteToRawPlan", () => {
  test("regional plan: multi-country list lands in destinations[]", () => {
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-ASIA12-7D-5G",
      productName: "Asia 12 Countries 7-day 5GB",
      productPrice: 590,
      countryList: ["jp", "kr", "tw", "hk", "sg", "th", "vn", "ph", "my", "id", "mo", "kh"],
      flowMb: 5120,
      validDay: 7,
      leSIM: true,
    };

    const plan = mapFastmoveQuoteToRawPlan(item);

    expect(plan.externalId).toBe("WM-ASIA12-7D-5G");
    expect(plan.destinations).toEqual([
      "JP", "KR", "TW", "HK", "SG", "TH", "VN", "PH", "MY", "ID", "MO", "KH",
    ]);
    expect(plan.dataAmountMb).toBe(5120);
    expect(plan.validityDays).toBe(7);
    expect(plan.deliveryModel).toBe("redemption_required");
    expect(plan.activationPolicy).toBe("on_first_use");
    expect(plan.costAmount).toBe("590");
    expect(plan.costCurrency).toBe("TWD");
  });

  test("unlimited data: -1 sentinel is preserved", () => {
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-JP-30D-UNLIMITED",
      productName: "Japan 30-day Unlimited",
      productPrice: 1490,
      countryCode: "jp",
      flowMb: -1,
      validDay: 30,
      leSIM: true,
    };

    const plan = mapFastmoveQuoteToRawPlan(item);

    expect(plan.destinations).toEqual(["JP"]);
    expect(plan.dataAmountMb).toBe(-1);
    expect(plan.validityDays).toBe(30);
  });

  test("upstream missing fields: tolerant defaults, raw_payload preserved", () => {
    // Only the spec-mandated `wmproductId` + `productPrice` present.
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-MYSTERY",
      productPrice: 0,
    };

    const plan = mapFastmoveQuoteToRawPlan(item);

    expect(plan.externalId).toBe("WM-MYSTERY");
    // Name falls back to wmproductId so the row is identifiable even with no
    // upstream label.
    expect(plan.name).toBe("WM-MYSTERY");
    expect(plan.destinations).toEqual([]);
    expect(plan.dataAmountMb).toBe(0);
    expect(plan.validityDays).toBe(0);
    expect(plan.networkOperators).toEqual({});
    expect(plan.inventoryHint).toBeNull();
    // `available` defaults to true so a partial upstream payload doesn't
    // wipe the catalogue — the sync job is the sole writer and an explicit
    // upstream `available=false` is required to retire a plan.
    expect(plan.available).toBe(true);
    expect(plan.costAmount).toBe("0");
    expect(plan.costCurrency).toBe("TWD");
    // raw_payload is the audit / debugging escape hatch — must round-trip.
    expect(plan.rawPayload).toEqual(item);
  });

  test("leSIM=false maps to physical delivery", () => {
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-LOCAL-CARD",
      productPrice: 300,
      leSIM: false,
      countryCode: "tw",
    };

    expect(mapFastmoveQuoteToRawPlan(item).deliveryModel).toBe("physical");
  });

  test("numeric strings in optional fields are coerced", () => {
    // Some upstream eSIM APIs return ints as strings; mapping should not lose
    // them.
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-COERCE",
      productPrice: 100,
      flowMb: "1024" as unknown as number,
      validDay: "14" as unknown as number,
      inventory: "42" as unknown as number,
      countryCode: "us",
    };

    const plan = mapFastmoveQuoteToRawPlan(item);
    expect(plan.dataAmountMb).toBe(1024);
    expect(plan.validityDays).toBe(14);
    expect(plan.inventoryHint).toBe(42);
  });

  test("country codes are normalised to upper-case ISO 3166-1 alpha-2", () => {
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-CASE",
      productPrice: 100,
      countryList: ["jp", "Kr", "TW "],
    };

    expect(mapFastmoveQuoteToRawPlan(item).destinations).toEqual([
      "JP", "KR", "TW",
    ]);
  });

  test("explicit `available=false` is respected", () => {
    const item: QuoteMgQuoteItem = {
      wmproductId: "WM-RETIRED",
      productPrice: 100,
      available: false,
    };

    expect(mapFastmoveQuoteToRawPlan(item).available).toBe(false);
  });
});
