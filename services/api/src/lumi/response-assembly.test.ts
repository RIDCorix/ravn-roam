import { describe, expect, test } from "vitest";

import { assembleLumiResponse } from "./response-assembly.js";
import type { ExecutedLumiCommand } from "./execution/itinerary.js";

const STOP_ID = "22222222-2222-4222-8222-222222222222";
const DAY_ID = "33333333-3333-4333-8333-333333333333";

describe("assembleLumiResponse", () => {
  test("keeps a superseded rejected retry audit-only after the same target succeeds", () => {
    const result = assembleLumiResponse({
      proposedSummary: "Updated the day.",
      executions: [{ type: "update_trip_day", status: "success", target_id: "day-1" }],
      rejectedAttempts: [{
        type: "update_trip_day",
        target_id: "day-1",
        status: "rejected",
        code: "invalid_command",
      }],
    });
    expect(result.summary).toBe("Updated the day.");
    expect(result.audit.rejected_attempts).toHaveLength(1);
  });

  test("does not hide a rejected day when a different day succeeds", () => {
    const result = assembleLumiResponse({
      proposedSummary: "Updated one day.",
      executions: [{ type: "update_trip_day", status: "success", target_id: "day-b" }],
      rejectedAttempts: [{ type: "update_trip_day", target_id: "day-a", status: "rejected", code: "invalid_reference" }],
    });
    expect(result.summary).toContain("some changes");
    expect(result.audit.rejected_attempts).toHaveLength(1);
  });

  for (const type of ["create_companion", "create_flight_leg"] as const) {
    test(`correlates a corrected ${type} retry by its stable trip request target`, () => {
      const execution = {
        type,
        status: "success",
        target_id: `${type}-created-id`,
        request_target_id: "trip-1",
      } as ExecutedLumiCommand;
      const result = assembleLumiResponse({
        proposedSummary: "Created.",
        executions: [execution],
        rejectedAttempts: [{ type, target_id: "trip-1", status: "rejected", code: "invalid_command" }],
      });
      expect(result.summary).toBe("Created.");
      expect(result.audit.rejected_attempts).toHaveLength(1);
    });
  }

  for (const type of ["create_companion", "create_flight_leg"] as const) {
    test(`does not cross-suppress another same-trip ${type} rejection`, () => {
      const execution = {
        type,
        status: "success",
        target_id: `${type}-created-id`,
        request_target_id: "trip-1",
        attempt_id: "attempt-a",
      } as ExecutedLumiCommand;
      const result = assembleLumiResponse({
        proposedSummary: "Created one.",
        executions: [execution],
        rejectedAttempts: [
          { type, target_id: "trip-1", attempt_id: "attempt-a", status: "rejected", code: "invalid_command" },
          { type, target_id: "trip-1", attempt_id: "attempt-b", status: "rejected", code: "invalid_command" },
        ],
      });
      expect(result.summary).toContain("some changes");
      expect(result.audit.rejected_attempts).toHaveLength(2);
    });
  }
  test("replaces a stale-mutation success claim and exposes no mutation", () => {
    const execution = {
      type: "upsert_stop_attachment" as const,
      target_id: STOP_ID,
      status: "error" as const,
      code: "invalid_reference" as const,
    };

    const result = assembleLumiResponse({
      proposedSummary: "Updated the museum ticket.",
      executions: [execution],
    });

    expect(result.summary).toBe(
      "I couldn't apply that change because the trip changed. Reload and try again.",
    );
    expect(result.mutations).toEqual([]);
    expect(result.audit).toEqual({
      executions: [execution],
      rejected_attempts: [],
    });
  });

  test("removes staged success badges when the corresponding batch fails", () => {
    const result = assembleLumiResponse({
      proposedSummary: "Updated the museum day.",
      executions: [
        {
          type: "update_trip_day",
          target_id: DAY_ID,
          status: "error",
          code: "conflict",
        },
      ],
      proposedToolEvents: [
        {
          tool_name: "update_trip_day",
          status: "success",
          label: "Updated day 2",
        },
        {
          tool_name: "update_trip_day",
          status: "error",
          label: "Raw tool failure",
        },
      ],
    });

    expect(result.toolEvents).toEqual([]);
  });

  test("treats a rejected command attempt as a failed mutation", () => {
    const rejection = {
      type: "update_trip_day" as const,
      target_id: DAY_ID,
      status: "rejected" as const,
      code: "unauthorized_command" as const,
    };

    const result = assembleLumiResponse({
      proposedSummary: "Updated the museum day.",
      executions: [],
      rejectedAttempts: [rejection],
    });

    expect(result.summary).toBe(
      "I couldn't apply that change because it wasn't allowed. Review the trip and try again.",
    );
    expect(result.mutations).toEqual([]);
    expect(result.audit).toEqual({
      executions: [],
      rejected_attempts: [rejection],
    });
  });

  test("requires an exact successful outcome for each non-flight badge", () => {
    const matchingEvent = {
      tool_name: "update_trip_day" as const,
      target_id: DAY_ID,
      status: "success" as const,
      label: "Updated day 2",
    };
    const mismatchedEvent = {
      tool_name: "create_trip_day" as const,
      target_id: "11111111-1111-4111-8111-111111111111",
      status: "success" as const,
      label: "Created one day",
    };

    expect(
      assembleLumiResponse({
        proposedSummary: "Updated the day.",
        executions: [],
        proposedToolEvents: [matchingEvent],
      }).toolEvents,
    ).toEqual([]);

    expect(
      assembleLumiResponse({
        proposedSummary: "Updated the day.",
        executions: [
          {
            type: "update_trip_day",
            target_id: DAY_ID,
            status: "success",
          },
        ],
        proposedToolEvents: [matchingEvent, mismatchedEvent],
      }).toolEvents,
    ).toEqual([matchingEvent]);
  });

  test("correlates repeated create-day badges with ordered outcomes", () => {
    const tripId = "11111111-1111-4111-8111-111111111111";
    const conflictedDay = {
      tool_name: "create_trip_day" as const,
      target_id: tripId,
      status: "success" as const,
      label: "Created 2026-09-10",
    };
    const createdDay = {
      tool_name: "create_trip_day" as const,
      target_id: tripId,
      status: "success" as const,
      label: "Created 2026-09-11",
    };

    const result = assembleLumiResponse({
      proposedSummary: "Added both days.",
      executions: [
        {
          type: "create_trip_day",
          target_id: tripId,
          status: "error",
          code: "conflict",
        },
        {
          type: "create_trip_day",
          target_id: tripId,
          status: "success",
        },
      ],
      proposedToolEvents: [conflictedDay, createdDay],
    });

    expect(result.toolEvents).toEqual([createdDay]);
  });

  test("keeps a successful direct flight mutation badge", () => {
    const event = {
      tool_name: "set_flight_details" as const,
      status: "success" as const,
      label: "Saved flight details",
    };

    const result = assembleLumiResponse({
      proposedSummary: "Saved the flight.",
      executions: [],
      proposedToolEvents: [event],
      flightDetailsApplied: true,
    });

    expect(result.toolEvents).toEqual([event]);
  });

  test("counts an applied flight update when reporting partial success", () => {
    const result = assembleLumiResponse({
      proposedSummary: "Saved the flight and updated the day.",
      executions: [
        {
          type: "update_trip_day",
          target_id: DAY_ID,
          status: "error",
          code: "conflict",
        },
      ],
      flightDetailsApplied: true,
    });

    expect(result.summary).toBe(
      "I applied some changes, but another change conflicts with the current trip. Reload and try again.",
    );
  });

  test("exposes only successful mutations from a mixed execution batch", () => {
    const success = {
      type: "update_trip_day" as const,
      target_id: DAY_ID,
      status: "success" as const,
    };
    const conflict = {
      type: "upsert_stop_attachment" as const,
      target_id: STOP_ID,
      status: "error" as const,
      code: "conflict" as const,
    };

    const result = assembleLumiResponse({
      proposedSummary: "Updated the day and ticket.",
      executions: [success, conflict],
    });

    expect(result.summary).toBe(
      "I applied some changes, but another change conflicts with the current trip. Reload and try again.",
    );
    expect(result.mutations).toEqual([success]);
    expect(result.audit).toEqual({
      executions: [success, conflict],
      rejected_attempts: [],
    });
  });

  test("preserves proposed prose only when every requested mutation succeeds", () => {
    const success = {
      type: "update_trip_day" as const,
      target_id: DAY_ID,
      status: "success" as const,
    };

    expect(
      assembleLumiResponse({
        proposedSummary: "Updated the museum day.",
        executions: [success],
      }),
    ).toEqual({
      summary: "Updated the museum day.",
      mutations: [success],
      audit: { executions: [success], rejected_attempts: [] },
      toolEvents: [],
    });
  });

  test("uses retry copy for an internal execution failure without exposing errors", () => {
    const execution = {
      type: "create_trip_day" as const,
      target_id: "11111111-1111-4111-8111-111111111111",
      status: "error" as const,
      code: "execution_failed" as const,
    };

    const result = assembleLumiResponse({
      proposedSummary: "Added the new day.",
      executions: [execution],
    });

    expect(result.summary).toBe(
      "I couldn't apply that change. Try again in a moment.",
    );
    expect(result.mutations).toEqual([]);
    expect(JSON.stringify({
      summary: result.summary,
      mutations: result.mutations,
    })).not.toContain("execution_failed");
  });

  test("leaves a read-only response unchanged", () => {
    expect(
      assembleLumiResponse({
        proposedSummary: "The museum opens at 9:00.",
        executions: [],
      }),
    ).toEqual({
      summary: "The museum opens at 9:00.",
      mutations: [],
      audit: { executions: [], rejected_attempts: [] },
      toolEvents: [],
    });
  });
});
