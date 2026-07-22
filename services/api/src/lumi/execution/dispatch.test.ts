import { describe, expect, test, vi } from "vitest";

import type { LumiCommand } from "../contracts/commands.js";
import { executeLumiCommands } from "./dispatch.js";

const day = {
  day_date: "2026-09-27",
  city: "Milan",
  cities: ["Milan"],
  segments: [],
  note: "",
  stops: [],
};
const dayCommand: LumiCommand = {
  type: "update_trip_day",
  day_id: "00000000-0000-4000-8000-000000000002",
  day,
};
const attachmentCommand: LumiCommand = {
  type: "upsert_stop_attachment",
  stop_id: "00000000-0000-4000-8000-000000000003",
  attachment: { label: "Ticket", type: "ticket", status: "required" },
};

describe("executeLumiCommands", () => {
  for (const commands of [
    [dayCommand, attachmentCommand],
    [attachmentCommand, dayCommand],
  ]) {
    test(`executes day replacement before attachment for input order ${commands[0]!.type}`, async () => {
      const calls: string[] = [];
      const executeItinerary = vi.fn(async (command: LumiCommand) => {
        calls.push(command.type);
        return { type: command.type, status: "success" as const, target_id: dayCommand.day_id };
      });
      const executeAttachment = vi.fn(async (command: LumiCommand) => {
        calls.push(command.type);
        return { type: command.type, status: "success" as const, target_id: attachmentCommand.stop_id };
      });
      const outcomes = await executeLumiCommands({
        commands,
        userId: "user-1",
        tripId: "00000000-0000-4000-8000-000000000001",
        executors: { executeItinerary, executeAttachment },
      });
      expect(calls).toEqual(["update_trip_day", "upsert_stop_attachment"]);
      expect(outcomes.map((outcome) => outcome.type)).toEqual(commands.map((command) => command.type));
    });
  }

  test("propagates accepted command attempt IDs into execution outcomes", async () => {
    const command = { ...dayCommand, attempt_id: "attempt-1" };
    const outcomes = await executeLumiCommands({
      commands: [command], userId: "user-1", tripId: "00000000-0000-4000-8000-000000000001",
      executors: { executeItinerary: async () => ({ type: "update_trip_day", status: "success", target_id: dayCommand.day_id }) },
    });
    expect(outcomes[0]?.attempt_id).toBe("attempt-1");
  });
});
