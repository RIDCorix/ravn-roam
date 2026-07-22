import { describe, expect, test } from "vitest";

import {
  authorizationForInput,
  capabilitiesForTurn,
} from "./capabilities.js";

describe("authorizationForInput", () => {
  test("derives authorization only from structured mode and trip presence", () => {
    expect(
      authorizationForInput({
        requestedSkill: "edit-trip",
        editableTrip: {
          trip_id: "f9d0d7af-08f8-49e1-8659-297beb0ffa97",
          title: "Owned trip",
        },
      }),
    ).toEqual({
      mode: "edit-trip",
      tripId: "f9d0d7af-08f8-49e1-8659-297beb0ffa97",
    });
  });
});

describe("capabilitiesForTurn", () => {
  test("keeps unscoped chat read-only even with a current trip", () => {
    expect(capabilitiesForTurn({ mode: null, tripId: "trip-1" })).toEqual(
      new Set(["read:context", "read:places", "read:esim"]),
    );
  });

  test("requires an owned trip for mutation modes", () => {
    expect(() =>
      capabilitiesForTurn({ mode: "plan-trip", tripId: null }),
    ).toThrow("plan-trip requires an owned current trip");
  });

  test("authorizes the explicit edit-trip mutations", () => {
    expect(
      capabilitiesForTurn({ mode: "edit-trip", tripId: "trip-1" }),
    ).toEqual(
      new Set([
        "read:context",
        "read:places",
        "trip:update-day",
        "trip:create-day",
        "trip:update-flight",
        "trip:edit-companion",
        "trip:edit-attachment",
      ]),
    );
  });
});
