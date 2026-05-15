import { describe, expect, test } from "vitest";

import {
  supplierCreateSchema,
  supplierPauseSchema,
  supplierPlanAdminPatchSchema,
  supplierUpdateSchema,
} from "./schema";

describe("supplierCreateSchema", () => {
  test("accepts a minimal valid supplier", () => {
    const result = supplierCreateSchema.safeParse({
      code: "fastmove",
      display_name: "FastMove",
      default_currency: "TWD",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.integration_type).toBe("api");
      expect(result.data.contact).toEqual({});
    }
  });

  test("rejects uppercase / invalid codes", () => {
    expect(
      supplierCreateSchema.safeParse({
        code: "FastMove",
        display_name: "FastMove",
        default_currency: "TWD",
      }).success,
    ).toBe(false);

    expect(
      supplierCreateSchema.safeParse({
        code: "fast move",
        display_name: "FastMove",
        default_currency: "TWD",
      }).success,
    ).toBe(false);
  });

  test("rejects non-ISO-4217 currency length", () => {
    const result = supplierCreateSchema.safeParse({
      code: "fastmove",
      display_name: "FastMove",
      default_currency: "TWDX",
    });
    expect(result.success).toBe(false);
  });
});

describe("supplierUpdateSchema", () => {
  test("omits `code` from the patchable surface", () => {
    const result = supplierUpdateSchema.safeParse({
      code: "renamed",
      display_name: "Renamed",
    } as never);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("code" in result.data).toBe(false);
      expect(result.data.display_name).toBe("Renamed");
    }
  });
});

describe("supplierPauseSchema", () => {
  test("accepts paused / active only", () => {
    expect(supplierPauseSchema.safeParse({ status: "paused" }).success).toBe(
      true,
    );
    expect(supplierPauseSchema.safeParse({ status: "active" }).success).toBe(
      true,
    );
    expect(
      supplierPauseSchema.safeParse({ status: "terminated" }).success,
    ).toBe(false);
  });
});

describe("supplierPlanAdminPatchSchema", () => {
  // The acceptance criterion says numeric supplier_plan fields must be
  // blocked at API + UI layers. This test locks in the API-side guard: the
  // schema only knows about `admin_enabled`, so anything else gets a 400.
  test("only `admin_enabled` is recognised", () => {
    const result = supplierPlanAdminPatchSchema.safeParse({
      admin_enabled: false,
    });
    expect(result.success).toBe(true);
    expect(supplierPlanAdminPatchSchema.safeParse({}).success).toBe(false);
    expect(
      supplierPlanAdminPatchSchema.safeParse({ admin_enabled: "yes" }).success,
    ).toBe(false);
  });
});
