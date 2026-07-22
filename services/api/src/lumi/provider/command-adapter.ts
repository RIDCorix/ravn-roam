import { z } from "zod";

import { hasGooglePlacesKey, searchGooglePlaceSuggestions } from "../../geocode/google-places.js";
import { authorizationForInput, capabilitiesForTurn, type LumiCapability } from "../capabilities.js";
import { lumiCommandSchema, lumiCommandTarget, type CorrelatedLumiCommand, type LumiCommand, type RejectedLumiCommandAttempt } from "../contracts/commands.js";
import type { LumiDay, LumiFlightDetailsPatch, LumiInput, LumiStagedDayPreview, LumiToolEvent, LumiTripDraft } from "../contracts/result.js";
import type { LumiStop } from "../contracts/values.js";
import { normalizeLumiDayCities } from "../domain/itinerary-values.js";
import type { OpenAIChatToolCall, OpenAIToolDefinition } from "./openai.js";
import {
  ACTION_TOOL_CAPABILITIES,
  COMPANION_VALUES_JSON_SCHEMA,
  CREATE_TRIP_DAY_JSON_SCHEMA,
  SEARCH_PLACES_JSON_SCHEMA,
  STAGE_TRIP_DRAFT_DAYS_JSON_SCHEMA,
  UPDATE_TRIP_DAY_JSON_SCHEMA,
  UPSERT_STOP_ATTACHMENT_JSON_SCHEMA,
  anchorContractIssue,
  dayJsonSchemaWithoutAttachmentEdits,
  exactCommandSchema,
  finalResponseSchemaForCapabilities,
  responseSchema,
  searchPlacesToolSchema,
  setFlightDetailsToolSchema,
  stageTripDraftDaysToolSchema,
} from "./tool-contracts.js";
import { validateLumiCommand } from "../validation/commands.js";
import { normalizeTripDraftCalendar } from "../validation/drafts.js";
import { consumePendingRetry, type PendingLumiRejection } from "./retry-lineage.js";

function dayHasAttachments(day: LumiDay): boolean {
  return (day.stops ?? []).some((stop) => (stop.attachments?.length ?? 0) > 0);
}

function preserveExistingDayAttachments(
  input: LumiInput,
  dayId: string,
  incomingDay: Extract<LumiCommand, { type: "update_trip_day" }>["day"],
):
  | {
      ok: true;
      day: Extract<LumiCommand, { type: "update_trip_day" }>["day"];
    }
  | { ok: false; error: string } {
  const existingDay = input.editableTrip?.days.find(
    (day) => day.day_id === dayId,
  );
  const attachedStops = (existingDay?.stops ?? []).filter(
    (stop) => (stop.attachments?.length ?? 0) > 0,
  );
  if (attachedStops.length === 0) return { ok: true, day: incomingDay };

  const incomingStopsById = new Map<string, LumiStop[]>();
  for (const stop of incomingDay.stops ?? []) {
    const stopId = stop.stop_id?.trim();
    if (!stopId) continue;
    const matches = incomingStopsById.get(stopId) ?? [];
    matches.push(stop);
    incomingStopsById.set(stopId, matches);
  }

  const matchedStopIds = new Set<string>();
  for (const existingStop of attachedStops) {
    const stopId = existingStop.stop_id?.trim();
    const matches = stopId ? incomingStopsById.get(stopId) ?? [] : [];
    if (!stopId || matches.length !== 1 || matchedStopIds.has(stopId)) {
      return {
        ok: false,
        error: "attachment_preservation_requires_stable_stop_identity",
      };
    }
    matchedStopIds.add(stopId);
    matches[0]!.attachments = (existingStop.attachments ?? []).map(
      (attachment) => ({ ...attachment }),
    );
  }

  return { ok: true, day: incomingDay };
}

function sanitizeResponseForCapabilities(
  result: z.infer<typeof responseSchema>,
  capabilities: ReadonlySet<LumiCapability>,
): void {
  result.days = null;
  if (!capabilities.has("trip:edit-companion")) result.companions = null;
  if (!capabilities.has("trip:update-flight")) result.flight_details = null;
  if (!capabilities.has("draft:finalize")) result.trip_draft = null;
  if (!capabilities.has("read:esim")) result.esim_suggestion = null;
}

type LumiToolState = {
  acceptedCommands: CorrelatedLumiCommand[];
  rejectedCommands: RejectedLumiCommandAttempt[];
  pendingRejections: PendingLumiRejection[];
  draftDaysByDate: Map<string, LumiDay>;
  flightDetailsByLegKey: Map<string, LumiFlightDetailsPatch>;
  /* place_ids confirmed this turn via search_places, plus ids already on
     the trip. Any other place_id in the output is treated as invented. */
  verifiedPlaceIds: Set<string>;
};

export function buildLumiToolDefinitions(input: LumiInput): OpenAIToolDefinition[] {
  const tools: OpenAIToolDefinition[] = [];
  const capabilities = capabilitiesForTurn(authorizationForInput(input));
  const daySchema = dayJsonSchemaWithoutAttachmentEdits();
  if (capabilities.has("trip:update-day")) {
    tools.push({
      type: "function",
      function: {
        name: "update_trip_day",
        description:
          "Stage one itinerary day update for the exact persisted day_id from the editable trip snapshot. Attachment edits must use upsert_stop_attachment.",
        strict: true,
        parameters: {
          ...UPDATE_TRIP_DAY_JSON_SCHEMA,
          properties: {
            ...UPDATE_TRIP_DAY_JSON_SCHEMA.properties,
            day: daySchema,
          },
        },
      },
    });
  }
  if (capabilities.has("trip:create-day")) {
    tools.push({
      type: "function",
      function: {
        name: "create_trip_day",
        description:
          "Stage one new itinerary day for the exact persisted trip_id from the editable trip snapshot. Attachment edits must use upsert_stop_attachment.",
        strict: true,
        parameters: {
          ...CREATE_TRIP_DAY_JSON_SCHEMA,
          properties: {
            ...CREATE_TRIP_DAY_JSON_SCHEMA.properties,
            day: daySchema,
          },
        },
      },
    });
  }
  if (capabilities.has("trip:edit-attachment")) {
    tools.push({
      type: "function",
      function: {
        name: "upsert_stop_attachment",
        description:
          "Create or update an attachment on the exact persisted stop_id from the editable trip snapshot.",
        strict: true,
        parameters: UPSERT_STOP_ATTACHMENT_JSON_SCHEMA,
      },
    });
  }
  if (capabilities.has("draft:stage-day")) {
    tools.push({
      type: "function",
      function: {
        name: "stage_trip_draft_days",
        description:
          "Stage one batch of itinerary days for a new trip draft before the final response. Use for long pasted day-by-day manuscripts.",
        strict: true,
        parameters: STAGE_TRIP_DRAFT_DAYS_JSON_SCHEMA,
      },
    });
  }

  if (capabilities.has("read:places") && hasGooglePlacesKey()) {
    tools.push({
      type: "function",
      function: {
        name: "search_places",
        description:
          "Look up real venues on Google Places. Use it to verify a place exists before anchoring it as an exact_place stop, or to discover concrete candidates for a category. Copy place_name and place_id exactly from the results — invented place_ids are dropped by the server.",
        strict: true,
        parameters: SEARCH_PLACES_JSON_SCHEMA,
      },
    });
  }

  if (capabilities.has("trip:update-flight")) {
    tools.push(
      { type: "function", function: { name: "create_flight_leg", description: "Create a new flight leg under the exact current trip_id.", strict: true, parameters: exactCommandSchema("trip_id", "leg") } },
      { type: "function", function: { name: "update_flight_leg", description: "Update the exact existing leg_id from the editable trip snapshot.", strict: true, parameters: exactCommandSchema("leg_id", "patch") } },
    );
  }
  if (capabilities.has("trip:edit-companion")) {
    tools.push(
      { type: "function", function: { name: "create_companion", description: "Create a companion under the exact current trip_id. Do not provide an id.", strict: true, parameters: exactCommandSchema("trip_id", "companion", COMPANION_VALUES_JSON_SCHEMA) } },
      { type: "function", function: { name: "update_companion", description: "Update the exact existing companion_id from the snapshot.", strict: true, parameters: exactCommandSchema("companion_id", "patch", COMPANION_VALUES_JSON_SCHEMA) } },
      { type: "function", function: { name: "delete_companion", description: "Delete the exact existing companion_id from the snapshot.", strict: true, parameters: exactCommandSchema("companion_id") } },
    );
  }

  tools.push({
    type: "function",
    function: {
      name: "lumi_response",
      description:
        "Return Lumi's final natural-language response and any app actions not already staged through earlier tools.",
      strict: true,
      parameters: finalResponseSchemaForCapabilities(capabilities),
    },
  });

  return tools;
}

function parseToolArguments(toolCall: OpenAIChatToolCall): unknown {
  const raw = toolCall.function?.arguments;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __invalid_json: raw.slice(0, 200) };
  }
}

function stagedDayPreview(day: LumiDay): LumiStagedDayPreview {
  return {
    day_date: day.day_date,
    city: day.city,
    cities: normalizeLumiDayCities(day),
    stop_names: (day.stops ?? []).slice(0, 4).map((stop) => stop.name),
    stop_count: day.stops?.length ?? 0,
  };
}

function dayToolAnchorIssue(days: LumiDay[]): string | null {
  return anchorContractIssue({
    summary: "tool",
    days,
    companions: null,
    flight_details: null,
    trip_draft: null,
    esim_suggestion: null,
  } as z.infer<typeof responseSchema>);
}

function mergeFlightDetailPatch(
  existing: LumiFlightDetailsPatch | undefined,
  patch: LumiFlightDetailsPatch,
): LumiFlightDetailsPatch {
  return {
    leg_key: patch.leg_key,
    departure_date:
      patch.departure_date != null
        ? patch.departure_date
        : existing?.departure_date,
    departure_time:
      patch.departure_time != null
        ? patch.departure_time
        : existing?.departure_time,
    flight_number:
      patch.flight_number != null
        ? patch.flight_number.trim().toUpperCase()
        : existing?.flight_number,
    terminal:
      patch.terminal != null
        ? patch.terminal.trim().toUpperCase()
        : existing?.terminal,
    gate:
      patch.gate != null
        ? patch.gate.trim().toUpperCase()
        : existing?.gate,
  };
}

function stageFlightDetails(
  state: LumiToolState,
  patches: LumiFlightDetailsPatch[],
): number {
  for (const patch of patches) {
    const legKey = patch.leg_key.trim();
    if (!legKey) continue;
    state.flightDetailsByLegKey.set(
      legKey,
      mergeFlightDetailPatch(state.flightDetailsByLegKey.get(legKey), {
        ...patch,
        leg_key: legKey,
      }),
    );
  }
  return state.flightDetailsByLegKey.size;
}

function invalidMutationCommand(
  code: "invalid_command" | "unauthorized_command",
  field: string,
  message: string,
  details?: unknown,
): Record<string, unknown> {
  return {
    ok: false,
    code,
    field,
    message,
    ...(details === undefined ? {} : { details }),
  };
}

function invalidMutationSchema(error: z.ZodError): Record<string, unknown> {
  const issue = error.issues[0];
  const field = issue?.path.length ? issue.path.join(".") : "type";
  return invalidMutationCommand(
    "invalid_command",
    field,
    issue ? `Invalid ${field}: ${issue.message}` : "The command payload is invalid.",
    error.flatten(),
  );
}

function rejectedCommandAttempt(
  name: string | undefined,
  attemptId: string,
  args: unknown,
  result: Record<string, unknown>,
  providerToolCallId?: string | null,
): RejectedLumiCommandAttempt | null {
  if (
    result.ok === true ||
    !["update_trip_day", "create_trip_day", "upsert_stop_attachment", "create_companion", "update_companion", "delete_companion", "create_flight_leg", "update_flight_leg"].includes(name ?? "")
  ) {
    return null;
  }
  const values =
    typeof args === "object" && args !== null
      ? (args as Record<string, unknown>)
      : {};
  const target = values.day_id ?? values.trip_id ?? values.stop_id ?? values.companion_id ?? values.leg_id;
  const rawCode = result.code;
  const code =
    rawCode === "unauthorized_command" || rawCode === "invalid_reference"
      ? rawCode
      : "invalid_command";
  return {
    type: name as LumiCommand["type"],
    target_id: typeof target === "string" ? target : null,
    attempt_id: attemptId,
    provider_tool_call_id: providerToolCallId?.trim() || null,
    status: "rejected",
    code,
  };
}

function correlatedAcceptedCommand(
  state: LumiToolState,
  command: LumiCommand,
  iteration: number,
): CorrelatedLumiCommand {
  const attemptId = consumePendingRetry(state.pendingRejections, {
    claimed_attempt_id: command.retry_of,
    type: command.type,
    target_id: lumiCommandTarget(command),
    iteration,
  });
  const { retry_of: _retryClaim, ...accepted } = command;
  return attemptId ? { ...accepted, attempt_id: attemptId } as CorrelatedLumiCommand : accepted as CorrelatedLumiCommand;
}

async function executeLumiActionTool({
  input,
  state,
  toolCall,
  iteration = 1,
}: {
  input: LumiInput;
  state: LumiToolState;
  toolCall: OpenAIChatToolCall;
  iteration?: number;
}): Promise<Record<string, unknown>> {
  const name = toolCall.function?.name;
  const capabilities = capabilitiesForTurn(authorizationForInput(input));
  const isCommandTool =
    ["update_trip_day", "create_trip_day", "upsert_stop_attachment", "create_companion", "update_companion", "delete_companion", "create_flight_leg", "update_flight_leg"].includes(name ?? "");
  const requiredCapabilities = name
    ? ACTION_TOOL_CAPABILITIES[name]
    : undefined;
  if (
    !isCommandTool &&
    requiredCapabilities &&
    !requiredCapabilities.some((capability) => capabilities.has(capability))
  ) {
    return {
      ok: false,
      error: "unauthorized_tool",
      tool: name,
      required_capabilities: requiredCapabilities,
    };
  }
  const args = parseToolArguments(toolCall);

  if (name === "search_places") {
    const parsed = searchPlacesToolSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_search_places",
        details: parsed.error.flatten(),
      };
    }
    const places = await searchGooglePlaceSuggestions(parsed.data.query, {
      city: parsed.data.city ?? null,
      expectedCountry: parsed.data.country_code ?? null,
      maxResultCount: parsed.data.max_results ?? 5,
    }).catch(() => []);
    for (const place of places) {
      if (place.place_id) state.verifiedPlaceIds.add(place.place_id);
    }
    return {
      ok: true,
      action: "search_places",
      result_count: places.length,
      results: places.map((place) => ({
        place_name: place.name,
        place_id: place.place_id,
        address: place.formatted_address,
        lat: place.lat,
        lng: place.lng,
        country_code: place.country_code,
        primary_type: place.primary_type ?? null,
        rating: place.rating ?? null,
        rating_count: place.user_rating_count ?? null,
      })),
    };
  }

  if (name === "set_flight_details") {
    const parsed = setFlightDetailsToolSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_set_flight_details",
        details: parsed.error.flatten(),
      };
    }
    const stagedFlights = stageFlightDetails(
      state,
      parsed.data.flight_details,
    );
    return {
      ok: true,
      action: "set_flight_details",
      staged_flights: stagedFlights,
    };
  }

  if (name === "update_trip_day") {
    const parsed = lumiCommandSchema.safeParse({
      type: name,
      ...(typeof args === "object" && args !== null ? args : {}),
    });
    if (!parsed.success) {
      return invalidMutationSchema(parsed.error);
    }
    const validation = validateLumiCommand(parsed.data, {
      capabilities,
      snapshot: input.editableTrip ?? null,
      acceptedCommands: state.acceptedCommands,
    });
    if (!validation.ok) return validation;
    if (validation.command.type !== "update_trip_day") {
      return invalidMutationCommand(
        "invalid_command",
        "type",
        "The command type does not match the requested tool.",
      );
    }
    const command = validation.command;
    if (dayHasAttachments(command.day)) {
      return invalidMutationCommand(
        "unauthorized_command",
        "day.stops",
        "Inline attachment mutations are not authorized; use upsert_stop_attachment.",
      );
    }
    const attachmentSafeDay = preserveExistingDayAttachments(
      input,
      command.day_id,
      command.day,
    );
    if (!attachmentSafeDay.ok) {
      return invalidMutationCommand(
        "invalid_command",
        "day.stops",
        "Existing attachments require stable stop identity in the replacement day.",
        attachmentSafeDay.error,
      );
    }
    const day = attachmentSafeDay.day;
    const anchorIssue = dayToolAnchorIssue([day]);
    if (anchorIssue) {
      return invalidMutationCommand(
        "invalid_command",
        "day.stops",
        "One or more stops do not satisfy the anchor contract.",
        anchorIssue,
      );
    }
    state.acceptedCommands.push(correlatedAcceptedCommand(state, { ...command, day }, iteration));
    return {
      ok: true,
      action: "update_trip_day",
      target_id: command.day_id,
      day_date: day.day_date,
      staged_days: state.acceptedCommands.filter(
        (candidate) => candidate.type === "update_trip_day",
      ).length,
      days_preview: [stagedDayPreview(day)],
    };
  }

  if (name === "create_trip_day") {
    const parsed = lumiCommandSchema.safeParse({
      type: name,
      ...(typeof args === "object" && args !== null ? args : {}),
    });
    if (!parsed.success) {
      return invalidMutationSchema(parsed.error);
    }
    const validation = validateLumiCommand(parsed.data, {
      capabilities,
      snapshot: input.editableTrip ?? null,
      acceptedCommands: state.acceptedCommands,
    });
    if (!validation.ok) return validation;
    if (validation.command.type !== "create_trip_day") {
      return invalidMutationCommand(
        "invalid_command",
        "type",
        "The command type does not match the requested tool.",
      );
    }
    const command = validation.command;
    if (dayHasAttachments(command.day)) {
      return invalidMutationCommand(
        "unauthorized_command",
        "day.stops",
        "Inline attachment mutations are not authorized; use upsert_stop_attachment.",
      );
    }
    const anchorIssue = dayToolAnchorIssue([command.day]);
    if (anchorIssue) {
      return invalidMutationCommand(
        "invalid_command",
        "day.stops",
        "One or more stops do not satisfy the anchor contract.",
        anchorIssue,
      );
    }
    state.acceptedCommands.push(correlatedAcceptedCommand(state, command, iteration));
    return {
      ok: true,
      action: "create_trip_day",
      target_id: command.trip_id,
      day_date: command.day.day_date,
      staged_days: state.acceptedCommands.filter(
        (candidate) => candidate.type === "create_trip_day",
      ).length,
      days_preview: [stagedDayPreview(command.day)],
    };
  }

  if (name === "upsert_stop_attachment") {
    const parsed = lumiCommandSchema.safeParse({
      type: name,
      ...(typeof args === "object" && args !== null ? args : {}),
    });
    if (!parsed.success) {
      return invalidMutationSchema(parsed.error);
    }
    const validation = validateLumiCommand(parsed.data, {
      capabilities,
      snapshot: input.editableTrip ?? null,
      acceptedCommands: state.acceptedCommands,
    });
    if (!validation.ok) return validation;
    if (validation.command.type !== "upsert_stop_attachment") {
      return invalidMutationCommand(
        "invalid_command",
        "type",
        "The command type does not match the requested tool.",
      );
    }
    state.acceptedCommands.push(correlatedAcceptedCommand(state, validation.command, iteration));
    return {
      ok: true,
      action: "upsert_stop_attachment",
      target_id: validation.command.stop_id,
      stop_id: validation.command.stop_id,
      staged_commands: state.acceptedCommands.length,
    };
  }

  if (["create_companion", "update_companion", "delete_companion", "create_flight_leg", "update_flight_leg"].includes(name ?? "")) {
    const parsed = lumiCommandSchema.safeParse({
      type: name,
      ...(typeof args === "object" && args !== null ? args : {}),
    });
    if (!parsed.success) return invalidMutationSchema(parsed.error);
    const validation = validateLumiCommand(parsed.data, {
      capabilities,
      snapshot: input.editableTrip ?? null,
      acceptedCommands: state.acceptedCommands,
    });
    if (!validation.ok) return validation;
    state.acceptedCommands.push(correlatedAcceptedCommand(state, validation.command, iteration));
    return {
      ok: true,
      action: validation.command.type,
      target_id: lumiCommandTarget(validation.command),
      staged_commands: state.acceptedCommands.length,
    };
  }

  if (name === "stage_trip_draft_days") {
    if (input.editableTrip) {
      return { ok: false, error: "not_in_draft_mode" };
    }
    const parsed = stageTripDraftDaysToolSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_stage_trip_draft_days",
        details: parsed.error.flatten(),
      };
    }
    const anchorIssue = dayToolAnchorIssue(parsed.data.days);
    if (anchorIssue) {
      return {
        ok: false,
        error: "invalid_stop_anchors",
        details: anchorIssue,
      };
    }
    for (const day of parsed.data.days) {
      state.draftDaysByDate.set(day.day_date, day);
    }
    return {
      ok: true,
      action: "stage_trip_draft_days",
      staged_days: state.draftDaysByDate.size,
      days_preview: parsed.data.days.slice(0, 12).map(stagedDayPreview),
    };
  }

  return { ok: false, error: "unknown_tool", tool: name ?? null };
}

function collectStagedDays(
  input: LumiInput,
  state: LumiToolState,
): LumiDay[] | null {
  const commands = state.acceptedCommands.filter(
    (command): command is Extract<LumiCommand, { type: "update_trip_day" }> =>
      command.type === "update_trip_day",
  );
  if (commands.length === 0) return null;
  const lastCommandByDayId = new Map<string, (typeof commands)[number]>();
  for (const command of commands) {
    lastCommandByDayId.set(command.day_id, command);
  }

  const existingOrder = new Map(
    (input.editableTrip?.days ?? []).map((day, index) => [day.day_id, index]),
  );
  return Array.from(lastCommandByDayId.values()).sort((a, b) => {
    const aIndex = existingOrder.get(a.day_id);
    const bIndex = existingOrder.get(b.day_id);
    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
    if (aIndex !== undefined) return -1;
    if (bIndex !== undefined) return 1;
    return a.day_id.localeCompare(b.day_id);
  }).map((command) => command.day);
}

function collectStagedDayCreates(state: LumiToolState): LumiDay[] | null {
  const lastDayByDate = new Map<string, LumiDay>();
  for (const command of state.acceptedCommands) {
    if (command.type === "create_trip_day") {
      lastDayByDate.set(command.day.day_date, command.day);
    }
  }
  if (lastDayByDate.size === 0) return null;
  return Array.from(lastDayByDate.values()).sort((a, b) =>
    a.day_date.localeCompare(b.day_date),
  );
}

function collectStagedDraftDays(state: LumiToolState): LumiDay[] | null {
  if (state.draftDaysByDate.size === 0) return null;
  return Array.from(state.draftDaysByDate.values()).sort((a, b) =>
    a.day_date.localeCompare(b.day_date),
  );
}

function collectStagedFlightDetails(
  state: LumiToolState,
): LumiFlightDetailsPatch[] | null {
  if (state.flightDetailsByLegKey.size === 0) return null;
  return Array.from(state.flightDetailsByLegKey.values());
}

function mergeFlightDetails(
  current: LumiFlightDetailsPatch[] | null | undefined,
  staged: LumiFlightDetailsPatch[],
): LumiFlightDetailsPatch[] {
  const byLegKey = new Map<string, LumiFlightDetailsPatch>();
  for (const item of current ?? []) {
    const legKey = item.leg_key.trim();
    if (!legKey) continue;
    byLegKey.set(legKey, { ...item, leg_key: legKey });
  }
  for (const item of staged) {
    const legKey = item.leg_key.trim();
    if (!legKey) continue;
    byLegKey.set(
      legKey,
      mergeFlightDetailPatch(byLegKey.get(legKey), {
        ...item,
        leg_key: legKey,
      }),
    );
  }
  return Array.from(byLegKey.values());
}

function labelForLumiToolName(name: string): string {
  switch (name) {
    case "update_trip_day":
      return "Updating one itinerary day";
    case "create_trip_day":
      return "Creating one itinerary day";
    case "stage_trip_draft_days":
      return "Drafting itinerary days";
    case "set_flight_details":
      return "Saving flight details";
    case "search_places":
      return "Checking real places";
    case "lumi_response":
      return "Preparing Lumi response";
    default:
      return "Working on itinerary";
  }
}

function labelForLumiToolResult(
  name: string | undefined,
  result: Record<string, unknown>,
): string {
  const stagedDays =
    typeof result.staged_days === "number" ? result.staged_days : null;
  if (name === "stage_trip_draft_days") {
    return stagedDays != null
      ? `Drafted ${stagedDays} itinerary days`
      : "Drafted itinerary days";
  }
  if (name === "update_trip_day") {
    const dayDate = typeof result.day_date === "string" ? result.day_date : null;
    return dayDate ? `Updated ${dayDate}` : "Updated one itinerary day";
  }
  if (name === "create_trip_day") {
    const dayDate = typeof result.day_date === "string" ? result.day_date : null;
    return dayDate ? `Created ${dayDate}` : "Created one itinerary day";
  }
  if (name === "search_places") {
    const count =
      typeof result.result_count === "number" ? result.result_count : null;
    return count != null ? `Found ${count} real places` : "Checked real places";
  }
  if (name === "set_flight_details") {
    const count =
      typeof result.staged_flights === "number" ? result.staged_flights : null;
    return count != null
      ? `Saved ${count} flight detail${count === 1 ? "" : "s"}`
      : "Saved flight details";
  }
  return "Finished itinerary step";
}

function mergeTripDraftDays(
  draft: LumiTripDraft,
  stagedDays: LumiDay[],
): LumiTripDraft {
  const days = [...stagedDays].sort((a, b) =>
    a.day_date.localeCompare(b.day_date),
  );
  return normalizeTripDraftCalendar({
    ...draft,
    start_date: days[0]?.day_date ?? draft.start_date,
    end_date: days.at(-1)?.day_date ?? draft.end_date,
    days,
  });
}

function toolEventFromResult(
  input: LumiInput,
  toolCall: OpenAIChatToolCall,
  result: Record<string, unknown>,
): LumiToolEvent | null {
  const action = result.action;
  if (
    action !== "update_trip_day" &&
    action !== "create_trip_day" &&
    action !== "set_flight_details"
  ) {
    return null;
  }
  const status = result.ok === true ? "success" : "error";
  if (action === "set_flight_details") {
    const flightCount =
      typeof result.staged_flights === "number" ? result.staged_flights : null;
    return {
      event: "tool_result",
      tool_name: action,
      tool_call_id: toolCall.id ?? null,
      status,
      flight_count: flightCount,
      label:
        flightCount != null
          ? `Saved ${flightCount} flight detail${flightCount === 1 ? "" : "s"}`
          : "Saved flight details",
    };
  }
  const dayDate = typeof result.day_date === "string" ? result.day_date : null;
  const dayIndex = dayDate
    ? (input.editableTrip?.days.findIndex((day) => day.day_date === dayDate) ?? -1) + 1
    : null;
  const dayCount = typeof result.staged_days === "number" ? result.staged_days : null;
  return {
    event: "tool_result",
    tool_name: action,
    tool_call_id: toolCall.id ?? null,
    status,
    target_id: typeof result.target_id === "string" ? result.target_id : null,
    day_date: dayDate,
    day_index: dayIndex != null && dayIndex > 0 ? dayIndex : null,
    day_count: dayCount,
    label: action === "create_trip_day"
      ? dayDate ? `Created ${dayDate}` : "Created one day"
      : dayIndex != null && dayIndex > 0 ? `Updated Day ${dayIndex}` : "Updated one day",
  };
}

export {
  collectStagedDayCreates,
  collectStagedDays,
  collectStagedDraftDays,
  collectStagedFlightDetails,
  executeLumiActionTool,
  labelForLumiToolName,
  labelForLumiToolResult,
  mergeFlightDetails,
  mergeTripDraftDays,
  parseToolArguments,
  rejectedCommandAttempt,
  sanitizeResponseForCapabilities,
  toolEventFromResult,
};
export type { LumiToolState };
