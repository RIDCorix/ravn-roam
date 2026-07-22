import { describe, expect, test } from "vitest";

import type { LumiDay, LumiTripDraft } from "../contracts/result.js";
import { executeLumiActionTool, mergeTripDraftDays, rejectedCommandAttempt, type LumiToolState } from "./command-adapter.js";
import { registerPendingRejection, serverAttemptId } from "./retry-lineage.js";
import { stagedDraftIssue } from "../validation/drafts.js";

const staged: LumiDay[] = [
  { day_date: "2026-09-25", city: "Milan", cities: ["Milan"], note: "Arrival", stops: [] },
  { day_date: "2026-09-26", city: "Milan", cities: ["Milan"], note: "Design", stops: [] },
];

describe("authoritative staged draft days", () => {
  test("does not merge invalid duplicate or out-of-range final extras after staged validation", () => {
    const finalDraft: LumiTripDraft = {
      title: "Milan",
      start_date: "2026-09-25",
      end_date: "2026-09-26",
      days: [
        staged[0]!,
        { ...staged[0]!, note: "duplicate" },
        { day_date: "2026-10-01", city: "Paris", note: "out of range", stops: [] },
      ],
    };
    expect(stagedDraftIssue(finalDraft, staged)).toBeNull();
    const effective = mergeTripDraftDays(finalDraft, staged);
    expect(effective.days.map(({ day_date, note }) => ({ day_date, note }))).toEqual(
      staged.map(({ day_date, note }) => ({ day_date, note })),
    );
    expect(stagedDraftIssue(effective, [])).toBeNull();
  });
});

describe("create retry attempt correlation", () => {
  const tripId = "00000000-0000-4000-8000-000000000001";
  const input = {
    prompt: "Create",
    requestedSkill: "edit-trip" as const,
    editableTrip: {
      trip_id: tripId,
      title: "Milan",
      start_date: "2026-09-25",
      end_date: "2026-09-26",
      days: [],
      cities: [],
      companions: [],
      flight_legs: [],
    },
  };

  for (const fixture of [
    {
      type: "create_companion" as const,
      bad: { trip_id: tripId, retry_of: null, companion: { display_name: null, color: null } },
      good: { trip_id: tripId, retry_of: "bad-create_companion", companion: { display_name: "Ada", color: null } },
    },
    {
      type: "create_flight_leg" as const,
      bad: { trip_id: tripId, retry_of: null, leg: { departure_date: "2026-02-30", departure_time: null, flight_number: "BR88", terminal: null, gate: null } },
      good: { trip_id: tripId, retry_of: "bad-create_flight_leg", leg: { departure_date: "2026-02-28", departure_time: null, flight_number: "BR88", terminal: null, gate: null } },
    },
  ]) {
    test(`carries rejected ${fixture.type} attempt ID into the corrected accepted command`, async () => {
      const state: LumiToolState = {
        acceptedCommands: [], rejectedCommands: [], draftDaysByDate: new Map(),
        pendingRejections: [], flightDetailsByLegKey: new Map(), verifiedPlaceIds: new Set(),
      };
      const badCall = { id: `bad-${fixture.type}`, type: "function" as const, function: { name: fixture.type, arguments: JSON.stringify(fixture.bad) } };
      const badResult = await executeLumiActionTool({ input, state, toolCall: badCall });
      const rejection = rejectedCommandAttempt(fixture.type, serverAttemptId(), fixture.bad, badResult, badCall.id);
      expect(rejection?.attempt_id).toMatch(/^lumi-attempt-/);
      expect(rejection?.attempt_id).not.toBe(badCall.id);
      expect(rejection?.provider_tool_call_id).toBe(badCall.id);
      registerPendingRejection(state.pendingRejections, {
        attempt_id: rejection!.attempt_id!,
        type: rejection!.type,
        target_id: rejection!.target_id,
        rejected_iteration: 1,
      });
      const goodCall = { id: `good-${fixture.type}`, type: "function" as const, function: { name: fixture.type, arguments: JSON.stringify({ ...fixture.good, retry_of: rejection!.attempt_id }) } };
      await executeLumiActionTool({ input, state, toolCall: goodCall, iteration: 2 });
      expect(state.acceptedCommands[0]?.attempt_id).toBe(rejection!.attempt_id);
    });
  }

  test.each([null, "wrong-server-attempt"])("auto-correlates runtime-shaped create correction with %s claim", async (retryOf) => {
    const state: LumiToolState = {
      acceptedCommands: [], rejectedCommands: [], pendingRejections: [],
      draftDaysByDate: new Map(), flightDetailsByLegKey: new Map(), verifiedPlaceIds: new Set(),
    };
    registerPendingRejection(state.pendingRejections, {
      attempt_id: "server-create-attempt",
      type: "create_companion",
      target_id: tripId,
      rejected_iteration: 1,
    });
    const call = { id: "provider-correction", type: "function" as const, function: {
      name: "create_companion",
      arguments: JSON.stringify({ trip_id: tripId, retry_of: retryOf, companion: { display_name: "Ada", color: null } }),
    } };

    await executeLumiActionTool({ input, state, toolCall: call, iteration: 2 });
    expect(state.acceptedCommands[0]?.attempt_id).toBe("server-create-attempt");
    expect(state.pendingRejections).toHaveLength(0);
  });

  test("leaves stale and ambiguous parent-scoped create corrections uncorrelated", async () => {
    for (const pendingRejections of [
      [{ attempt_id: "stale", type: "create_companion" as const, target_id: tripId, rejected_iteration: 1 }],
      [
        { attempt_id: "ambiguous-a", type: "create_companion" as const, target_id: tripId, rejected_iteration: 1 },
        { attempt_id: "ambiguous-b", type: "create_companion" as const, target_id: tripId, rejected_iteration: 1 },
      ],
    ]) {
      const state: LumiToolState = {
        acceptedCommands: [], rejectedCommands: [], pendingRejections: [...pendingRejections],
        draftDaysByDate: new Map(), flightDetailsByLegKey: new Map(), verifiedPlaceIds: new Set(),
      };
      const iteration = pendingRejections.length === 1 ? 3 : 2;
      const call = { id: "provider-correction", type: "function" as const, function: {
        name: "create_companion",
        arguments: JSON.stringify({ trip_id: tripId, retry_of: null, companion: { display_name: "Ada", color: null } }),
      } };

      await executeLumiActionTool({ input, state, toolCall: call, iteration });
      expect(state.acceptedCommands[0]?.attempt_id).toBeUndefined();
      expect(state.pendingRejections).toHaveLength(pendingRejections.length);
    }
  });
});
