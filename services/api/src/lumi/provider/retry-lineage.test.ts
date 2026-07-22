import { describe, expect, test } from "vitest";

import {
  consumePendingRetry,
  registerPendingRejection,
  serverAttemptId,
  type PendingLumiRejection,
} from "./retry-lineage.js";

const families = [
  ["update_trip_day", "day-1"],
  ["create_trip_day", "trip-1"],
  ["upsert_stop_attachment", "stop-1"],
  ["create_companion", "trip-1"],
  ["update_companion", "companion-1"],
  ["delete_companion", "companion-1"],
  ["create_flight_leg", "trip-1"],
  ["update_flight_leg", "leg-1"],
] as const;

describe("server-owned mutation retry lineage", () => {
  test("always generates unique server UUIDs even when provider IDs are duplicated", () => {
    const providerIds = ["duplicate-provider-id", "duplicate-provider-id"];
    expect(providerIds[0]).toBe(providerIds[1]);
    const first = serverAttemptId();
    const second = serverAttemptId();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^lumi-attempt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).toMatch(/^lumi-attempt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test.each(families)("consumes the matching %s rejection once", (type, targetId) => {
    const pending: PendingLumiRejection[] = [];
    registerPendingRejection(pending, {
      attempt_id: `rejected-${type}`,
      type,
      target_id: targetId,
      rejected_iteration: 1,
    });

    expect(consumePendingRetry(pending, {
      claimed_attempt_id: `rejected-${type}`,
      type,
      target_id: targetId,
      iteration: 2,
    })).toBe(`rejected-${type}`);
    expect(consumePendingRetry(pending, {
      claimed_attempt_id: `rejected-${type}`,
      type,
      target_id: targetId,
      iteration: 2,
    })).toBeNull();
  });

  test.each([null, "wrong-id"])("auto-correlates a unique exact retry with %s claim", (claimedAttemptId) => {
    const pending: PendingLumiRejection[] = [{
      attempt_id: "server-attempt",
      type: "update_trip_day",
      target_id: "day-1",
      rejected_iteration: 1,
    }];

    expect(consumePendingRetry(pending, {
      claimed_attempt_id: claimedAttemptId,
      type: "update_trip_day",
      target_id: "day-1",
      iteration: 2,
    })).toBe("server-attempt");
    expect(pending).toHaveLength(0);
  });

  test("does not auto-correlate stale or target-mismatched runtime rejections", () => {
    for (const claim of [
      { claimed_attempt_id: "server-attempt", type: "update_trip_day", target_id: "day-2", iteration: 2 },
      { claimed_attempt_id: "server-attempt", type: "update_trip_day", target_id: "day-1", iteration: 3 },
    ] as const) {
      const pending: PendingLumiRejection[] = [{
        attempt_id: "server-attempt",
        type: "update_trip_day",
        target_id: "day-1",
        rejected_iteration: 1,
      }];
      expect(consumePendingRetry(pending, claim)).toBeNull();
      expect(pending).toHaveLength(1);
    }
  });

  test("duplicate provider IDs cannot cross-correlate different exact targets", () => {
    const providerIds = ["duplicate-provider-id", "duplicate-provider-id"];
    expect(providerIds[0]).toBe(providerIds[1]);
    const first = serverAttemptId();
    const second = serverAttemptId();
    const pending: PendingLumiRejection[] = [
      { attempt_id: first, type: "update_trip_day", target_id: "day-1", rejected_iteration: 1 },
      { attempt_id: second, type: "update_trip_day", target_id: "day-2", rejected_iteration: 1 },
    ];

    expect(consumePendingRetry(pending, {
      claimed_attempt_id: null,
      type: "update_trip_day",
      target_id: "day-2",
      iteration: 2,
    })).toBe(second);
    expect(pending).toEqual([
      expect.objectContaining({ attempt_id: first, target_id: "day-1" }),
    ]);
  });

  test("refuses an ambiguous same-type, same-target claim instead of letting one rejection spoof another", () => {
    const pending: PendingLumiRejection[] = [];
    for (const attempt_id of ["rejected-a", "rejected-b"]) {
      registerPendingRejection(pending, {
        attempt_id,
        type: "create_companion",
        target_id: "trip-1",
        rejected_iteration: 1,
      });
    }

    expect(consumePendingRetry(pending, {
      claimed_attempt_id: "rejected-a",
      type: "create_companion",
      target_id: "trip-1",
      iteration: 2,
    })).toBeNull();
    expect(pending).toHaveLength(2);
  });
});
