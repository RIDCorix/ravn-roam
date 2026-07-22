import { describe, expect, test } from "vitest";

import type { LumiCapability } from "../capabilities.js";
import type { LumiCommand } from "../contracts/commands.js";
import type { EditableTripSnapshot } from "../contracts/snapshot.js";
import { validateLumiCommand } from "./commands.js";

const TRIP_ID = "00000000-0000-4000-8000-000000000001";
const DAY_ID = "00000000-0000-4000-8000-000000000002";
const STOP_ID = "00000000-0000-4000-8000-000000000003";
const COMPANION_ID = "00000000-0000-4000-8000-000000000004";
const LEG_ID = "00000000-0000-4000-8000-000000000005";

const snapshot: EditableTripSnapshot = {
  trip_id: TRIP_ID,
  title: "Milan design trip",
  start_date: "2026-09-25",
  end_date: "2026-09-25",
  days: [{
    day_id: DAY_ID,
    day_date: "2026-09-25",
    city: "Milan",
    cities: ["Milan"],
    note: "Brera day",
    stops: [{
      stop_id: STOP_ID,
      name: "Pinacoteca di Brera",
      place_name: "Pinacoteca di Brera",
    }],
  }],
  cities: [],
  companions: [{
    id: COMPANION_ID,
    display_name: "Ada",
    color: "#0FB8B4",
    user_id: null,
    accepted_at: null,
  }],
  flight_legs: [{ leg_id: LEG_ID, flight_number: "BR88" }],
};

const capabilities = new Set<LumiCapability>([
  "trip:update-day",
  "trip:create-day",
  "trip:edit-attachment",
  "trip:edit-companion",
  "trip:update-flight",
]);

const validationContext = { capabilities, snapshot };

function replacementDay(): Extract<
  LumiCommand,
  { type: "update_trip_day" }
>["day"] {
  return {
    day_date: "2026-09-25",
    city: "Milan",
    cities: ["Milan"],
    segments: [],
    note: "Brera day",
    stops: [{
      name: "Pinacoteca di Brera",
      anchor_mode: "exact_place",
      place_name: "Pinacoteca di Brera",
      place_types: [],
      suggestion_count: 5,
      kind: "sight",
      note: "",
      attachments: [],
    }],
  };
}

describe("validateLumiCommand", () => {
  test("rejects a stale day ID even when date and display content match", () => {
    const staleDayCommand: LumiCommand = {
      type: "update_trip_day",
      day_id: "00000000-0000-4000-8000-000000000099",
      day: replacementDay(),
    };

    expect(validateLumiCommand(staleDayCommand, validationContext)).toEqual({
      ok: false,
      code: "invalid_reference",
      field: "day_id",
      message: "The day is not part of the authorized trip snapshot.",
    });
  });

  test("rejects a stop ID from another trip", () => {
    const crossTripStopCommand: LumiCommand = {
      type: "upsert_stop_attachment",
      stop_id: "00000000-0000-4000-8000-000000000098",
      attachment: {
        type: "ticket",
        label: "Pinacoteca di Brera ticket",
        status: "required",
      },
    };

    expect(validateLumiCommand(crossTripStopCommand, validationContext)).toEqual({
      ok: false,
      code: "invalid_reference",
      field: "stop_id",
      message: "The stop is not part of the authorized trip snapshot.",
    });
  });

  test("rejects a command without its required capability", () => {
    const command: LumiCommand = {
      type: "update_trip_day",
      day_id: DAY_ID,
      day: replacementDay(),
    };

    expect(validateLumiCommand(command, {
      capabilities: new Set(),
      snapshot,
    })).toEqual({
      ok: false,
      code: "unauthorized_command",
      field: "type",
      message: "The command is not authorized for this turn.",
    });
  });

  test("accepts exact authorized trip, day, and stop references", () => {
    const commands: LumiCommand[] = [
      { type: "update_trip_day", day_id: DAY_ID, day: replacementDay() },
      { type: "create_trip_day", trip_id: TRIP_ID, day: { ...replacementDay(), day_date: "2026-09-26" } },
      {
        type: "upsert_stop_attachment",
        stop_id: STOP_ID,
        attachment: {
          type: "ticket",
          label: "Pinacoteca di Brera ticket",
          status: "required",
        },
      },
      { type: "update_companion", companion_id: COMPANION_ID, patch: { display_name: "Grace" } },
      { type: "delete_companion", companion_id: COMPANION_ID },
      { type: "create_companion", trip_id: TRIP_ID, companion: { display_name: "Grace" } },
      { type: "update_flight_leg", leg_id: LEG_ID, patch: { gate: "A12" } },
      { type: "create_flight_leg", trip_id: TRIP_ID, leg: { flight_number: "BR95" } },
    ];

    for (const command of commands) {
      expect(validateLumiCommand(command, validationContext)).toEqual({
        ok: true,
        command,
      });
    }
  });

  test("rejects unknown companion and flight references instead of creating or merging", () => {
    expect(validateLumiCommand({
      type: "update_companion",
      companion_id: "00000000-0000-4000-8000-000000000099",
      patch: { display_name: "Grace" },
    }, validationContext)).toMatchObject({ ok: false, field: "companion_id" });
    expect(validateLumiCommand({
      type: "update_flight_leg",
      leg_id: "00000000-0000-4000-8000-000000000098",
      patch: { gate: "A12" },
    }, validationContext)).toMatchObject({ ok: false, field: "leg_id" });
  });

  test("validates real dates and duplicate dates against the evolving command set", () => {
    expect(validateLumiCommand({
      type: "update_trip_day",
      day_id: DAY_ID,
      day: { ...replacementDay(), day_date: "2026-02-30" },
    }, validationContext)).toMatchObject({ ok: false, code: "invalid_command", field: "day.day_date" });

    const accepted: LumiCommand[] = [{
      type: "create_trip_day",
      trip_id: TRIP_ID,
      day: { ...replacementDay(), day_date: "2026-09-26" },
    }];
    expect(validateLumiCommand({
      type: "update_trip_day",
      day_id: DAY_ID,
      day: { ...replacementDay(), day_date: "2026-09-26" },
    }, { ...validationContext, acceptedCommands: accepted })).toMatchObject({
      ok: false,
      code: "conflict",
      field: "day.day_date",
    });
  });

  test("requires a mixed day replacement to retain an attached stop ID in either command order", () => {
    const updateWithoutStop: LumiCommand = {
      type: "update_trip_day",
      day_id: DAY_ID,
      day: { ...replacementDay(), stops: [{ ...replacementDay().stops[0]!, stop_id: undefined }] },
    };
    const attachment: LumiCommand = {
      type: "upsert_stop_attachment",
      stop_id: STOP_ID,
      attachment: { label: "Ticket", type: "ticket", status: "required" },
    };
    expect(validateLumiCommand(attachment, { ...validationContext, acceptedCommands: [updateWithoutStop] })).toMatchObject({ ok: false, code: "conflict" });
    expect(validateLumiCommand(updateWithoutStop, { ...validationContext, acceptedCommands: [attachment] })).toMatchObject({ ok: false, code: "conflict" });
  });
});
