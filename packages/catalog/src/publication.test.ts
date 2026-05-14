import { describe, expect, it } from "vitest";

import {
  allowedTransitions,
  areMappingsLocked,
  isFieldLocked,
  isPricingLocked,
  isProductEditable,
  tryTransition,
} from "./publication";

describe("publication state machine", () => {
  it("walks the happy path draft → in_review → published → archived", () => {
    let state = tryTransition("draft", "submit");
    expect(state.to).toBe("in_review");

    state = tryTransition("in_review", "approve");
    expect(state.to).toBe("published");

    state = tryTransition("published", "archive");
    expect(state.to).toBe("archived");

    state = tryTransition("archived", "unarchive");
    expect(state.to).toBe("draft");
  });

  it("permits the skip-review path for platform self-publish", () => {
    expect(tryTransition("draft", "publish").to).toBe("published");
  });

  it("supports rejection back to draft", () => {
    expect(tryTransition("in_review", "reject").to).toBe("draft");
  });

  it("blocks impossible transitions", () => {
    expect(tryTransition("draft", "approve").ok).toBe(false);
    expect(tryTransition("published", "submit").ok).toBe(false);
    expect(tryTransition("archived", "publish").ok).toBe(false);
  });

  it("lists allowed transitions per state", () => {
    expect(allowedTransitions("draft")).toEqual(
      expect.arrayContaining(["submit", "publish"]),
    );
    expect(allowedTransitions("published")).toEqual(["archive"]);
  });
});

describe("isFieldLocked", () => {
  it("treats draft as fully editable", () => {
    expect(isFieldLocked("draft", "data_amount_mb")).toBe(false);
    expect(isFieldLocked("draft", "pricing")).toBe(false);
  });

  it("locks structural fields on published products", () => {
    expect(isFieldLocked("published", "data_amount_mb")).toBe(true);
    expect(isFieldLocked("published", "validity_days")).toBe(true);
    expect(isFieldLocked("published", "category")).toBe(true);
    expect(isFieldLocked("published", "pricing")).toBe(true);
  });

  it("allows marketing fields on published products", () => {
    expect(isFieldLocked("published", "display_name_i18n")).toBe(false);
    expect(isFieldLocked("published", "description_i18n")).toBe(false);
    expect(isFieldLocked("published", "media")).toBe(false);
    expect(isFieldLocked("published", "tags")).toBe(false);
  });
});

describe("isProductEditable / areMappingsLocked / isPricingLocked", () => {
  it("marks archived as not editable", () => {
    expect(isProductEditable("archived")).toBe(false);
  });

  it("locks mappings + pricing on published and archived", () => {
    expect(areMappingsLocked("published")).toBe(true);
    expect(areMappingsLocked("archived")).toBe(true);
    expect(areMappingsLocked("draft")).toBe(false);
    expect(isPricingLocked("published")).toBe(true);
    expect(isPricingLocked("draft")).toBe(false);
  });
});
