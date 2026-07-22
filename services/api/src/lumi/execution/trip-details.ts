import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import schema from "../../db/schema/index.js";
import type { LumiCommand } from "../contracts/commands.js";
import { flightLegStorageKey } from "../contracts/flights.js";
import type { ExecutedLumiCommand } from "./itinerary.js";

type DetailCommand = Exclude<LumiCommand, { type: "update_trip_day" | "create_trip_day" | "upsert_stop_attachment" }>;
type Context = { userId: string; tripId: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function flightValues(values: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  if ("departure_date" in values) next.departureDate = values.departure_date;
  if ("departure_time" in values) next.departureTime = values.departure_time;
  if ("flight_number" in values) next.flightNumber = typeof values.flight_number === "string" ? values.flight_number.trim().toUpperCase() : values.flight_number;
  if ("terminal" in values) next.terminal = typeof values.terminal === "string" ? values.terminal.trim().toUpperCase() : values.terminal;
  if ("gate" in values) next.gate = typeof values.gate === "string" ? values.gate.trim().toUpperCase() : values.gate;
  return next;
}

export async function executeTripDetailCommand(command: DetailCommand, context: Context): Promise<ExecutedLumiCommand> {
  const targetId = command.type === "create_companion" || command.type === "create_flight_leg"
    ? command.trip_id
    : command.type === "update_companion" || command.type === "delete_companion"
      ? command.companion_id
      : command.leg_id;
  const db = getDb();
  try {
    const [trip] = await db.select().from(schema.trip).where(and(eq(schema.trip.id, context.tripId), eq(schema.trip.userId, context.userId))).limit(1);
    if (!trip) return { type: command.type, status: "error", target_id: targetId, code: "invalid_reference" };
    if ((command.type === "create_companion" || command.type === "create_flight_leg") && command.trip_id !== trip.id) {
      return { type: command.type, status: "error", target_id: targetId, code: "invalid_reference" };
    }
    if (command.type === "create_companion") {
      const rows = await db.select({ sortOrder: schema.tripCompanion.sortOrder }).from(schema.tripCompanion).where(eq(schema.tripCompanion.tripId, trip.id)).orderBy(asc(schema.tripCompanion.sortOrder));
      const [created] = await db.insert(schema.tripCompanion).values({ tripId: trip.id, displayName: command.companion.display_name, color: command.companion.color ?? "#0FB8B4", sortOrder: (rows.at(-1)?.sortOrder ?? -1) + 1 }).returning({ id: schema.tripCompanion.id });
      if (!created) throw new Error("companion_insert_failed");
      return { type: command.type, status: "success", target_id: created.id, request_target_id: command.trip_id };
    }
    if (command.type === "update_companion" || command.type === "delete_companion") {
      const [companion] = await db.select({ id: schema.tripCompanion.id }).from(schema.tripCompanion).where(and(eq(schema.tripCompanion.id, command.companion_id), eq(schema.tripCompanion.tripId, trip.id))).limit(1);
      if (!companion) return { type: command.type, status: "error", target_id: targetId, code: "invalid_reference" };
      if (command.type === "delete_companion") {
        await db.transaction(async (tx) => {
          await tx.update(schema.tripChecklistItem).set({ assignedCompanionId: null }).where(eq(schema.tripChecklistItem.assignedCompanionId, companion.id));
          await tx.delete(schema.tripCompanion).where(and(eq(schema.tripCompanion.id, companion.id), eq(schema.tripCompanion.tripId, trip.id)));
        });
      } else {
        await db.update(schema.tripCompanion).set({
          ...(command.patch.display_name ? { displayName: command.patch.display_name } : {}),
          ...(command.patch.color ? { color: command.patch.color } : {}),
          updatedAt: new Date(),
        }).where(and(eq(schema.tripCompanion.id, companion.id), eq(schema.tripCompanion.tripId, trip.id)));
      }
      return { type: command.type, status: "success", target_id: targetId };
    }
    const metadata = asRecord(trip.metadata);
    const planning = asRecord(metadata.planning);
    const flightLegs = { ...asRecord(planning.flight_legs) };
    if (command.type === "create_flight_leg") {
      const id = randomUUID();
      flightLegs[id] = flightValues(command.leg);
      await db.update(schema.trip).set({ metadata: { ...metadata, planning: { ...planning, flight_legs: flightLegs } }, updatedAt: new Date() }).where(and(eq(schema.trip.id, trip.id), eq(schema.trip.userId, context.userId)));
      return { type: command.type, status: "success", target_id: id, request_target_id: command.trip_id };
    }
    const storageKey = flightLegStorageKey(trip.id, metadata, command.leg_id);
    if (!storageKey) return { type: command.type, status: "error", target_id: targetId, code: "invalid_reference" };
    const legacy = { ...asRecord(planning.exploration_flight_details) };
    const target = storageKey in flightLegs ? flightLegs : legacy;
    target[storageKey] = { ...asRecord(target[storageKey]), ...flightValues(command.patch) };
    await db.update(schema.trip).set({ metadata: { ...metadata, planning: { ...planning, flight_legs: flightLegs, exploration_flight_details: legacy } }, updatedAt: new Date() }).where(and(eq(schema.trip.id, trip.id), eq(schema.trip.userId, context.userId)));
    return { type: command.type, status: "success", target_id: targetId };
  } catch {
    return { type: command.type, status: "error", target_id: targetId, code: "execution_failed" };
  }
}
