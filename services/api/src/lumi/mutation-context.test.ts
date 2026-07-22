import { describe, expect, test } from "vitest";

import { validateMutationContext } from "./mutation-context.js";
import { preflightMutationRequest } from "./mutation-context.js";

describe("validateMutationContext", () => {
  test("rejects missing mutation context before provider orchestration", () => {
    expect(validateMutationContext("plan-trip", undefined, null)).toEqual({
      ok: false,
      status: 400,
      error: "current_trip_required",
    });
  });

  test("rejects unowned mutation context", () => {
    expect(validateMutationContext("edit-trip", "trip-1", "forbidden")).toEqual({
      ok: false,
      status: 403,
      error: "current_trip_forbidden",
    });
  });
});

describe("preflightMutationRequest", () => {
  test("returns a real 403 preflight result before a stream is opened", async () => {
    const loadOwnedTrip = async () => false;
    await expect(preflightMutationRequest({
      mode: "edit-trip",
      tripId: "00000000-0000-4000-8000-000000000001",
      loadOwnedTrip,
    })).resolves.toEqual({ ok: false, status: 403, error: "current_trip_forbidden" });
  });
});
