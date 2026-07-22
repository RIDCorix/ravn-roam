// Lumi → OpenAI. One entry point: runLumiTurn(input).
//
// The function does two related things:
//
//   1. If `editableTrip` is supplied (user is on a trip page), Lumi MAY
//      return a new `days` list to rewrite the itinerary. The route
//      layer is responsible for persisting it.
//
//   2. Otherwise, Lumi just answers the user with `summary`. Page
//      context (active trip, active eSIM, today's tasks) is folded into
//      a system message so even off-trip pages get useful answers.

import { z } from "zod";

import { env } from "../env.js";
import {
  hasGooglePlacesKey,
  searchGooglePlaceSuggestions,
} from "../geocode/google-places.js";
import {
  authorizationForInput,
  capabilitiesForTurn,
} from "./capabilities.js";
import type { LumiCapability } from "./capabilities.js";
import { lumiCommandSchema, lumiCommandTarget } from "./contracts/commands.js";
import type {
  LumiCommand,
  RejectedLumiCommandAttempt,
} from "./contracts/commands.js";
import type { LumiRequestMode } from "./contracts/request.js";
import { lumiDaySchema as lumiDayContractSchema } from "./contracts/snapshot.js";
import type { EditableTripSnapshot } from "./contracts/snapshot.js";
import type { LumiCity, LumiCompanion, LumiStop, LumiStopAttachment } from "./contracts/values.js";
import type { LumiDay, LumiFlightDetailsPatch, LumiInput, LumiProgressEvent, LumiResult, LumiStagedDayPreview, LumiToolEvent, LumiTripDraft } from "./contracts/result.js";
import { serializeLumiContext } from "./context.js";
import type { LumiPageContext } from "./context.js";
import {
  buildPlanningContract as buildStructuredPlanningContract,
  buildSystemPrompt,
  selectSkillIdsForTurn as selectStructuredSkillIdsForTurn,
} from "./prompts.js";
import { requestOpenAiChatCompletion } from "./provider/openai.js";
import type {
  OpenAIChatMessage,
  OpenAIChatToolCall,
  OpenAIToolDefinition,
} from "./provider/openai.js";
import {
  MAX_LUMI_TOOL_ITERATIONS,
  runOpenAiToolLoop,
} from "./provider/tool-loop.js";
import { validateLumiCommand } from "./validation/commands.js";
import { normalizeTripDraftCalendar, stagedDraftIssue } from "./validation/drafts.js";
import { normalizeLumiDayCities } from "./domain/itinerary-values.js";
import {
  ACTION_TOOL_CAPABILITIES,
  CREATE_TRIP_DAY_JSON_SCHEMA,
  COMPANION_VALUES_JSON_SCHEMA,
  SEARCH_PLACES_JSON_SCHEMA,
  STAGE_TRIP_DRAFT_DAYS_JSON_SCHEMA,
  UPDATE_TRIP_DAY_JSON_SCHEMA,
  UPSERT_STOP_ATTACHMENT_JSON_SCHEMA,
  anchorContractIssue,
  dayJsonSchemaWithoutAttachmentEdits,
  exactCommandSchema,
  finalResponseSchemaForCapabilities,
  flightRouteContractIssue,
  lumiDayListAnchorIssue,
  normalizeAreaSuggestionAnchors,
  responseSchema,
  searchPlacesToolSchema,
  setFlightDetailsToolSchema,
  stageTripDraftDaysToolSchema,
  stripUnverifiedStopPlaceIds,
} from "./provider/tool-contracts.js";
import {
  buildLumiToolDefinitions,
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
  type LumiToolState,
} from "./provider/command-adapter.js";
import { registerPendingRejection, serverAttemptId } from "./provider/retry-lineage.js";

export type { LumiPageContext } from "./context.js";
export type { LumiCity, LumiCompanion, LumiStop, LumiStopAttachment } from "./contracts/values.js";
export type { LumiDay, LumiFlightDetailsPatch, LumiInput, LumiProgressEvent, LumiResult, LumiStagedDayPreview, LumiToolEvent, LumiTripDraft } from "./contracts/result.js";
export { normalizeTripDraftCalendar } from "./validation/drafts.js";
export { normalizeLumiDayCities } from "./domain/itinerary-values.js";
export { lumiDayListAnchorIssue, stripUnverifiedStopPlaceIds } from "./provider/tool-contracts.js";
export { LUMI_DAY_JSON_SCHEMA, lumiDaySchema } from "./provider/tool-contracts.js";
export { buildLumiToolDefinitions } from "./provider/command-adapter.js";

function promptInputFor(
  input: LumiInput,
  capabilities = capabilitiesForTurn(authorizationForInput(input)),
) {
  return {
    mode: input.requestedSkill ?? null,
    capabilities,
    snapshot: input.editableTrip ?? null,
  };
}

export function buildPlanningContract(input: LumiInput): string | null {
  return buildStructuredPlanningContract(promptInputFor(input));
}

export function selectSkillIdsForTurn(input: LumiInput) {
  return selectStructuredSkillIdsForTurn(promptInputFor(input));
}

export async function runLumiTurn(input: LumiInput): Promise<LumiResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the API service — set it in services/api/.env.",
    );
  }

  const turnCapabilities = capabilitiesForTurn(authorizationForInput(input));

  const turnPromptInput = promptInputFor(input, turnCapabilities);
  const history = (input.history ?? []).slice(-12);
  const { prompt: systemPrompt, skillIds } = buildSystemPrompt(turnPromptInput);
  const planningContract = buildStructuredPlanningContract(turnPromptInput);
  const planningMode = turnCapabilities.has("trip:update-day");

  const tools = buildLumiToolDefinitions(input);
  const messages: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: serializeLumiContext({
        snapshot: input.editableTrip ?? null,
        page: input.context,
      }),
    },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    ...(planningContract
      ? [{ role: "system" as const, content: planningContract }]
      : []),
    { role: "user", content: input.prompt },
  ];
  const toolState: LumiToolState = {
    acceptedCommands: [],
    rejectedCommands: [],
    pendingRejections: [],
    draftDaysByDate: new Map(),
    flightDetailsByLegKey: new Map(),
    verifiedPlaceIds: new Set(
      (input.editableTrip?.days ?? []).flatMap((day) =>
        (day.stops ?? []).flatMap((stop) =>
          stop.place_id ? [stop.place_id] : [],
        ),
      ),
    ),
  };
  const toolEvents: LumiToolEvent[] = [];
  let lastDraftIssue: string | null = null;

  const loopResult = await runOpenAiToolLoop<
    z.infer<typeof responseSchema>,
    Record<string, unknown>
  >({
    messages,
    tools,
    finalToolName: "lumi_response",
    requestCompletion: async (request) => {
      const startedAt = Date.now();
      const message = await requestOpenAiChatCompletion({
        apiKey: env.OPENAI_API_KEY!,
        model: env.OPENAI_MODEL,
        ...request,
        onProgress: input.onProgress,
        labelForToolName: labelForLumiToolName,
      });
      const toolNames =
        message?.tool_calls?.map(
          (call) => call.function?.name ?? "unknown",
        ) ?? [];
      console.log(
        `[lumi] openai iteration=${request.iteration}/${MAX_LUMI_TOOL_ITERATIONS} ` +
          `tool_calls=${toolNames.join(",") || "none"} ` +
          `ms=${Date.now() - startedAt}`,
      );
      return message;
    },
    dispatchTool: async (toolCall, iteration) => {
      const attemptId = serverAttemptId();
      const toolResult = await executeLumiActionTool({
        input,
        state: toolState,
        toolCall,
        iteration,
      });
      return toolResult.ok === true
        ? toolResult
        : {
            ...toolResult,
            attempt_id: attemptId,
            retry_instruction:
              "For a corrected retry in the next iteration, echo this attempt_id in retry_of.",
          };
    },
    onToolResult: async (call, toolResult, iteration) => {
      const name = call.function?.name;
      const rejection = rejectedCommandAttempt(
        name,
        typeof toolResult.attempt_id === "string"
          ? toolResult.attempt_id
          : serverAttemptId(),
        parseToolArguments(call),
        toolResult,
        call.id,
      );
      if (rejection) {
        toolState.rejectedCommands.push(rejection);
        registerPendingRejection(toolState.pendingRejections, {
          attempt_id: rejection.attempt_id!,
          type: rejection.type,
          target_id: rejection.target_id,
          rejected_iteration: iteration,
        });
      }
      const event = toolEventFromResult(input, call, toolResult);
      if (
        event &&
        !(
          event.tool_name === "set_flight_details" &&
          toolEvents.some(
            (existing) => existing.tool_name === "set_flight_details",
          )
        )
      ) {
        toolEvents.push(event);
      }
      await input.onProgress?.({
        event: "tool_result",
        tool_name: name ?? "unknown_tool",
        status: toolResult.ok === true ? "success" : "error",
        label: labelForLumiToolResult(name, toolResult),
        iteration,
        staged_days:
          typeof toolResult.staged_days === "number"
            ? toolResult.staged_days
            : null,
        days_preview: Array.isArray(toolResult.days_preview)
          ? (toolResult.days_preview as LumiStagedDayPreview[])
          : null,
      });
    },
    validatePlainText: (content, { iteration, isLastIteration }) => {
      const draftIssue = turnCapabilities.has("draft:finalize")
        ? stagedDraftIssue(
            null,
            Array.from(toolState.draftDaysByDate.values()),
          )
        : null;
      if (draftIssue) {
        lastDraftIssue = draftIssue;
        if (isLastIteration) throw incompleteStructuredDraftError(draftIssue);
        return {
          status: "retry",
          correction: incompleteStructuredDraftRetryMessage(draftIssue),
          forcedToolName:
            iteration < MAX_LUMI_TOOL_ITERATIONS - 1
              ? "stage_trip_draft_days"
              : null,
        };
      }
      return {
        status: "accept",
        value: {
          summary: content,
          days: null,
          companions: null,
          flight_details: null,
          trip_draft: null,
          esim_suggestion: null,
        },
      };
    },
    validateFinal: (content, { iteration, isLastIteration }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error(
          `OpenAI returned non-JSON tool arguments: ${content.slice(0, 200)}`,
        );
      }
      const candidate = responseSchema.safeParse(parsed);
      if (!candidate.success) {
        throw new Error(
          `OpenAI response failed schema validation: ${candidate.error.message}`,
        );
      }
      sanitizeResponseForCapabilities(candidate.data, turnCapabilities);
      normalizeAreaSuggestionAnchors(candidate.data);
      if (hasGooglePlacesKey()) {
        stripUnverifiedStopPlaceIds(candidate.data, toolState.verifiedPlaceIds);
      }
      const strictAnchorIssue = anchorContractIssue(candidate.data);
      const anchorIssue =
        strictAnchorIssue ?? flightRouteContractIssue(candidate.data);
      if (anchorIssue && !isLastIteration) {
        return {
          status: "retry",
          correction: {
            role: "system",
            content:
              "Previous Lumi response rejected before app output: " +
              anchorIssue,
          },
        };
      }
      if (strictAnchorIssue) {
        throw new Error(
          `OpenAI returned invalid stop anchors: ${strictAnchorIssue}`,
        );
      }
      if (anchorIssue) {
        console.warn(`[lumi] soft contract unmet after retries: ${anchorIssue}`);
      }

      const draftIssue = turnCapabilities.has("draft:finalize")
        ? stagedDraftIssue(
            candidate.data.trip_draft,
            Array.from(toolState.draftDaysByDate.values()),
          )
        : null;
      if (draftIssue && !isLastIteration) {
        lastDraftIssue = draftIssue;
        return {
          status: "retry",
          correction: incompleteStructuredDraftRetryMessage(draftIssue),
          forcedToolName:
            iteration < MAX_LUMI_TOOL_ITERATIONS - 1
              ? "stage_trip_draft_days"
              : null,
        };
      }
      if (draftIssue) throw incompleteStructuredDraftError(draftIssue);
      return { status: "accept", value: candidate.data };
    },
    finalError: () => {
      if (turnCapabilities.has("draft:finalize")) {
        const issue =
          lastDraftIssue ??
          stagedDraftIssue(
            null,
            Array.from(toolState.draftDaysByDate.values()),
          ) ??
          "Structured trip draft staging did not reach a final Lumi response.";
        return incompleteStructuredDraftError(issue);
      }
      return new Error("OpenAI did not produce a final Lumi response");
    },
  });

  const parsed: unknown = loopResult.value;
  const toolCall = loopResult.finalToolCall;

  const parsedResult = responseSchema.safeParse(parsed);
  if (!parsedResult.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${parsedResult.error.message}`,
    );
  }
  const result = parsedResult.data;
  sanitizeResponseForCapabilities(result, turnCapabilities);
  const stagedDays = collectStagedDays(input, toolState);
  if (stagedDays) {
    result.days = stagedDays as NonNullable<typeof result.days>;
  }
  const stagedDayCreates = collectStagedDayCreates(toolState);
  const stagedDraftDays = collectStagedDraftDays(toolState);
  if (stagedDraftDays) {
    result.trip_draft = mergeTripDraftDays(
      result.trip_draft ?? tripDraftFromLooseDays(stagedDraftDays),
      stagedDraftDays,
    ) as NonNullable<typeof result.trip_draft>;
  }
  const stagedFlightDetails = collectStagedFlightDetails(toolState);
  if (stagedFlightDetails) {
    const nextFlightDetails = mergeFlightDetails(
      result.flight_details,
      stagedFlightDetails,
    );
    result.flight_details = nextFlightDetails;
    if (result.trip_draft) {
      result.trip_draft = {
        ...result.trip_draft,
        flight_details: mergeFlightDetails(
          result.trip_draft.flight_details,
          stagedFlightDetails,
        ),
      };
    }
  }
  if (hasGooglePlacesKey()) {
    stripUnverifiedStopPlaceIds(result, toolState.verifiedPlaceIds);
  }
  normalizeAreaSuggestionAnchors(result);
  const resultAnchorIssue = anchorContractIssue(result);
  if (resultAnchorIssue) {
    throw new Error(`OpenAI returned invalid stop anchors: ${resultAnchorIssue}`);
  }
  const rawToolCall: NonNullable<LumiResult["tool_call"]> = {
    id: toolCall?.id ?? null,
    name: "lumi_response",
    arguments: parsed,
  };

  /* Dev visibility — tells us at a glance whether the model actually
     emitted structured payloads or just summary text. Keep terse so the
     log line is greppable. */
  console.log(
    `[lumi] turn editor=${!!input.editableTrip} planning=${planningMode} ` +
      `skills=${skillIds.join(",") || "none"} ` +
      `days=${result.days?.length ?? "null"} ` +
      `companions=${result.companions?.length ?? "null"} ` +
      `flights=${result.flight_details?.length ?? "null"} ` +
      `draft=${result.trip_draft ? "yes" : "no"} ` +
      `summary=${JSON.stringify(result.summary.slice(0, 60))}`,
  );

  if (result.days) {
    // Safety: editor mode requires an editable trip in the input. If
    // Lumi tries to emit days without it, surface them as a draft instead
    // of leaving the user with a "planned" summary and no visible trip.
    if (!input.editableTrip) {
      result.trip_draft ??= tripDraftFromLooseDays(
        result.days,
      ) as NonNullable<typeof result.trip_draft>;
      delete result.days;
    } else {
      for (let i = 1; i < result.days.length; i++) {
        if (result.days[i]!.day_date <= result.days[i - 1]!.day_date) {
          throw new Error("OpenAI returned non-chronological day list");
        }
      }
    }
  }
  if (result.companions && !input.editableTrip) {
    delete result.companions;
  }
  if (result.trip_draft) {
    /* No regex re-writing of the model's draft here. Coverage and anchor
       contracts above already force the model to emit complete, mappable
       days; deterministic post-edits only normalize the calendar shape. */
    const draft = normalizeTripDraftCalendar(result.trip_draft);
    result.trip_draft = draft as NonNullable<typeof result.trip_draft>;
    normalizeAreaSuggestionAnchors(result);
    const draftAnchorIssue = anchorContractIssue(result);
    if (draftAnchorIssue) {
      throw new Error(`OpenAI returned invalid stop anchors: ${draftAnchorIssue}`);
    }
    for (let i = 1; i < draft.days.length; i++) {
      if (draft.days[i]!.day_date <= draft.days[i - 1]!.day_date) {
        throw new Error("OpenAI returned non-chronological draft day list");
      }
    }
  }

  /* Strict mode emits `null` for "no action this turn"; collapse to
     undefined at the caller boundary so LumiResult stays simple
     (`field?: T` rather than `field?: T | null`). */
  return {
    summary: result.summary,
    commands:
      toolState.acceptedCommands.length > 0
        ? toolState.acceptedCommands
        : undefined,
    rejected_commands:
      toolState.rejectedCommands.length > 0
        ? toolState.rejectedCommands
        : undefined,
    days: result.days ?? undefined,
    day_creates: stagedDayCreates ?? undefined,
    companions: (result.companions ?? undefined) as LumiResult["companions"],
    flight_details:
      (result.flight_details ?? undefined) as LumiResult["flight_details"],
    trip_draft: (result.trip_draft ?? undefined) as LumiResult["trip_draft"],
    esim_suggestion:
      (result.esim_suggestion ?? undefined) as LumiResult["esim_suggestion"],
    tool_call: rawToolCall,
    tool_events: toolEvents.length > 0 ? toolEvents : undefined,
  };
}

export function tripDraftFromLooseDays(days: LumiDay[]): LumiTripDraft {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const cities = uniqueDayCities(days);
  return normalizeTripDraftCalendar({
    title: titleFromCities(cities),
    start_date: first.day_date,
    end_date: last.day_date,
    cover: cities[0]?.slice(0, 2) ?? null,
    days,
    checklist: [
      {
        text: "確認航班與住宿資訊",
        description: "如果航班時間有異動，住宿入住時間和接駁安排也要一起確認。",
        kind: "flight",
        phase: "week_before",
        group_label: "文件與確認",
        start_date: null,
        subtasks: [
          { text: "確認去程與回程航班時間", done: false },
          { text: "把電子機票存到離線檔", done: false },
        ],
        suggested: true,
      },
      {
        text: "準備目的地 eSIM 或漫遊方案",
        description: "抵達前可以先安裝，但先不要啟用；落地後再切換數據線路。",
        kind: "esim",
        phase: "week_before",
        group_label: "通訊與網路",
        start_date: null,
        subtasks: [
          { text: "依旅程天數選擇方案", done: false },
          { text: "出發前先安裝 eSIM", done: false },
        ],
        suggested: true,
      },
      {
        text: "整理護照、簽證與保險文件",
        description: "重要文件建議同時保存在手機離線檔和雲端，避免網路不穩時打不開。",
        kind: "doc",
        phase: "early",
        group_label: "文件與保險",
        start_date: null,
        subtasks: [
          { text: "確認護照效期", done: false },
          { text: "保存簽證、保險與入境文件", done: false },
        ],
        suggested: true,
      },
    ],
  });
}


function incompleteStructuredDraftRetryMessage(
  issue: string,
): OpenAIChatMessage {
  return {
    role: "system",
    content: JSON.stringify({
      error: "incomplete_structured_draft",
      details: issue,
      retry:
        "Call stage_trip_draft_days with complete structured draft days before calling lumi_response again.",
    }),
  };
}

function incompleteStructuredDraftError(issue: string): Error {
  return new Error(`OpenAI returned incomplete_structured_draft: ${issue}`);
}


function isoDateOffset(anchor: Date, offsetDays: number): string | null {
  if (!Number.isFinite(offsetDays) || offsetDays < 0) return null;
  const date = new Date(anchor.getTime());
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function uniqueDayCities(days: LumiDay[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    for (const city of normalizeLumiDayCities(day)) {
      const key = city.toLowerCase();
      if (!city || seen.has(key)) continue;
      seen.add(key);
      out.push(city);
    }
  }
  return out;
}


function titleFromCities(cities: string[]): string {
  if (cities.length === 0) return "新的旅程";
  if (cities.length === 1) return `${cities[0]}之旅`;
  return cities.slice(0, 2).join(" + ");
}
