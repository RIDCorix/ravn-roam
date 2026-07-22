import { describe, expect, test } from "vitest";

import { lumiCommandSchema } from "./commands.js";

describe("lumiCommandSchema", () => {
  test("rejects unknown fields at every mutation object boundary", () => {
    const update = {
      type: "update_trip_day",
      day_id: "00000000-0000-4000-8000-000000000002",
      extra: true,
      day: {
        day_date: "2026-09-27",
        city: "Milan",
        note: "Design day",
        stops: [{
          name: "Brera",
          place_name: "Pinacoteca di Brera",
          unknown: true,
        }],
      },
    };
    expect(lumiCommandSchema.safeParse(update).success).toBe(false);
    delete (update as { extra?: boolean }).extra;
    expect(lumiCommandSchema.safeParse(update).success).toBe(false);
  });

  test("requires day_id for an existing-day replacement", () => {
    expect(
      lumiCommandSchema.safeParse({
        type: "update_trip_day",
        day: { day_date: "2026-09-27", city: "Milan", note: "", stops: [] },
      }).success,
    ).toBe(false);
  });

  test("requires stop_id for an attachment mutation", () => {
    expect(
      lumiCommandSchema.safeParse({
        type: "upsert_stop_attachment",
        attachment: { type: "ticket", label: "Museum ticket" },
      }).success,
    ).toBe(false);
  });

  test("accepts a command with its stable resource identity", () => {
    expect(
      lumiCommandSchema.safeParse({
        type: "update_trip_day",
        day_id: "00000000-0000-4000-8000-000000000002",
        day: {
          day_date: "2026-09-27",
          city: "Milan",
          note: "Design day",
          stops: [],
        },
      }).success,
    ).toBe(true);
  });

  test("uses discriminated exact-reference commands for companions and flights", () => {
    const tripId = "00000000-0000-4000-8000-000000000001";
    const companionId = "00000000-0000-4000-8000-000000000004";
    const legId = "00000000-0000-4000-8000-000000000005";
    for (const command of [
      { type: "create_companion", trip_id: tripId, companion: { display_name: "Ada" } },
      { type: "update_companion", companion_id: companionId, patch: { color: "#123456" } },
      { type: "delete_companion", companion_id: companionId },
      { type: "create_flight_leg", trip_id: tripId, leg: { flight_number: "BR88" } },
      { type: "update_flight_leg", leg_id: legId, patch: { terminal: "T1" } },
    ]) {
      expect(lumiCommandSchema.safeParse(command).success).toBe(true);
    }
    expect(lumiCommandSchema.safeParse({
      type: "create_companion",
      trip_id: tripId,
      companion: { id: companionId, display_name: "Ada" },
    }).success).toBe(false);
    expect(lumiCommandSchema.safeParse({
      type: "update_flight_leg",
      leg_key: "outbound",
      patch: { gate: "A12" },
    }).success).toBe(false);
  });

  test("rejects impossible non-null flight departure dates", () => {
    expect(lumiCommandSchema.safeParse({
      type: "create_flight_leg",
      trip_id: "00000000-0000-4000-8000-000000000001",
      leg: { departure_date: "2026-02-30", flight_number: "BR88" },
    }).success).toBe(false);
  });
});
