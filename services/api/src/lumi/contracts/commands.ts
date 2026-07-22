import { z } from "zod";

import { lumiDaySchema } from "./snapshot.js";
import { realIsoDateSchema } from "./date.js";

export const stopAttachmentSchema = z.object({
  id: z.string().min(1).max(80).nullish(),
  type: z.string().min(1).max(40).default("ticket"),
  label: z.string().min(1).max(120),
  url: z.string().url().max(1200).nullish(),
  amount: z.string().max(80).nullish(),
  action_label: z.string().max(80).nullish(),
  checklist_text: z.string().max(500).nullish(),
  checklist_description: z.string().max(4000).nullish(),
  checklist_kind: z.string().max(40).nullish(),
  checklist_item_id: z.string().uuid().nullish(),
  status: z.enum(["required", "completed", "uploaded"]).default("required"),
}).strict();

const companionCreateSchema = z.object({
  display_name: z.string().min(1).max(80),
  color: z.string().min(1).max(20).nullish(),
}).strict();

const companionPatchSchema = z.object({
  display_name: z.string().min(1).max(80).nullish(),
  color: z.string().min(1).max(20).nullish(),
}).strict().refine((patch) => Object.values(patch).some((value) => value != null), "At least one field is required.");

export const flightLegValuesSchema = z.object({
  departure_date: realIsoDateSchema.nullish(),
  departure_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  flight_number: z.string().min(1).max(16).nullish(),
  terminal: z.string().min(1).max(24).nullish(),
  gate: z.string().min(1).max(12).nullish(),
}).strict().refine((patch) => Object.values(patch).some((value) => value != null), "At least one flight field is required.");

const retryClaimSchema = z.string().min(1).max(120).nullish();

export const lumiCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update_trip_day"),
    day_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    day: lumiDaySchema,
  }).strict(),
  z.object({
    type: z.literal("create_trip_day"),
    trip_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    day: lumiDaySchema,
  }).strict(),
  z.object({
    type: z.literal("upsert_stop_attachment"),
    stop_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    attachment: stopAttachmentSchema,
  }).strict(),
  z.object({
    type: z.literal("create_companion"),
    trip_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    companion: companionCreateSchema,
  }).strict(),
  z.object({
    type: z.literal("update_companion"),
    companion_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    patch: companionPatchSchema,
  }).strict(),
  z.object({
    type: z.literal("delete_companion"),
    companion_id: z.string().uuid(),
    retry_of: retryClaimSchema,
  }).strict(),
  z.object({
    type: z.literal("create_flight_leg"),
    trip_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    leg: flightLegValuesSchema,
  }).strict(),
  z.object({
    type: z.literal("update_flight_leg"),
    leg_id: z.string().uuid(),
    retry_of: retryClaimSchema,
    patch: flightLegValuesSchema,
  }).strict(),
]);

export type LumiCommand = z.infer<typeof lumiCommandSchema>;
export type CorrelatedLumiCommand = LumiCommand & { attempt_id?: string };

export function lumiCommandTarget(command: LumiCommand): string {
  if (command.type === "update_trip_day") return command.day_id;
  if (command.type === "create_trip_day" || command.type === "create_companion" || command.type === "create_flight_leg") return command.trip_id;
  if (command.type === "upsert_stop_attachment") return command.stop_id;
  if (command.type === "update_companion" || command.type === "delete_companion") return command.companion_id;
  return command.leg_id;
}

export type RejectedLumiCommandAttempt = {
  type: LumiCommand["type"];
  target_id: string | null;
  attempt_id?: string;
  provider_tool_call_id?: string | null;
  status: "rejected";
  code: "invalid_command" | "unauthorized_command" | "invalid_reference";
};
