import { describe, expect, it } from "vitest";

import { UAT_FIXTURE_ROBOTS, uatFixtureEnabled } from "./uat-fixture-access";

describe("uatFixtureEnabled", () => {
  it("is on when the deployment says nothing — a production build must still serve the UAT surface", () => {
    expect(uatFixtureEnabled(undefined)).toBe(true);
    expect(uatFixtureEnabled("")).toBe(true);
  });

  it("is off for the documented kill-switch values", () => {
    expect(uatFixtureEnabled("1")).toBe(false);
    expect(uatFixtureEnabled("true")).toBe(false);
    expect(uatFixtureEnabled("TRUE")).toBe(false);
    expect(uatFixtureEnabled(" true ")).toBe(false);
  });

  it("stays on for anything else, so a stray value cannot silently 404 UAT", () => {
    expect(uatFixtureEnabled("0")).toBe(true);
    expect(uatFixtureEnabled("false")).toBe(true);
    expect(uatFixtureEnabled("no")).toBe(true);
  });

  it("is never indexable", () => {
    expect(UAT_FIXTURE_ROBOTS.index).toBe(false);
    expect(UAT_FIXTURE_ROBOTS.follow).toBe(false);
  });
});
