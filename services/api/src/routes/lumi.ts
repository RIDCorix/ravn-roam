// Read-side Lumi chat routes (list conversations, fetch messages,
// delete conversations). Writes go through POST /trips/:id/lumi which
// already runs the OpenAI turn and persists alongside it.

import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { normalizeTripStopAnchorMode } from "../db/schema/trip.js";
import { resolveGooglePlace } from "../geocode/google-places.js";
import { geocodeCities } from "../geocode/nominatim.js";
import {
  normalizePlaceSuggestions,
  scheduleTripPlaceSuggestionRefresh,
} from "../trips/place-suggestions.js";
import { enrichAttachmentUrls } from "../lumi/booking-links.js";
import {
  type ExecutedLumiCommand,
} from "../lumi/execution/itinerary.js";
import { executeLumiCommands } from "../lumi/execution/dispatch.js";
import { flightLegsFromMetadata } from "../lumi/contracts/flights.js";
import { preflightMutationRequest, validateMutationContext } from "../lumi/mutation-context.js";
import {
  journeyAnchorsSchema,
  journeyFrameSchema,
  runJourneyStep,
} from "../lumi/journey.js";
import { lumiDaySchema } from "../lumi/openai.js";
import {
  type LumiProgressEvent,
  normalizeLumiDayCities,
  runLumiTurn,
  type LumiDay,
  type LumiResult,
  type LumiStop,
  type LumiStopAttachment,
} from "../lumi/openai.js";
import { assembleLumiResponse } from "../lumi/response-assembly.js";
import { getUser, requireAuth } from "./_auth.js";
import {
  checklistSubtasksFromDescription,
  fallbackChecklistKind,
} from "./trip-shared.js";

export const lumiRouter = new Hono();

lumiRouter.onError((err, c) => {
  console.error("[lumi] unhandled route error", err);
  return c.json(
    {
      error: "lumi_internal_error",
      message: err instanceof Error ? err.message : "unknown_error",
    },
    500,
  );
});

const publicTripDraftInput = z.object({
  prompt: z.string().min(1).max(2000),
  context: z
    .object({
      current_date: z.string().optional(),
    })
    .optional(),
});

lumiRouter.post("/public-trip-draft", async (c) => {
  const body = await c.req.json();
  const parsed = publicTripDraftInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  let result: LumiResult;
  try {
    result = await runLumiTurn({
      prompt: parsed.data.prompt,
      history: [],
      context: parsed.data.context,
      requestedSkill: "create-trip",
    });
  } catch (error) {
    return c.json(
      {
        error: "lumi_unavailable",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      502,
    );
  }

  if (!result.trip_draft) {
    return c.json(
      {
        error: "draft_not_generated",
        summary: result.summary,
      },
      422,
    );
  }

  return c.json({
    summary: result.summary,
    trip_draft: result.trip_draft,
  });
});

lumiRouter.use("*", requireAuth);

// ── V2 journey planner ──────────────────────────────────────────────────
// One staged step per call. The server enforces the order (frame → anchors
// → days per city block); the model decides the content, including any
// traveler-facing question. The client loops until `finished`.

const journeyStepInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  current_date: z.string().max(20).nullish(),
  qa: z
    .array(
      z.object({
        step: z.enum(["frame", "anchors", "days"]),
        question: z.string().min(1).max(400),
        answer: z.string().min(1).max(400),
      }),
    )
    .max(12)
    .default([]),
  frame: journeyFrameSchema.nullish(),
  anchors: journeyAnchorsSchema.nullish(),
  days: z.array(lumiDaySchema).max(60).default([]),
});

lumiRouter.post("/journey/step", async (c) => {
  const body = await c.req.json();
  const parsed = journeyStepInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  try {
    const frame = parsed.data.frame
      ? {
          ...parsed.data.frame,
          origin: parsed.data.frame.origin ?? null,
          cities: parsed.data.frame.cities.map((city) => ({
            ...city,
            country_code: city.country_code ?? null,
            lat: city.lat ?? null,
            lng: city.lng ?? null,
          })),
        }
      : null;
    const result = await runJourneyStep({
      prompt: parsed.data.prompt,
      current_date: parsed.data.current_date ?? null,
      qa: parsed.data.qa,
      frame,
      anchors: parsed.data.anchors ?? null,
      days: parsed.data.days,
    });
    if (result.step === "frame" && result.status === "complete") {
      /* Attach coordinates so the studio map can pin cities immediately. */
      const geocoded = await geocodeCities(
        result.frame.cities.map((city) => city.name),
        { fetchMisses: true },
      ).catch(() => []);
      const byName = new Map(
        geocoded.map((g) => [g.name.trim().toLowerCase(), g]),
      );
      result.frame = {
        ...result.frame,
        cities: result.frame.cities.map((city) => ({
          ...city,
          lat: byName.get(city.name.trim().toLowerCase())?.lat ?? null,
          lng: byName.get(city.name.trim().toLowerCase())?.lng ?? null,
        })),
      };
    }
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "journey_step_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      502,
    );
  }
});

type ConversationRow = typeof schema.lumiConversation.$inferSelect;
type MessageRow = typeof schema.lumiMessage.$inferSelect;
const DEFAULT_CONVERSATION_LIMIT = 10;
const MAX_CONVERSATION_LIMIT = 25;

function rowToConversation(row: ConversationRow) {
  return {
    id: row.id,
    user_id: row.userId,
    trip_id: row.tripId,
    title: row.title,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function rowToMessage(row: MessageRow) {
  const metadata = (row.metadata ?? null) as {
    tool_events?: unknown;
    trip_draft?: unknown;
    esim_suggestion?: unknown;
  } | null;
  return {
    id: row.id,
    conversation_id: row.conversationId,
    role: row.role as "user" | "assistant",
    content: row.content,
    created_at: row.createdAt.toISOString(),
    tool_events: Array.isArray(metadata?.tool_events)
      ? metadata.tool_events
      : null,
    trip_draft: metadata?.trip_draft ?? null,
    esim_suggestion: metadata?.esim_suggestion ?? null,
  };
}

function parseConversationLimit(raw: string | null) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_CONVERSATION_LIMIT;
  return Math.min(MAX_CONVERSATION_LIMIT, Math.max(1, Math.floor(value)));
}

function encodeConversationCursor(row: ConversationRow) {
  return `${row.updatedAt.toISOString()}|${row.id}`;
}

function parseConversationCursor(raw: string | null) {
  if (!raw) return null;
  const separatorIndex = raw.indexOf("|");
  if (separatorIndex <= 0) return null;
  const updatedAt = new Date(raw.slice(0, separatorIndex));
  const id = raw.slice(separatorIndex + 1);
  if (!id || Number.isNaN(updatedAt.getTime())) return null;
  return { updatedAt, id };
}

// List the user's conversations. Optional `trip_id` filter — the storefront
// uses this on a trip page, with `include_unscoped=1` to keep legacy chats
// created before conversations were reliably linked to trips visible.
lumiRouter.get("/conversations", async (c) => {
  const user = getUser(c);
  const url = new URL(c.req.url);
  const tripId = url.searchParams.get("trip_id");
  const includeUnscoped = url.searchParams.get("include_unscoped") === "1";
  const limit = parseConversationLimit(url.searchParams.get("limit"));
  const cursor = parseConversationCursor(url.searchParams.get("cursor"));
  const db = getDb();
  const conditions = [eq(schema.lumiConversation.userId, user.id)];
  if (tripId) {
    conditions.push(
      includeUnscoped
        ? or(
            eq(schema.lumiConversation.tripId, tripId),
            isNull(schema.lumiConversation.tripId),
          )!
        : eq(schema.lumiConversation.tripId, tripId),
    );
  }
  if (cursor) {
    conditions.push(
      or(
        lt(schema.lumiConversation.updatedAt, cursor.updatedAt),
        and(
          eq(schema.lumiConversation.updatedAt, cursor.updatedAt),
          lt(schema.lumiConversation.id, cursor.id),
        ),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(schema.lumiConversation)
    .where(and(...conditions))
    .orderBy(
      desc(schema.lumiConversation.updatedAt),
      desc(schema.lumiConversation.id),
    )
    .limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const nextRow = rows.length > limit ? pageRows.at(-1) : null;
  return c.json({
    conversations: pageRows.map(rowToConversation),
    next_cursor: nextRow ? encodeConversationCursor(nextRow) : null,
    has_more: Boolean(nextRow),
  });
});

lumiRouter.get("/conversations/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();
  const [conv] = await db
    .select()
    .from(schema.lumiConversation)
    .where(
      and(
        eq(schema.lumiConversation.id, id),
        eq(schema.lumiConversation.userId, user.id),
      ),
    )
    .limit(1);
  if (!conv) return c.json({ error: "not_found" }, 404);
  const messages = await db
    .select()
    .from(schema.lumiMessage)
    .where(eq(schema.lumiMessage.conversationId, id))
    .orderBy(asc(schema.lumiMessage.createdAt));
  return c.json({
    conversation: rowToConversation(conv),
    messages: messages.map(rowToMessage),
  });
});

lumiRouter.delete("/conversations/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();
  const [row] = await db
    .delete(schema.lumiConversation)
    .where(
      and(
        eq(schema.lumiConversation.id, id),
        eq(schema.lumiConversation.userId, user.id),
      ),
    )
    .returning({ id: schema.lumiConversation.id });
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────
// CHAT — unified Lumi entry point.
//   * Page context (active trip, eSIM, tasks) folded into the system prompt.
//   * If current_trip_id is set AND the user owns it, Lumi may rewrite
//     its days. Otherwise concierge-mode answers only.
// ────────────────────────────────────────────────────────────────────────

export const pageContextSchema = z
  .object({
    current_date: z.string().optional(),
    user_name: z.string().nullish(),
    known_trips: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          start_date: z.string(),
          end_date: z.string(),
          status: z.string(),
          days_count: z.number().nullable(),
          cities: z.array(z.string()),
          updated_at: z.string(),
        }),
      )
      .optional(),
    active_trip: z
      .object({
        id: z.string(),
        title: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        days_total: z.number(),
        today_index: z.number().nullable(),
        today_city: z.string().nullable(),
        today_note: z.string().nullable(),
      })
      .nullish(),
    active_esim: z
      .object({
        country_name: z.string(),
        plan: z.string(),
        used_gb: z.number(),
        total_gb: z.number(),
        days_left: z.number(),
        days_total: z.number(),
        network: z.string(),
        signal: z.number(),
        speed: z.string(),
      })
      .nullish(),
    today_tasks: z
      .object({
        trip_id: z.string(),
        total: z.number(),
        done: z.number(),
        items: z.array(
          z.object({
            text: z.string(),
            done: z.boolean(),
            kind: z.string(),
            due_date: z.string().nullable(),
            suggested: z.boolean(),
          }),
        ),
      })
      .nullish(),
  })
  .strict();

const chatInput = z.object({
  prompt: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }).strict(),
    )
    .max(40)
    .optional(),
  conversation_id: z.string().uuid().optional(),
  // When set, Lumi is allowed to rewrite this trip's days. The route
  // verifies ownership before unlocking editor mode.
  current_trip_id: z.string().uuid().optional(),
  requested_skill: z
    .enum(["create-trip", "plan-trip", "edit-trip", "inspiration"])
    .optional(),
  context: pageContextSchema.optional(),
}).strict();

type LumiChatInput = z.infer<typeof chatInput>;
type LumiChatProgressEmitter = (
  event: LumiProgressEvent,
) => void | Promise<void>;

async function executeLumiChatTurn({
  data,
  user,
  emitProgress,
}: {
  data: LumiChatInput;
  user: ReturnType<typeof getUser>;
  emitProgress?: LumiChatProgressEmitter;
}) {
  const parsed = { data };
  const db = getDb();

  // Resolve editable trip (if any).
  let loadedTrip: Awaited<ReturnType<typeof loadEditableTrip>> | null = null;
  if (parsed.data.current_trip_id) {
    loadedTrip = await loadEditableTrip(parsed.data.current_trip_id, user.id);
  }
  const mutationContext = validateMutationContext(parsed.data.requested_skill, parsed.data.current_trip_id, loadedTrip);
  if (!mutationContext.ok) return { status: mutationContext.status, payload: { error: mutationContext.error } };
  const editableTrip = mutationContext.trip;

  // Resolve / create conversation. trip_id is set when we have an editable
  // trip, otherwise null (concierge conversations group together).
  let conversationId = parsed.data.conversation_id ?? null;
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(schema.lumiConversation)
      .where(
        and(
          eq(schema.lumiConversation.id, conversationId),
          eq(schema.lumiConversation.userId, user.id),
        ),
      )
      .limit(1);
    if (!existing) {
      conversationId = null;
    } else if (editableTrip) {
      if (existing.tripId && existing.tripId !== editableTrip.tripId) {
        conversationId = null;
      } else if (!existing.tripId) {
        await db
          .update(schema.lumiConversation)
          .set({ tripId: editableTrip.tripId, updatedAt: new Date() })
          .where(eq(schema.lumiConversation.id, existing.id));
      }
    }
  }
  if (!conversationId) {
    const [row] = await db
      .insert(schema.lumiConversation)
      .values({
        userId: user.id,
        tripId: editableTrip ? editableTrip.tripId : null,
        title: editableTrip?.title ?? "Lumi conversation",
      })
      .returning({ id: schema.lumiConversation.id });
    conversationId = row!.id;
  }
  await db.insert(schema.lumiMessage).values({
    conversationId,
    role: "user",
    content: parsed.data.prompt,
  });

  /* Reconstruct conversation history from DB rather than trusting the
     client's text-only memory. For assistant turns we rebuild the JSON
     envelope from `metadata` (saved on each insert) so the model can
     see its OWN past structured outputs, not just summary prose. Caps
     at 12 turns to match the previous client-side window. */
  const historyRows = await db
    .select()
    .from(schema.lumiMessage)
    .where(eq(schema.lumiMessage.conversationId, conversationId))
    .orderBy(asc(schema.lumiMessage.createdAt));
  // Drop the just-inserted user prompt — runLumiTurn re-adds it as the
  // final user message.
  const trimmedRows = historyRows.slice(0, -1).slice(-12);
  const history = trimmedRows.map((row) => {
    if (row.role === "assistant") {
      const meta = (row.metadata ?? null) as {
        days?: unknown;
        companions?: unknown;
        trip_draft?: unknown;
        tool_events?: unknown;
      } | null;
      /* Reconstruct the envelope this assistant turn actually returned,
         so the model can tell "I already shipped days[] last turn" from
         "I only acknowledged". Falls back to plain text if metadata is
         missing (older rows pre-this-fix). */
      const envelope: Record<string, unknown> = { summary: row.content };
      if (meta?.days) envelope.days = meta.days;
      if (meta?.companions) envelope.companions = meta.companions;
      if (meta?.trip_draft) envelope.trip_draft = meta.trip_draft;
      return {
        role: "assistant" as const,
        content: JSON.stringify(envelope),
      };
    }
    return { role: "user" as const, content: row.content };
  });

  let result: LumiResult;
  try {
    result = await runLumiTurn({
      prompt: parsed.data.prompt,
      history,
      editableTrip: editableTrip
        ? {
            trip_id: editableTrip.trip_id,
            title: editableTrip.title,
            start_date: editableTrip.start_date,
            end_date: editableTrip.end_date,
            days: editableTrip.days.map(({ id: _id, ...day }) => ({
              ...day,
              stops: day.stops.map(
                ({ id: _stopId, place_suggestions: _suggestions, ...stop }) =>
                  stop,
              ),
            })),
            cities: editableTrip.cities,
            companions: editableTrip.companions,
            flight_legs: editableTrip.flight_legs,
          }
        : undefined,
      context: parsed.data.context,
      requestedSkill: parsed.data.requested_skill,
      onProgress: emitProgress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "lumi_error";
    await db.insert(schema.lumiMessage).values({
      conversationId,
      role: "assistant",
      content: `（Lumi 暫時連不上：${message}）`,
    });
    return {
      status: 502,
      payload: { error: "lumi_error", message, conversation_id: conversationId },
    };
  }

  // Compatibility projections remain response-only. Persisted mutations are
  // executed exclusively from the validated, exact-ID command collection.
  let updatedDays: Array<{
    day_date: string;
    city: string;
    cities: string[];
    note: string;
  }> | null = null;
  let updatedCities: Array<{
    name: string;
    lat: number | null;
    lng: number | null;
  }> | null = null;
  let summary = result.summary;
  /* No server-side itinerary patching here. Flight/transfer structure is
     enforced inside runLumiTurn via contract validation + retry, so the
     model owns the itinerary content end to end. */
  if (result.days) {
    result.days = await enrichAttachmentUrls({
      days: result.days,
    });
  }
  if (result.day_creates) {
    result.day_creates = await enrichAttachmentUrls({
      days: result.day_creates,
    });
  }
  const executionResults = await executeLumiCommands({
    commands: result.commands ?? [],
    userId: user.id,
    tripId: editableTrip?.trip_id ?? null,
  });
  const successfulDays = successfulItineraryProjections(
    result.commands ?? [],
    executionResults,
  );
  updatedDays = successfulDays.length > 0 ? successfulDays : null;

  const companionsTouched = executionResults.some((outcome) => outcome.status === "success" && (outcome.type === "create_companion" || outcome.type === "update_companion" || outcome.type === "delete_companion"));
  const flightDetailsTouched = executionResults.some((outcome) => outcome.status === "success" && (outcome.type === "create_flight_leg" || outcome.type === "update_flight_leg"));

  const assembledResponse = assembleLumiResponse({
    proposedSummary: summary,
    executions: executionResults,
    rejectedAttempts: result.rejected_commands,
    proposedToolEvents: result.tool_events,
    flightDetailsApplied: flightDetailsTouched,
  });
  summary = assembledResponse.summary;

  /* Persist the FULL response payload in `metadata` so future turns can
     reconstruct what Lumi actually output, not just what she said. Without
     this, gpt-4o-mini drifts across turns — it sees only its prior
     summary text and treats acknowledgments ("我將為您規劃") as if they
     already shipped the structured days[]. Mirrors the LumiResult shape. */
  await db.insert(schema.lumiMessage).values({
    conversationId,
    role: "assistant",
    content: summary,
    metadata: {
      days: result.days ?? null,
      companions: null,
      flight_details: null,
      trip_draft: result.trip_draft ?? null,
      esim_suggestion: result.esim_suggestion ?? null,
      tool_call: result.tool_call ?? null,
      tool_events:
        assembledResponse.toolEvents.length > 0
          ? assembledResponse.toolEvents
          : null,
      proposed_commands: result.commands ?? [],
      execution_results: assembledResponse.audit.executions,
      rejected_attempts: assembledResponse.audit.rejected_attempts,
    },
  });
  await db
    .update(schema.lumiConversation)
    .set({ updatedAt: new Date() })
    .where(eq(schema.lumiConversation.id, conversationId));

  let updatedCompanions:
    | Array<{
        id: string;
        display_name: string;
        color: string;
        user_id: string | null;
        accepted_at: string | null;
      }>
    | null = null;
  if (companionsTouched && editableTrip) {
    const rows = await db
      .select()
      .from(schema.tripCompanion)
      .where(eq(schema.tripCompanion.tripId, editableTrip.tripId))
      .orderBy(asc(schema.tripCompanion.sortOrder));
    updatedCompanions = rows.map((r) => ({
      id: r.id,
      display_name: r.displayName,
      color: r.color,
      user_id: r.userId,
      accepted_at: r.acceptedAt?.toISOString() ?? null,
    }));
  }

  return {
    status: 200,
    payload: {
      summary,
      days: updatedDays,
      cities: updatedCities,
      companions: updatedCompanions,
      trip_draft: result.trip_draft ?? null,
      esim_suggestion: result.esim_suggestion ?? null,
      tool_events:
        assembledResponse.toolEvents.length > 0
          ? assembledResponse.toolEvents
          : null,
      mutations: assembledResponse.mutations,
      conversation_id: conversationId,
      metadata_updated: flightDetailsTouched,
    },
  };
}

export function successfulItineraryProjections(
  commands: NonNullable<LumiResult["commands"]>,
  outcomes: ExecutedLumiCommand[],
): Array<{ day_date: string; city: string; cities: string[]; note: string }> {
  return commands.flatMap((command, index) => {
    if (command.type !== "update_trip_day" && command.type !== "create_trip_day") return [];
    const outcome = outcomes[index];
    const targetId =
      command.type === "update_trip_day" ? command.day_id : command.trip_id;
    if (
      !outcome ||
      outcome.status !== "success" ||
      outcome.type !== command.type ||
      outcome.target_id !== targetId
    ) {
      return [];
    }
    return [
      {
        day_date: command.day.day_date,
        city: command.day.city,
        cities: normalizeLumiDayCities(command.day),
        note: command.day.note,
      },
    ];
  });
}

lumiRouter.post("/chat", async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const parsed = chatInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const result = await executeLumiChatTurn({
    data: parsed.data,
    user,
  });
  if (result.status === 200) {
    return c.json(result.payload, 200);
  }
  if (result.status === 400) return c.json(result.payload, 400);
  if (result.status === 403) return c.json(result.payload, 403);
  return c.json(result.payload, 502);
});

lumiRouter.post("/chat/stream", async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const parsed = chatInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const preflight = await preflightMutationRequest({
    mode: parsed.data.requested_skill,
    tripId: parsed.data.current_trip_id,
    loadOwnedTrip: async (tripId) => {
      const [trip] = await getDb()
        .select({ id: schema.trip.id })
        .from(schema.trip)
        .where(and(eq(schema.trip.id, tripId), eq(schema.trip.userId, user.id)))
        .limit(1);
      return Boolean(trip);
    },
  });
  if (!preflight.ok) {
    if (preflight.status === 400) return c.json({ error: preflight.error }, 400);
    return c.json({ error: preflight.error }, 403);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const markClosed = () => {
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      };
      const send = (event: unknown): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
          return true;
        } catch {
          markClosed();
          return false;
        }
      };
      heartbeat = setInterval(() => {
        send({
          event: "progress",
          data: {
            event: "status",
            status: "analyzing",
            label: "Still working",
          },
        });
      }, 15_000);

      void (async () => {
        try {
          const result = await executeLumiChatTurn({
            data: parsed.data,
            user,
            emitProgress: (event) => {
              send({ event: "progress", data: event });
            },
          });
          send({ event: "final", status: result.status, data: result.payload });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unknown_stream_error";
          send({
            event: "error",
            status: 500,
            data: { error: "lumi_stream_error", message },
          });
        } finally {
          markClosed();
          try {
            controller.close();
          } catch {
            // Client already closed the stream.
          }
        }
      })();
    },
    cancel() {
      // The async Lumi turn may still complete, but writes become no-ops
      // once send() observes the closed controller.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
});

export interface LoadedEditableTrip {
  tripId: string;
  trip_id: string;
  title: string;
  start_date: string;
  end_date: string;
  metadata: Record<string, unknown>;
  days: {
    id: string;
    day_id: string;
    day_date: string;
    city: string;
    cities: string[];
    segments: Array<{ city: string; start_part: "morning" | "afternoon" | "evening" | "full_day"; end_part: "morning" | "afternoon" | "evening" | "full_day"; note: string }>;
    note: string;
    /* Stops as currently stored. Empty array = day is unplanned, the
       model should treat that as "needs filling". Non-empty = already
       planned, model should preserve unless asked to rewrite. */
    stops: {
      id: string;
      stop_id: string;
      name: string;
      anchor_mode?: "exact_place" | "regional" | "suggested_places";
      place_name: string | null;
      place_id: string | null;
      place_address: string | null;
      area_name?: string | null;
      search_query?: string | null;
      country_code?: string | null;
      place_types?: string[];
      suggestion_count?: number | null;
      place_suggestions?: ReturnType<typeof normalizePlaceSuggestions>;
      kind: string;
      arrival_time: string | null;
      duration_min: number | null;
      lat: number | null;
      lng: number | null;
      note: string;
      attachments: {
        id?: string | null;
        type?: string;
        label: string;
        url?: string | null;
        amount?: string | null;
        action_label?: string | null;
        checklist_text?: string | null;
        checklist_description?: string | null;
        checklist_kind?: string | null;
        checklist_item_id?: string | null;
        image_name?: string | null;
        image_data_url?: string | null;
        status?: "required" | "completed" | "uploaded";
      }[];
    }[];
  }[];
  cities: {
    name: string;
    lat: number | null;
    lng: number | null;
    country_code: string | null;
  }[];
  companions: {
    id: string;
    display_name: string;
    color: string;
    user_id: string | null;
    accepted_at: string | null;
  }[];
  flight_legs: Array<{
    leg_id: string;
    departure_date?: string | null;
    departure_time?: string | null;
    flight_number?: string | null;
    terminal?: string | null;
    gate?: string | null;
  }>;
}

async function loadEditableTrip(
  tripId: string,
  userId: string,
): Promise<LoadedEditableTrip | "forbidden"> {
  const db = getDb();
  const [trip] = await db
    .select()
    .from(schema.trip)
    .where(and(eq(schema.trip.id, tripId), eq(schema.trip.userId, userId)))
    .limit(1);
  if (!trip) return "forbidden";

  const days = await db
    .select()
    .from(schema.tripDay)
    .where(eq(schema.tripDay.tripId, tripId))
    .orderBy(asc(schema.tripDay.sortOrder));

  /* Pull every day's stops in one batch + group by day. Empty arrays
     are valid (placeholder days). The model uses this to tell "already
     planned" from "still needs filling". */
  const stops = days.length
    ? await db
        .select()
        .from(schema.tripDayStop)
        .where(
          inArray(
            schema.tripDayStop.dayId,
            days.map((d) => d.id),
          ),
        )
        .orderBy(asc(schema.tripDayStop.sortOrder))
    : [];
  const stopsByDay = new Map<string, typeof stops>();
  for (const s of stops) {
    const arr = stopsByDay.get(s.dayId);
    if (arr) arr.push(s);
    else stopsByDay.set(s.dayId, [s]);
  }

  const orderedCities = uniqueCitiesFromLumiDays(
    days.map((day) => ({ city: day.city, cities: day.cities })),
  );
  const geocoded = await geocodeCities(orderedCities).catch(() => []);
  const coordByName = new Map(
    geocoded.map((g) => [g.name.trim().toLowerCase(), g]),
  );
  const cities = orderedCities.map((name) => ({
    name,
    lat: coordByName.get(name.toLowerCase())?.lat ?? null,
    lng: coordByName.get(name.toLowerCase())?.lng ?? null,
    country_code: coordByName.get(name.toLowerCase())?.country_code ?? null,
  }));

  const companions = await db
    .select()
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.tripId, tripId))
    .orderBy(asc(schema.tripCompanion.sortOrder));

  return {
    tripId: trip.id,
    trip_id: trip.id,
    title: trip.title,
    start_date: trip.startDate,
    end_date: trip.endDate,
    metadata:
      trip.metadata && typeof trip.metadata === "object" && !Array.isArray(trip.metadata)
        ? (trip.metadata as Record<string, unknown>)
        : {},
    days: days.map((d) => ({
      id: d.id,
      day_id: d.id,
      day_date: d.dayDate,
      city: d.city,
      cities: normalizeLumiDayCities({ city: d.city, cities: d.cities }),
      segments: d.segments,
      note: d.note,
      stops: (stopsByDay.get(d.id) ?? []).map((s) => ({
        id: s.id,
        stop_id: s.id,
        name: s.name,
        anchor_mode: normalizeTripStopAnchorMode(s.anchorMode),
        place_name: s.placeName ?? null,
        place_id: s.placeId ?? null,
        place_address: s.placeAddress ?? null,
        area_name: s.areaName ?? null,
        search_query: s.searchQuery ?? null,
        country_code: s.countryCode ?? null,
        place_types: Array.isArray(s.placeTypes) ? s.placeTypes : [],
        suggestion_count: s.suggestionCount,
        place_suggestions: normalizePlaceSuggestions(s.placeSuggestions),
        kind: s.kind,
        arrival_time: s.arrivalTime,
        duration_min: s.durationMin,
        lat: s.lat,
        lng: s.lng,
        note: s.note,
        attachments: normalizeLoadedAttachments(s.attachments),
      })),
    })),
    cities,
    companions: companions.map((c) => ({
      id: c.id,
      display_name: c.displayName,
      color: c.color,
      user_id: c.userId,
      accepted_at: c.acceptedAt?.toISOString() ?? null,
    })),
    flight_legs: flightLegsFromMetadata(trip.id, trip.metadata && typeof trip.metadata === "object" && !Array.isArray(trip.metadata) ? trip.metadata as Record<string, unknown> : {}),
  };
}

type LumiStopForWrite = NonNullable<LumiDay["stops"]>[number];

async function resolveStopsForWrite(
  day: LumiDay,
  stops: LumiStopForWrite[],
): Promise<LumiStopForWrite[]> {
  const cityName = day.city || day.cities?.[0] || "";
  const [city] = cityName
    ? await geocodeCities([cityName], { fetchMisses: true }).catch(() => [])
    : [];

  return Promise.all(
    stops.map(async (stop) => {
      const anchorMode = normalizeTripStopAnchorMode(stop.anchor_mode);
      if (anchorMode !== "exact_place") return stop;
      if (stop.lat != null && stop.lng != null && stop.place_id) return stop;

      const query = (stop.place_name ?? stop.name).trim();
      if (!query) return { ...stop, lat: stop.lat ?? null, lng: stop.lng ?? null };

      const resolved = await resolveGooglePlace(query, {
        city: cityName || null,
        expectedCountry: stop.country_code ?? city?.country_code ?? null,
        center: city ? { lat: city.lat, lng: city.lng } : null,
        maxDistanceMeters: 75_000,
      }).catch(() => null);
      if (!resolved) {
        return {
          ...stop,
          lat: null,
          lng: null,
        };
      }
      return {
        ...stop,
        place_name: resolved.name,
        place_id: resolved.place_id,
        place_address: resolved.formatted_address,
        country_code: stop.country_code ?? resolved.country_code,
        lat: resolved.lat,
        lng: resolved.lng,
      };
    }),
  );
}

function checklistMetaForAttachment(
  attachment: LumiStopAttachment,
  dayDate: string,
) {
  const kind =
    attachment.checklist_kind ?? fallbackChecklistKind(attachment.type ?? "ticket");
  if (kind === "transit" || attachment.type === "transit") {
    return {
      startDate: null,
      phase: "early",
      groupLabel: "交通預約",
    };
  }
  return {
    startDate: dayDate,
    phase: "on_trip",
    groupLabel: "抵達當地",
  };
}

function uniqueCitiesFromLumiDays(
  days: Array<{ city: string; cities?: readonly string[] | null }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    for (const city of normalizeLumiDayCities(day)) {
      const key = city.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(city);
    }
  }
  return out;
}

export function stopsForLumiWrite(day: LumiDay): LumiStop[] {
  return day.stops && day.stops.length > 0 ? day.stops : [];
}


async function applyDayPatches({
  tripId,
  editableTrip,
  days,
}: {
  tripId: string;
  editableTrip: LoadedEditableTrip;
  days: LumiDay[];
}): Promise<Array<{ day_date: string; city: string; cities: string[]; note: string }>> {
  const db = getDb();
  const existingDayByDate = new Map(
    editableTrip.days.map((day) => [day.day_date, day]),
  );
  const patches = days.filter((day) => existingDayByDate.has(day.day_date));

  await db.transaction(async (tx) => {
    for (const day of patches) {
      const existingDay = existingDayByDate.get(day.day_date);
      if (!existingDay) continue;

      await tx
        .update(schema.tripDay)
        .set({
          city: day.city,
          cities: normalizeLumiDayCities(day),
          note: day.note,
        })
        .where(eq(schema.tripDay.id, existingDay.id));

      await tx
        .delete(schema.tripDayStop)
        .where(eq(schema.tripDayStop.dayId, existingDay.id));

      const resolvedStops = await resolveStopsForWrite(
        day,
        stopsForLumiWrite(day),
      );

      const stopRows = [];
      for (let i = 0; i < resolvedStops.length; i++) {
        const stop = resolvedStops[i]!;
        const attachments = [];
        for (const attachment of stop.attachments ?? []) {
          let checklistItemId = attachment.checklist_item_id ?? null;
          if (!checklistItemId) {
            const checklistMeta = checklistMetaForAttachment(attachment, day.day_date);
            const [item] = await tx
              .insert(schema.tripChecklistItem)
              .values({
                tripId,
                text:
                  attachment.checklist_text?.trim() ||
                  `${stop.name}：${attachment.label}`,
                description: attachment.checklist_description ?? null,
                kind:
                  attachment.checklist_kind ??
                  fallbackChecklistKind(attachment.type ?? "ticket"),
                startDate: checklistMeta.startDate,
                phase: checklistMeta.phase,
                groupLabel: checklistMeta.groupLabel,
                subtasks: checklistSubtasksFromDescription(
                  attachment.checklist_description,
                ),
                done:
                  attachment.status === "completed" ||
                  attachment.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: day.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
          }
          attachments.push({ ...attachment, checklist_item_id: checklistItemId });
        }

        stopRows.push({
          dayId: existingDay.id,
          sortOrder: i,
          name: stop.name,
          anchorMode: normalizeTripStopAnchorMode(stop.anchor_mode),
          placeName: stop.place_name ?? null,
          placeId: stop.place_id ?? null,
          placeAddress: stop.place_address ?? null,
          areaName: stop.area_name ?? null,
          searchQuery: stop.search_query ?? null,
          countryCode: stop.country_code ?? null,
          placeTypes: stop.place_types ?? [],
          suggestionCount: stop.suggestion_count ?? 5,
          placeSuggestions: [],
          suggestionsStatus:
            normalizeTripStopAnchorMode(stop.anchor_mode) === "regional"
              ? "idle"
              : "resolved",
          kind: stop.kind ?? "other",
          arrivalTime: stop.arrival_time ?? null,
          durationMin: stop.duration_min ?? null,
          note: stop.note ?? "",
          attachments,
          lat: stop.lat ?? null,
          lng: stop.lng ?? null,
        });
      }

      if (stopRows.length > 0) {
        await tx.insert(schema.tripDayStop).values(stopRows);
      }
    }

    if (patches.length > 0) {
      await tx
        .update(schema.trip)
        .set({ updatedAt: new Date() })
        .where(eq(schema.trip.id, tripId));
    }
  });

  scheduleTripPlaceSuggestionRefresh(tripId);

  return patches.map((day) => ({
    day_date: day.day_date,
    city: day.city,
    cities: normalizeLumiDayCities(day),
    note: day.note,
  }));
}

async function applyDayCreates({
  tripId,
  editableTrip,
  days,
}: {
  tripId: string;
  editableTrip: LoadedEditableTrip;
  days: LumiDay[];
}): Promise<Array<{ day_date: string; city: string; cities: string[]; note: string }>> {
  const db = getDb();
  const existingDates = new Set(
    editableTrip.days.map((day) => day.day_date),
  );
  const creates = days
    .filter((day) => !existingDates.has(day.day_date))
    .sort((a, b) => a.day_date.localeCompare(b.day_date));
  const created: Array<{
    day_date: string;
    city: string;
    cities: string[];
    note: string;
  }> = [];

  if (creates.length === 0) return created;

  await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: schema.tripDay.id,
        dayDate: schema.tripDay.dayDate,
      })
      .from(schema.tripDay)
      .where(eq(schema.tripDay.tripId, tripId));
    const datesInDb = new Set(existingRows.map((row) => row.dayDate));

    for (const day of creates) {
      if (datesInDb.has(day.day_date)) continue;
      const [insertedDay] = await tx
        .insert(schema.tripDay)
        .values({
          tripId,
          sortOrder: existingRows.length + created.length,
          dayDate: day.day_date,
          city: day.city,
          cities: normalizeLumiDayCities(day),
          note: day.note,
        })
        .returning({
          id: schema.tripDay.id,
          dayDate: schema.tripDay.dayDate,
        });
      if (!insertedDay) continue;

      datesInDb.add(day.day_date);
      created.push({
        day_date: day.day_date,
        city: day.city,
        cities: normalizeLumiDayCities(day),
        note: day.note,
      });

      const resolvedStops = await resolveStopsForWrite(
        day,
        stopsForLumiWrite(day),
      );

      const stopRows = [];
      for (let i = 0; i < resolvedStops.length; i++) {
        const stop = resolvedStops[i]!;
        const attachments = [];
        for (const attachment of stop.attachments ?? []) {
          let checklistItemId = attachment.checklist_item_id ?? null;
          if (!checklistItemId) {
            const checklistMeta = checklistMetaForAttachment(attachment, day.day_date);
            const [item] = await tx
              .insert(schema.tripChecklistItem)
              .values({
                tripId,
                text:
                  attachment.checklist_text?.trim() ||
                  `${stop.name}：${attachment.label}`,
                description: attachment.checklist_description ?? null,
                kind:
                  attachment.checklist_kind ??
                  fallbackChecklistKind(attachment.type ?? "ticket"),
                startDate: checklistMeta.startDate,
                phase: checklistMeta.phase,
                groupLabel: checklistMeta.groupLabel,
                subtasks: checklistSubtasksFromDescription(
                  attachment.checklist_description,
                ),
                done:
                  attachment.status === "completed" ||
                  attachment.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: day.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
          }
          attachments.push({ ...attachment, checklist_item_id: checklistItemId });
        }

        stopRows.push({
          dayId: insertedDay.id,
          sortOrder: i,
          name: stop.name,
          anchorMode: normalizeTripStopAnchorMode(stop.anchor_mode),
          placeName: stop.place_name ?? null,
          placeId: stop.place_id ?? null,
          placeAddress: stop.place_address ?? null,
          areaName: stop.area_name ?? null,
          searchQuery: stop.search_query ?? null,
          countryCode: stop.country_code ?? null,
          placeTypes: stop.place_types ?? [],
          suggestionCount: stop.suggestion_count ?? 5,
          placeSuggestions: [],
          suggestionsStatus:
            normalizeTripStopAnchorMode(stop.anchor_mode) === "regional"
              ? "idle"
              : "resolved",
          kind: stop.kind ?? "other",
          arrivalTime: stop.arrival_time ?? null,
          durationMin: stop.duration_min ?? null,
          note: stop.note ?? "",
          attachments,
          lat: stop.lat ?? null,
          lng: stop.lng ?? null,
        });
      }

      if (stopRows.length > 0) {
        await tx.insert(schema.tripDayStop).values(stopRows);
      }
    }

    if (created.length > 0) {
      const orderedRows = await tx
        .select({
          id: schema.tripDay.id,
          dayDate: schema.tripDay.dayDate,
        })
        .from(schema.tripDay)
        .where(eq(schema.tripDay.tripId, tripId));
      orderedRows.sort((a, b) => a.dayDate.localeCompare(b.dayDate));

      for (let i = 0; i < orderedRows.length; i++) {
        const row = orderedRows[i]!;
        await tx
          .update(schema.tripDay)
          .set({ sortOrder: i })
          .where(eq(schema.tripDay.id, row.id));
      }

      await tx
        .update(schema.trip)
        .set({
          startDate: orderedRows[0]?.dayDate ?? editableTrip.start_date,
          endDate: orderedRows.at(-1)?.dayDate ?? editableTrip.end_date,
          updatedAt: new Date(),
        })
        .where(eq(schema.trip.id, tripId));
    }
  });

  if (created.length > 0) {
    scheduleTripPlaceSuggestionRefresh(tripId);
  }

  return created;
}

async function applyAttachmentPatch({
  tripId,
  editableTrip,
  days,
}: {
  tripId: string;
  editableTrip: LoadedEditableTrip;
  days: LumiDay[];
}): Promise<boolean> {
  const db = getDb();
  let touched = false;

  await db.transaction(async (tx) => {
    const existingDayByDate = new Map(
      editableTrip.days.map((day) => [day.day_date, day]),
    );

    for (const incomingDay of days) {
      const existingDay = existingDayByDate.get(incomingDay.day_date);
      if (!existingDay) continue;
      for (const incomingStop of incomingDay.stops ?? []) {
        const incomingAttachments = incomingStop.attachments ?? [];
        if (incomingAttachments.length === 0) continue;
        const stopId = (incomingStop as LumiStop & { stop_id?: string }).stop_id;
        const existingStop = stopId
          ? existingDay.stops.find((stop) => stop.id === stopId)
          : undefined;
        if (!existingStop) continue;

        const merged = [...existingStop.attachments];
        let stopTouched = false;
        const seen = new Set(
          merged.map((a) =>
            attachmentKey(
              a.type ?? "ticket",
              a.checklist_text ?? a.label,
            ),
          ),
        );

        for (const attachment of incomingAttachments) {
          const label = attachment.label?.trim();
          if (!label) continue;
          const type = attachment.type ?? "ticket";
          const checklistText =
            attachment.checklist_text?.trim() ||
            `${existingStop.name}：${label}`;
          const key = attachmentKey(type, checklistText);
          const existingAttachmentIndex = merged.findIndex(
            (a) =>
              attachmentKey(
                a.type ?? "ticket",
                a.checklist_text ?? a.label,
              ) === key,
          );
          if (existingAttachmentIndex >= 0) {
            const current = merged[existingAttachmentIndex]!;
            const next = {
              ...current,
              url: attachment.url ?? current.url ?? null,
              amount: attachment.amount ?? current.amount ?? null,
              action_label:
                attachment.action_label ?? current.action_label ?? null,
              checklist_text: current.checklist_text ?? checklistText,
              checklist_description:
                current.checklist_description ??
                attachment.checklist_description ??
                null,
              checklist_kind:
                current.checklist_kind ??
                attachment.checklist_kind ??
                fallbackChecklistKind(type),
              checklist_item_id:
                current.checklist_item_id ??
                attachment.checklist_item_id ??
                null,
              status: attachment.status ?? current.status ?? "required",
            };
            const changed = JSON.stringify(current) !== JSON.stringify(next);
            if (changed) {
              merged[existingAttachmentIndex] = next;
              stopTouched = true;
              touched = true;
            }
            continue;
          }

          let checklistItemId = attachment.checklist_item_id ?? null;
          if (!checklistItemId) {
            const checklistMeta = checklistMetaForAttachment(
              attachment,
              incomingDay.day_date,
            );
            const [item] = await tx
              .insert(schema.tripChecklistItem)
              .values({
                tripId,
                text: checklistText,
                description: attachment.checklist_description ?? null,
                kind: attachment.checklist_kind ?? fallbackChecklistKind(type),
                startDate: checklistMeta.startDate,
                phase: checklistMeta.phase,
                groupLabel: checklistMeta.groupLabel,
                subtasks: checklistSubtasksFromDescription(
                  attachment.checklist_description,
                ),
                done:
                  attachment.status === "completed" ||
                  attachment.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: incomingDay.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
          }

          merged.push({
            id: attachment.id ?? null,
            type,
            label,
            url: attachment.url ?? null,
            amount: attachment.amount ?? null,
            action_label: attachment.action_label ?? null,
            checklist_text: checklistText,
            checklist_description: attachment.checklist_description ?? null,
            checklist_kind:
              attachment.checklist_kind ?? fallbackChecklistKind(type),
            checklist_item_id: checklistItemId,
            status: attachment.status ?? "required",
          });
          seen.add(key);
          stopTouched = true;
          touched = true;
        }

        if (stopTouched) {
          await tx
            .update(schema.tripDayStop)
            .set({ attachments: merged })
            .where(eq(schema.tripDayStop.id, existingStop.id));
        }
      }
    }

    if (touched) {
      await tx
        .update(schema.trip)
        .set({ updatedAt: new Date() })
        .where(eq(schema.trip.id, tripId));
    }
  });

  return touched;
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[\s:：·・,，。()（）-]/g, "");
}

function attachmentKey(type: string, text: string): string {
  return `${type.trim().toLowerCase()}::${normalizeMatchText(text)}`;
}

function normalizeLoadedAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const label = typeof raw.label === "string" ? raw.label : "";
    if (!label.trim()) return [];
    const status: "required" | "completed" | "uploaded" =
      raw.status === "completed" || raw.status === "uploaded"
        ? raw.status
        : "required";
    return [
      {
        id: typeof raw.id === "string" ? raw.id : null,
        type: typeof raw.type === "string" ? raw.type : "ticket",
        label,
        url: typeof raw.url === "string" ? raw.url : null,
        amount: typeof raw.amount === "string" ? raw.amount : null,
        action_label:
          typeof raw.action_label === "string" ? raw.action_label : null,
        checklist_text:
          typeof raw.checklist_text === "string" ? raw.checklist_text : null,
        checklist_description:
          typeof raw.checklist_description === "string"
            ? raw.checklist_description
            : null,
        checklist_kind:
          typeof raw.checklist_kind === "string" ? raw.checklist_kind : null,
        checklist_item_id:
          typeof raw.checklist_item_id === "string"
            ? raw.checklist_item_id
            : null,
        image_name: typeof raw.image_name === "string" ? raw.image_name : null,
        image_data_url:
          typeof raw.image_data_url === "string" ? raw.image_data_url : null,
        status,
      },
    ];
  });
}
