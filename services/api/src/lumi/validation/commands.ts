import type { LumiCapability } from "../capabilities.js";
import type { LumiCommand } from "../contracts/commands.js";
import type { EditableTripSnapshot } from "../contracts/snapshot.js";
import { isRealIsoDate } from "../contracts/date.js";

export interface LumiCommandValidationContext {
  capabilities: ReadonlySet<LumiCapability>;
  snapshot: EditableTripSnapshot | null;
  acceptedCommands?: readonly LumiCommand[];
}

export type LumiCommandValidation =
  | { ok: true; command: LumiCommand }
  | {
      ok: false;
      code: "unauthorized_command" | "invalid_reference" | "invalid_command" | "conflict";
      field: "type" | "trip_id" | "day_id" | "stop_id" | "companion_id" | "leg_id" | "day.day_date" | "day.stops.stop_id";
      message: string;
    };

const COMMAND_CAPABILITY: Record<LumiCommand["type"], LumiCapability> = {
  update_trip_day: "trip:update-day",
  create_trip_day: "trip:create-day",
  upsert_stop_attachment: "trip:edit-attachment",
  create_companion: "trip:edit-companion",
  update_companion: "trip:edit-companion",
  delete_companion: "trip:edit-companion",
  create_flight_leg: "trip:update-flight",
  update_flight_leg: "trip:update-flight",
};

export function validateLumiCommand(
  command: LumiCommand,
  context: LumiCommandValidationContext,
): LumiCommandValidation {
  if (!context.capabilities.has(COMMAND_CAPABILITY[command.type])) {
    return {
      ok: false,
      code: "unauthorized_command",
      field: "type",
      message: "The command is not authorized for this turn.",
    };
  }

  const snapshot = context.snapshot;
  const acceptedCommands = context.acceptedCommands ?? [];
  if ((command.type === "update_trip_day" || command.type === "create_trip_day") && !isRealIsoDate(command.day.day_date)) {
    return { ok: false, code: "invalid_command", field: "day.day_date", message: "The day date is not a real calendar date." };
  }
  if (command.type === "create_trip_day") {
    if (!snapshot || command.trip_id !== snapshot.trip_id) {
      return {
        ok: false,
        code: "invalid_reference",
        field: "trip_id",
        message: "The trip is not the authorized trip snapshot.",
      };
    }
    if (command.day.stops.some((stop) => stop.stop_id)) {
      return { ok: false, code: "invalid_reference", field: "day.stops.stop_id", message: "New days cannot reference existing stops." };
    }
  } else if (command.type === "update_trip_day") {
    const targetDay = snapshot?.days.find((day) => day.day_id === command.day_id);
    if (!targetDay) {
      return {
        ok: false,
        code: "invalid_reference",
        field: "day_id",
        message: "The day is not part of the authorized trip snapshot.",
      };
    }
    const targetStopIds = new Set(targetDay.stops.map((stop) => stop.stop_id));
    if (command.day.stops.some((stop) => stop.stop_id && !targetStopIds.has(stop.stop_id))) {
      return { ok: false, code: "invalid_reference", field: "day.stops.stop_id", message: "A retained stop is not part of the updated day." };
    }
    const attachmentTargets = acceptedCommands.flatMap((accepted) =>
      accepted.type === "upsert_stop_attachment" && targetStopIds.has(accepted.stop_id) ? [accepted.stop_id] : [],
    );
    if (attachmentTargets.some((stopId) => !command.day.stops.some((stop) => stop.stop_id === stopId))) {
      return { ok: false, code: "conflict", field: "day.stops.stop_id", message: "A same-turn attachment target must retain its exact stop ID." };
    }
  } else if (command.type === "upsert_stop_attachment" &&
    !snapshot?.days.some((day) =>
      day.stops.some((stop) => stop.stop_id === command.stop_id),
    )
  ) {
    return {
      ok: false,
      code: "invalid_reference",
      field: "stop_id",
      message: "The stop is not part of the authorized trip snapshot.",
    };
  } else if (command.type === "upsert_stop_attachment") {
    const ownerDay = snapshot?.days.find((day) => day.stops.some((stop) => stop.stop_id === command.stop_id));
    const latestUpdate = [...acceptedCommands].reverse().find((accepted) => accepted.type === "update_trip_day" && accepted.day_id === ownerDay?.day_id);
    if (latestUpdate?.type === "update_trip_day" && !latestUpdate.day.stops.some((stop) => stop.stop_id === command.stop_id)) {
      return { ok: false, code: "conflict", field: "day.stops.stop_id", message: "A same-turn attachment target must retain its exact stop ID." };
    }
  } else if (command.type === "update_companion" || command.type === "delete_companion") {
    if (!snapshot?.companions.some((companion) => companion.id === command.companion_id)) {
      return { ok: false, code: "invalid_reference", field: "companion_id", message: "The companion is not part of the authorized trip snapshot." };
    }
  } else if (command.type === "update_flight_leg") {
    if (!snapshot?.flight_legs?.some((leg) => leg.leg_id === command.leg_id)) {
      return { ok: false, code: "invalid_reference", field: "leg_id", message: "The flight leg is not part of the authorized trip snapshot." };
    }
  } else if ((command.type === "create_companion" || command.type === "create_flight_leg") && (!snapshot || command.trip_id !== snapshot.trip_id)) {
    return { ok: false, code: "invalid_reference", field: "trip_id", message: "The trip is not the authorized trip snapshot." };
  }

  if (command.type === "update_trip_day" || command.type === "create_trip_day") {
    const occupied = new Map(snapshot?.days.map((day) => [day.day_date, day.day_id]) ?? []);
    for (const accepted of acceptedCommands) {
      if (accepted.type === "update_trip_day") {
        for (const [date, id] of occupied) if (id === accepted.day_id) occupied.delete(date);
        occupied.set(accepted.day.day_date, accepted.day_id);
      } else if (accepted.type === "create_trip_day") {
        occupied.set(accepted.day.day_date, `create:${accepted.trip_id}`);
      }
    }
    if (command.type === "update_trip_day") {
      for (const [date, id] of occupied) if (id === command.day_id) occupied.delete(date);
    }
    if (occupied.has(command.day.day_date)) {
      return { ok: false, code: "conflict", field: "day.day_date", message: "Another day already uses this calendar date." };
    }
  }

  return { ok: true, command };
}
