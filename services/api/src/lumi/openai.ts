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

export interface LumiStop {
  name: string;
  /* sight | meal | transit | stay | shop | other */
  kind?: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
  attachments?: LumiStopAttachment[];
}

export interface LumiStopAttachment {
  id?: string | null;
  /* ticket | reservation | booking | flight | transit | upload | document */
  type?: string;
  label: string;
  action_label?: string | null;
  checklist_text?: string | null;
  checklist_kind?: string | null;
  checklist_item_id?: string | null;
  status?: "required" | "completed" | "uploaded";
}

export interface LumiDay {
  day_date: string;
  /* Macro city label, kept for the overview map pin. */
  city: string;
  note: string;
  /* Multi-stop itinerary within this day. Lumi emits this when planning a
     trip with concrete places ("築地市場" "晴空塔" "Bar Track"). Empty or
     omitted means "rest day in this city" — the API auto-seeds a single
     placeholder stop named after `city` so the map still renders. */
  stops?: LumiStop[];
}

export interface LumiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LumiCity {
  name: string;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
}

// Snapshot of "what the user is currently looking at / doing". Sent on
// every turn so off-trip pages still have useful situational awareness.
export interface LumiPageContext {
  current_date?: string;
  user_name?: string | null;
  active_trip?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    days_total: number;
    today_index: number | null;
    today_city: string | null;
    today_note: string | null;
  } | null;
  active_esim?: {
    country_name: string;
    plan: string;
    used_gb: number;
    total_gb: number;
    days_left: number;
    days_total: number;
    network: string;
    signal: number;
    speed: string;
  } | null;
  today_tasks?: {
    trip_id: string;
    total: number;
    done: number;
    items: {
      text: string;
      done: boolean;
      kind: string;
      due_date: string | null;
      suggested: boolean;
    }[];
  } | null;
}

export interface LumiCompanion {
  id: string;
  display_name: string;
  color: string;
  user_id: string | null;
  accepted_at: string | null;
}

export interface LumiCompanionEdit {
  // Provide id to update or delete an existing companion. Omit to create.
  id?: string | null;
  // For create/update.
  display_name?: string;
  color?: string;
  // Mark `delete: true` to remove. Other fields ignored when deleting.
  delete?: boolean;
}

export interface LumiInput {
  prompt: string;
  // Earlier turns in the same conversation (excluding the current
  // prompt). Kept short by the caller.
  history?: LumiTurn[];
  // If present, Lumi may rewrite this trip's days and CRUD its
  // companions.
  editableTrip?: {
    title: string;
    start_date: string;
    end_date: string;
    days: LumiDay[];
    cities: LumiCity[];
    companions: LumiCompanion[];
  };
  // Page context — Lumi reads this for off-trip questions.
  context?: LumiPageContext;
}

export interface LumiTripDraft {
  title: string;
  start_date: string;
  end_date: string;
  cover?: string | null;
  days: LumiDay[];
  checklist?: {
    text: string;
    kind: string;
    suggested?: boolean;
  }[];
}

export interface LumiResult {
  summary: string;
  days?: LumiDay[];
  companions?: LumiCompanionEdit[];
  // A complete trip proposal for the user to confirm. Available in any
  // mode — the client surfaces a "Create trip" button when present.
  trip_draft?: LumiTripDraft;
}

/* One stop inside a day. `name` is the only required field; everything
   else is optional enrichment. Loose `kind` so Lumi can introduce new
   categories without a schema rev. */
const stopSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.string().max(40).default("other"),
  arrival_time: z.string().max(40).nullish(),
  duration_min: z.number().int().min(0).max(2880).nullish(),
  note: z.string().max(2000).default(""),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1).max(80).nullish(),
        type: z.string().min(1).max(40).default("ticket"),
        label: z.string().min(1).max(120),
        action_label: z.string().max(80).nullish(),
        checklist_text: z.string().max(500).nullish(),
        checklist_kind: z.string().max(40).nullish(),
        checklist_item_id: z.string().uuid().nullish(),
        status: z.enum(["required", "completed", "uploaded"]).default("required"),
      }),
    )
    .max(8)
    .default([]),
});

/* A day with optional inline stops. `stops` defaults to [] so legacy Lumi
   replies that only set `city` still validate; the API materializes a
   single placeholder stop when stops is empty. */
const daySchema = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1).max(120),
  note: z.string().max(2000).default(""),
  stops: z.array(stopSchema).max(40).default([]),
});

/* All "optional" top-level fields use `.nullish()` so the strict-mode
   JSON Schema can require them while letting the model emit `null` for
   "no action this turn". Range / length constraints below still gate
   the inner contents via post-parse zod validation. */
const responseSchema = z.object({
  summary: z.string().min(1).max(1500),
  days: z.array(daySchema).min(1).max(60).nullish(),
  companions: z
    .array(
      z.object({
        id: z.string().nullish(),
        display_name: z.string().min(1).max(80).nullish(),
        color: z.string().max(20).nullish(),
        delete: z.boolean().nullish(),
      }),
    )
    .max(12)
    .nullish(),
  trip_draft: z
    .object({
      title: z.string().min(1).max(200),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cover: z.string().max(80).nullish(),
      days: z.array(daySchema).min(1).max(60),
      checklist: z
        .array(
          z.object({
            text: z.string().min(1).max(500),
            kind: z.string().min(1).max(40),
            suggested: z.boolean().nullish(),
          }),
        )
        .max(40)
        .nullish(),
    })
    .nullish(),
});

// ── Core prompt ────────────────────────────────────────────────────────
// Kept deliberately tiny. It only describes who Lumi is and the response
// envelope. Situational SOPs live in the SKILLS map below and are loaded
// conditionally per turn so the model isn't drowning in instructions
// that don't apply to its current input.

const CORE_PROMPT = `You are Lumi, a travel assistant inside the Roam eSIM app.
Reply with strict JSON, no markdown, no commentary.

ALWAYS include a top-level "summary" — a 1-2 sentence reply in the
user's language (default 繁中). Never omit it, even when emitting a
trip_draft or days/companions edit. Be honest about what you don't know.

Possible shapes:
  { "summary": string }                              // default — just answer
  { "summary": string, "days": [ … ] }               // edit current trip's days
  { "summary": string, "companions": [ … ] }         // CRUD current trip's companions
  { "summary": string, "trip_draft": { … } }         // propose a brand-new trip

Field names are case-sensitive and snake_case. Add extra top-level keys
only when the relevant skill below tells you to.`;

// ── Skills ─────────────────────────────────────────────────────────────
// Each skill is a focused SOP. selectSkills() picks which to attach to
// a given turn — typically one, sometimes two. Adding more skills (e.g.
// "esim-troubleshoot", "shop-recommend") goes here without touching the
// core prompt.

const SKILL_EDITOR = `SKILL · trip-editor — TAKES PRECEDENCE
The user is RIGHT NOW viewing this trip's detail page. The trip's
title, dates, days and companions are in the context block below.

Any vague trip reference in the user's message refers to THIS trip:
  • "this trip" / "the trip" / "my trip"
  • "這趟" / "這個行程" / "這一趟" / "這趟旅程" / "我這趟"
  • "幫我規劃" / "幫我排" / "排一下" (when no other trip is named)

When the user asks you to plan / fill / 規劃 / 排程 / 安排 this trip,
or to edit any specific day:
  → Emit "days" with the trip's entire itinerary, every day filled
    with concrete stops (3-5 stops per full day; see SKILL · trip-
    drafter's stop guidance for kind / time / note conventions).
  → Never re-ask for destination/dates — they're already in context.

DO NOT emit trip_draft in editor mode. Creating a draft would clone
this trip into a duplicate. The ONLY exception: the user explicitly
asks for a DIFFERENT, separate trip ("再幫我規劃下個月的京都行", "另
外開一趟去...", "plan a different trip to ...").

days: chronological array, each entry:
  {
    "day_date": "YYYY-MM-DD",
    "city":     string,                   // macro label, e.g. "東京"
    "note":     string,                   // see "day note" rule below
    "stops": [                            // ordered places visited THAT day
      {
        "name":          string,          // "築地市場" "Bar Track"
        "kind":          "sight" | "meal" | "transit" | "stay" | "shop" | "other",
        "arrival_time":  "09:30",         // 24h "HH:MM" — see time rule below
        "duration_min":  90,              // how long the stop lasts
        "note":          string,          // can be ""
        "attachments": [                  // optional prep items for this stop
          {
            "type": "ticket" | "reservation" | "booking" | "flight" | "transit" | "upload" | "document",
            "label": string,              // "門票" / "訂位" / "機票"
            "action_label": string | null,// "訂票" / "定位" / "上傳"
            "checklist_text": string | null,
            "checklist_kind": string | null,
            "status": "required"
          }
        ]
      }
    ]
  }

Time rule (CRITICAL — the UI renders a real timeline from these):
  • arrival_time MUST be a concrete 24h "HH:MM" string. Never use
    "morning" / "afternoon" / "晚上" / null when you know the order.
    Only use null when the day is genuinely unscheduled (single
    placeholder stop on a rest day).
  • duration_min is required when arrival_time is set. Pick a
    realistic length for the activity type: meals 60-90, sights
    45-180, shopping 60-120, transit = actual travel time, stay
    check-in/out 30.
  • Times must be chronological within a day, AND consecutive stops
    must not overlap (next arrival >= previous arrival + duration +
    a small travel buffer of 15-30 min).
  • Plausible day window: 08:00 – 22:00. Flights / overnight transit
    are the only exceptions.

Day note rule (CRITICAL — the UI shows this as the day's headline):
  • When you fill stops for a day, ALSO write a SHORT thematic summary
    in the day-level "note" — 6 to 16 chars in zh, <= 40 chars in en.
    It should read like a chapter title, not a paragraph. Examples:
      "大教堂與艾曼紐二世迴廊"
      "築地早餐 · 晴空塔夜景"
      "古城散策"
      "Old town wander"
  • This field is what the user sees on the day card; do NOT leave it
    empty when stops exist, or every day card will just say the city
    name and look identical.
  • For pure travel days (only a transit stop) or rest days with no
    stops, "note" may be "" — the UI falls back to the city.

Attachment rule:
  • If the user asks "哪些行程需要買票/訂位/標記上去" or any
    ticket/reservation/upload marking request, this is an enrichment task,
    NOT a replanning task. Preserve every existing day and every existing
    stop exactly; only add attachments to the relevant existing stops.
    Never replace the itinerary with only the stops that need tickets.
  • When a stop naturally requires proof or an action before travel,
    add one attachment to that stop AND make it checklist-backed.
  • Examples: museums / theme parks / popular attractions that need
    tickets -> type:"ticket"; restaurants that should be reserved ->
    type:"reservation"; flights / intercity trains -> type:"flight" or
    "transit"; hotels / visas / documents that need uploaded proof ->
    type:"upload" or "document".
  • Use checklist_text as the exact user task, e.g. "購買羅浮宮門票",
    "預訂 Bar Track 晚餐", "購買台北 → 米蘭機票". Use checklist_kind ∈
    {flight, stay, ticket, visa, doc, transit}. Leave
    checklist_item_id null unless the existing context already gives an
    id. Status is usually "required"; use "completed" only if the user
    explicitly says it is already bought/reserved/uploaded.

Preserve existing day_date values when filling stops — don't shift
dates. Include EVERY day in the trip window (start_date..end_date),
even if some stay as a single placeholder stop.

companions: each row is { id? | display_name | color? | delete? }. Omit
id to create. Provide existing id to rename or { id, delete: true } to
remove. Never invent uuids. Omit when not editing.`;

const SKILL_DRAFTER = `SKILL · trip-drafter — DEFER to trip-editor
If SKILL · trip-editor is loaded above, that one wins for any prompt
referring to "this trip" / "這趟" / 規劃這趟. Only act on this skill
when the user is clearly describing a SEPARATE new trip (a different
destination, a different date range, or "another trip" / "另一趟").

If the user is describing a new trip (destination + when + duration —
including pastes of flight tickets, e-tickets, hotel confirmations),
emit trip_draft. Use EXACTLY these field names (snake_case, no aliases):

trip_draft = {
  "title":      string,
  "start_date": "YYYY-MM-DD",
  "end_date":   "YYYY-MM-DD",
  "cover":      "2-letter region tag",                        // optional
  "days": [
    {
      "day_date": "YYYY-MM-DD",
      "city":     string,                                     // macro label for the day
      "note":     string,                                     // "" if nothing extra
      "stops": [                                              // ordered places that day
        {
          "name":          string,
          "kind":          "sight" | "meal" | "transit" | "stay" | "shop" | "other",
          "arrival_time":  "10:30",                           // 24h HH:MM, never vague words
          "duration_min":  90,                                // realistic length
          "note":          string                             // "" allowed
          "attachments": [                                    // can be []
            {
              "type": string,
              "label": string,
              "action_label": string | null,
              "checklist_text": string | null,
              "checklist_kind": string | null,
              "status": "required" | "completed" | "uploaded"
            }
          ]
        }
      ]
    }
  ],
  "checklist": [                                              // optional
    { "text": string, "kind": string, "suggested": true }
  ]
}

Per-day stops guidance:
  • Travel days (flight, train, long transit): emit one stop with
    kind:"transit", name = the route ("Taipei → Milan"),
    arrival_time = actual departure HH:MM, duration_min = actual
    travel time.
  • Arrival day: stop for hotel check-in (kind:"stay", typical 15:00,
    30 min) + maybe a light meal (kind:"meal") nearby.
  • Full days: 3–5 stops mixing sights / meals / transit, in the order
    a real day flows (morning sight → lunch → afternoon → dinner).
  • Rest / unplanned days: a single stop named after the city with
    kind:"other" is fine. Empty stops[] is allowed but discouraged.
  • Add stop attachments for tickets, reservations, bookings and
    uploads that the user must complete; every attachment should include
    checklist_text so it becomes a checklist item. Do not repeat the same
    checklist_text again in trip_draft.checklist.

Time rule applies here too — every stop on a planned day MUST carry
a concrete 24h arrival_time and duration_min. Times must be sorted
and not overlap (with a 15–30 min travel buffer between stops).

Day-level "note" doubles as the day's headline in the UI — write a
short thematic phrase (6-16 zh chars / <= 40 en chars) like "大教堂
周邊散策" or "Old town wander" whenever the day has real stops. Leave
"" only for pure-travel or rest days. Never repeat the city name in
note — the UI already shows it.
Use real, recognizable place names when you have confidence; never
invent fictional landmarks. If unsure, write the neighborhood instead
("淺草 散策") rather than fabricating a specific attraction.

Do NOT use "date", "place", "location", "task", "item", or Chinese
keys. Each day MUST have day_date + city; "note" can be "" but the
key must exist. Each stop MUST have name; other fields optional but
preferred. Each checklist item MUST have text + kind.

Extract dates from any pasted itinerary silently — outbound = start,
return = end. Compute duration yourself: (end - start + 1) days. Emit
one day object per calendar day, in chronological order.

Only ask one clarifying question when info is genuinely missing (e.g.
destination but no dates). Otherwise emit trip_draft immediately.

Title: short and human ("東京 + 京都"). Checklist: 3-6 items with kind ∈
{esim, money, flight, stay, ticket, visa, doc, transit, gear,
insurance}; mark each "suggested": true.`;

interface SkillSelection {
  prompts: string[];
}

function selectSkills(input: LumiInput): SkillSelection {
  const prompts: string[] = [];
  if (input.editableTrip) prompts.push(SKILL_EDITOR);
  // Drafter is always available — even editor-mode users may want to
  // plan a separate new trip. Cheap to include (~120 tokens).
  prompts.push(SKILL_DRAFTER);
  return { prompts };
}

function formatContext(input: LumiInput): string {
  const lines: string[] = [];
  const ctx = input.context;
  if (ctx?.current_date) lines.push(`Today's date: ${ctx.current_date}`);
  if (ctx?.user_name) lines.push(`User name: ${ctx.user_name}`);

  if (ctx?.active_trip) {
    lines.push(
      "",
      "User's currently-active trip (today falls inside its window):",
      JSON.stringify(ctx.active_trip, null, 2),
    );
  } else {
    lines.push("", "User has no trip in progress right now.");
  }

  if (ctx?.active_esim) {
    lines.push(
      "",
      "User's currently-active eSIM (real-time data, treat as ground truth):",
      JSON.stringify(ctx.active_esim, null, 2),
    );
  }

  if (ctx?.today_tasks) {
    lines.push(
      "",
      `Tasks on the active trip (${ctx.today_tasks.done}/${ctx.today_tasks.total} done):`,
      JSON.stringify(ctx.today_tasks.items, null, 2),
    );
  }

  if (input.editableTrip) {
    /* Surfaced first and loud so the model can't miss it. Any "this trip"
       reference in the user prompt should resolve to this object. */
    lines.unshift(
      `>>> EDITOR MODE — user is on the trip detail page for:`,
      `  title:      ${input.editableTrip.title}`,
      `  start_date: ${input.editableTrip.start_date}`,
      `  end_date:   ${input.editableTrip.end_date}`,
      `  day_count:  ${input.editableTrip.days.length}`,
      `When the user says "this trip" / "這趟" / "幫我規劃" with no`,
      `other trip named, they mean THIS trip. Emit "days" to edit it;`,
      `do NOT emit "trip_draft" (that would create a duplicate).`,
      "",
    );
    lines.push(
      "",
      "Editable trip — full day list (ground truth, preserve day_date values):",
      JSON.stringify(input.editableTrip.days, null, 2),
      "",
      "Cities currently pinned on the map (geocoded; null means we couldn't",
      "resolve). If a city's country_code looks wrong for this trip, say so",
      "honestly instead of claiming the map is correct.",
      JSON.stringify(input.editableTrip.cities, null, 2),
      "",
      "Trip companions (you may CRUD these; each row's id is the canonical",
      "reference). user_id != null means a real Supabase user has claimed",
      "the slot via invite link.",
      JSON.stringify(input.editableTrip.companions, null, 2),
    );
  } else {
    lines.push(
      "",
      "No editable trip in this view — you are NOT allowed to output `days`",
      "or `companions`. If the user wants to edit a trip, tell them to open",
      "it from the Trips tab.",
    );
  }

  return lines.join("\n");
}

/* Strict JSON Schema sent to OpenAI as `response_format.json_schema`.
   Mirrors the zod `responseSchema` shape but obeys OpenAI's strict-mode
   restrictions: every property listed in `required`, `additionalProperties:
   false` on every object, no `default`/`min`/`max`/`pattern` keywords.
   Optional-in-zod fields become required-but-nullable via `["type","null"]`.
   Range / regex constraints still live in zod (post-parse) — this schema
   only describes the SHAPE so the model can't drift. */
const STOP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Place name, e.g. 築地市場" },
    kind: {
      type: "string",
      description: "One of: sight | meal | transit | stay | shop | other",
    },
    arrival_time: {
      type: ["string", "null"],
      description: 'Free-form: "10:30" / "morning" / null',
    },
    duration_min: { type: ["integer", "null"] },
    note: { type: "string", description: "May be empty string" },
    attachments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: ["string", "null"] },
          type: {
            type: "string",
            description:
              "ticket | reservation | booking | flight | transit | upload | document",
          },
          label: { type: "string", description: "Short badge label" },
          action_label: { type: ["string", "null"] },
          checklist_text: {
            type: ["string", "null"],
            description: "Task text to create/link as a checklist item",
          },
          checklist_kind: {
            type: ["string", "null"],
            description: "flight | stay | ticket | visa | doc | transit",
          },
          checklist_item_id: { type: ["string", "null"] },
          status: {
            type: "string",
            description: "required | completed | uploaded",
          },
        },
        required: [
          "id",
          "type",
          "label",
          "action_label",
          "checklist_text",
          "checklist_kind",
          "checklist_item_id",
          "status",
        ],
      },
    },
  },
  required: [
    "name",
    "kind",
    "arrival_time",
    "duration_min",
    "note",
    "attachments",
  ],
} as const;

const DAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    day_date: { type: "string", description: "YYYY-MM-DD" },
    city: { type: "string" },
    note: { type: "string", description: "May be empty string" },
    stops: { type: "array", items: STOP_SCHEMA },
  },
  required: ["day_date", "city", "note", "stops"],
} as const;

/* When `days` is nullable — default mode for non-editor or off-topic
   prompts. The model can return `null` to mean "no day edits this turn". */
const DAYS_NULLABLE = {
  anyOf: [
    { type: "null" },
    { type: "array", items: DAY_SCHEMA },
  ],
  description:
    "Use to rewrite the current trip's days in editor mode. " +
    "Set null when not editing.",
} as const;

/* Planning-mode variant — when the user is on a trip page AND their prompt
   reads as a planning request ("規劃 / 排 / fill / plan ..."), we force
   `days` to be a non-null array at the OpenAI strict-schema layer. This
   removes the model's option to acknowledge without action; even
   gpt-4o-mini can't drift past a structural requirement. */
const DAYS_REQUIRED = {
  type: "array",
  items: DAY_SCHEMA,
  description:
    "MUST emit on this turn — the user explicitly asked you to plan or " +
    "fill this trip. Every calendar day in the trip window with concrete stops.",
} as const;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    days: DAYS_NULLABLE,
    companions: {
      anyOf: [
        { type: "null" },
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: ["string", "null"] },
              display_name: { type: ["string", "null"] },
              color: { type: ["string", "null"] },
              delete: { type: ["boolean", "null"] },
            },
            required: ["id", "display_name", "color", "delete"],
          },
        },
      ],
    },
    trip_draft: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
            cover: { type: ["string", "null"] },
            days: { type: "array", items: DAY_SCHEMA },
            checklist: {
              anyOf: [
                { type: "null" },
                {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      text: { type: "string" },
                      kind: { type: "string" },
                      suggested: { type: ["boolean", "null"] },
                    },
                    required: ["text", "kind", "suggested"],
                  },
                },
              ],
            },
          },
          required: [
            "title",
            "start_date",
            "end_date",
            "cover",
            "days",
            "checklist",
          ],
        },
      ],
    },
  },
  required: ["summary", "days", "companions", "trip_draft"],
} as const;

/* Planning-mode schema: same shape as the default, but `days` is now a
   non-null required array. Used when the user is in editor mode AND
   their prompt signals an explicit planning action. */
const RESPONSE_JSON_SCHEMA_PLANNING = {
  ...RESPONSE_JSON_SCHEMA,
  properties: {
    ...RESPONSE_JSON_SCHEMA.properties,
    days: DAYS_REQUIRED,
  },
} as const;

const PLANNING_PROMPT_RE =
  /規劃|排程|排一下|安排|幫我排|幫我規劃|填一下|填滿|plan|schedule|fill|arrange|draft|請規劃|請排/i;

function looksLikePlanningPrompt(prompt: string): boolean {
  return PLANNING_PROMPT_RE.test(prompt);
}

export async function runLumiTurn(input: LumiInput): Promise<LumiResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the API service — set it in services/api/.env.",
    );
  }

  const history = (input.history ?? []).slice(-12);

  /* Compose system prompt from the core SOP plus whichever skill modules
     this turn needs. `selectSkills` decides based on the input shape (e.g.
     editor-mode attaches the editor SOP). Joined with blank lines so the
     model reads them as distinct sections. */
  const skills = selectSkills(input);
  const systemPrompt = [CORE_PROMPT, ...skills.prompts].join("\n\n");

  /* Planning mode: when the user is on a trip page AND their prompt
     reads as a planning action, swap to a schema where `days` MUST be
     a non-null array. The model can no longer pick `null` to skip the
     work — strict structured output blocks the response. */
  const planningMode =
    !!input.editableTrip && looksLikePlanningPrompt(input.prompt);
  const activeSchema = planningMode
    ? RESPONSE_JSON_SCHEMA_PLANNING
    : RESPONSE_JSON_SCHEMA;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      /* Strict structured output: the model is structurally prevented
         from emitting keys outside the schema, missing required fields,
         or returning non-JSON. Requires gpt-4o-2024-08-06+ / gpt-4o-mini.
         Zod safeParse below is a second guard for range/regex constraints
         strict mode can't express. */
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lumi_response",
          strict: true,
          schema: activeSchema,
        },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: formatContext(input) },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: input.prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned non-JSON content: ${content.slice(0, 200)}`);
  }

  const parsedResult = responseSchema.safeParse(parsed);
  if (!parsedResult.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${parsedResult.error.message}`,
    );
  }
  const result = parsedResult.data;

  /* Dev visibility — tells us at a glance whether the model actually
     emitted structured payloads or just summary text. Keep terse so the
     log line is greppable. */
  console.log(
    `[lumi] turn editor=${!!input.editableTrip} planning=${planningMode} ` +
      `days=${result.days?.length ?? "null"} ` +
      `companions=${result.companions?.length ?? "null"} ` +
      `draft=${result.trip_draft ? "yes" : "no"} ` +
      `summary=${JSON.stringify(result.summary.slice(0, 60))}`,
  );

  if (result.days) {
    // Safety: editor mode requires an editable trip in the input. If
    // Lumi tries to emit days without it, drop them.
    if (!input.editableTrip) {
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
    const draft = result.trip_draft;
    if (draft.days[0]!.day_date !== draft.start_date) {
      draft.start_date = draft.days[0]!.day_date;
    }
    if (draft.days[draft.days.length - 1]!.day_date !== draft.end_date) {
      draft.end_date = draft.days[draft.days.length - 1]!.day_date;
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
    days: result.days ?? undefined,
    companions: (result.companions ?? undefined) as LumiResult["companions"],
    trip_draft: (result.trip_draft ?? undefined) as LumiResult["trip_draft"],
  };
}
