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
  lat?: number | null;
  lng?: number | null;
}

export interface LumiStopAttachment {
  id?: string | null;
  /* ticket | reservation | booking | flight | transit | upload | document */
  type?: string;
  label: string;
  url?: string | null;
  amount?: string | null;
  action_label?: string | null;
  checklist_text?: string | null;
  checklist_description?: string | null;
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
    description?: string | null;
    kind: string;
    start_date?: string | null;
    phase?: string | null;
    group_label?: string | null;
    subtasks?: { text: string; done?: boolean | null }[] | null;
    suggested?: boolean | null;
    shop_filter?: {
      country: string;
      days?: number | null;
      gb?: number | null;
    } | null;
  }[] | null;
}

export interface LumiResult {
  summary: string;
  days?: LumiDay[];
  companions?: LumiCompanionEdit[];
  // A complete trip proposal for the user to confirm. Available in any
  // mode — the client surfaces a "Create trip" button when present.
  trip_draft?: LumiTripDraft;
  // Read-only product suggestion — the chat UI renders one CTA per plan
  // (single plan or multi-region combo). Does NOT mutate any trip.
  esim_suggestion?: {
    plans: Array<{
      country: string;
      days?: number;
      gb?: number;
      label?: string;
    }>;
    rationale?: string;
  };
  // Raw OpenAI function call arguments before server-side normalization.
  // Persisted for audit/debugging so we can inspect exactly what Lumi asked
  // the app to do on that turn.
  tool_call?: {
    id?: string | null;
    name: "lumi_response";
    arguments: unknown;
  };
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
        url: z.string().url().max(1200).nullish(),
        amount: z.string().max(80).nullish(),
        action_label: z.string().max(80).nullish(),
        checklist_text: z.string().max(500).nullish(),
        checklist_description: z.string().max(4000).nullish(),
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
  // Read-only suggestion: Lumi proposes one or more eSIM plans and the
  // chat UI renders them as "去買 →" CTA cards. Does not mutate any
  // trip — the user clicks through to the shop page where they can
  // actually buy. Use this for shopping intent; trip_draft is for
  // *new trip* creation only.
  //
  // Multi-plan combos: when the trip spans multiple sub-regions, emit
  // multiple plans in the array (e.g. western Europe 3 days + eastern
  // Europe 2 days). Each plan has its own country / days / gb.
  esim_suggestion: z
    .object({
      plans: z
        .array(
          z.object({
            // ISO 3166-1 alpha-2 (e.g. "JP", "FR") OR a region slug
            // from the storefront catalogue when the suggestion spans
            // multiple ISO codes (e.g. "western-northern-europe",
            // "central-eastern-europe-balkans"). Picking a slug lets
            // the storefront deep-link to the right sub-region page.
            country: z.string().min(2).max(40),
            days: z.number().int().min(1).max(60).nullish(),
            gb: z.number().min(0.5).max(200).nullish(),
            label: z.string().min(1).max(200).nullish(),
          }),
        )
        .min(1)
        .max(4),
      // Why these plans? Shown as a small explanation above the CTA
      // cards. Keep to one sentence in the user's language.
      rationale: z.string().min(1).max(300).nullish(),
    })
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
            description: z.string().max(4000).nullish(),
            kind: z.string().min(1).max(40),
            start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
            phase: z.string().max(40).nullish(),
            group_label: z.string().max(80).nullish(),
            subtasks: z
              .array(
                z.object({
                  text: z.string().min(1).max(300),
                  done: z.boolean().nullish(),
                }),
              )
              .max(20)
              .nullish(),
            suggested: z.boolean().nullish(),
            // Only meaningful when kind === "esim". Drives the
            // "去買 →" deep-link on the storefront so the user can
            // jump to the shop region page with the slider pre-set.
            shop_filter: z
              .object({
                country: z.string().min(2).max(40), // ISO 3166-1 alpha-2 preferred (e.g. "JP")
                days: z.number().int().min(1).max(60).nullish(),
                gb: z.number().min(0.5).max(200).nullish(),
              })
              .nullish(),
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
Use the lumi_response tool exactly once. Put every field in the tool
arguments; do not write a normal assistant message.

ALWAYS include a top-level "summary" — a 1-2 sentence reply in the
user's language (default 繁中). Never omit it, even when emitting a
trip_draft or days/companions edit. Be honest about what you don't know.

Possible shapes:
  { "summary": string }                              // default — just answer
  { "summary": string, "days": [ … ] }               // update the visible trip
  { "summary": string, "companions": [ … ] }         // CRUD current trip's companions
  { "summary": string, "trip_draft": { … } }         // propose a brand-new trip
  { "summary": string, "esim_suggestion": { … } }    // surface a buyable eSIM plan

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
  → Return the updated itinerary in "days".
  → Never re-ask for destination/dates — they're already in context.
  → For any whole-trip planning request, days[] MUST contain every
    existing editableTrip.days day_date exactly once. Never collapse a
    multi-day trip into the first day.
  → If the user says "每天安排 N-M 個行程" / "fill every day" /
    "plan this whole trip", update EVERY day in this trip. Keep the
    same day_date values and emit 2-3 real stops per non-transit day
    when that is what they asked for. Do not ask which day.

Day references:
  • "day2", "Day 2", "第二天", "第 2 天", "D2" mean the second entry in
    editableTrip.days. Use that exact day_date and its existing stops.
  • If the user asks for links/tickets/reservations for a day, update the
    relevant attachments on that day rather than asking them to name the
    activity again when the day has clear ticketed stops.

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
            "url": string | null,         // official booking URL if known
            "amount": string | null,      // price if known, e.g. "€18"
            "action_label": string | null,// "訂票" / "定位" / "上傳"
            "checklist_text": string | null,
            "checklist_kind": string | null,
            "status": "required"
          }
        ]
      }
    ]
  }

Place-name rule (CRITICAL — map pins depend on this):
  • Every stop.name must be a real, specific, searchable place or venue
    that can plausibly resolve on Google Maps / OpenStreetMap.
  • Good: "Duomo di Milano", "Galleria Vittorio Emanuele II",
    "Piz", "Trattoria Milanese", "Sforzesco Castle".
  • Bad: "米蘭市中心散策", "米蘭在地餐廳", "傍晚街區散步",
    "古城散策", "附近咖啡廳", "自由活動", "購物時間".
  • Restaurants must be named restaurants, not generic meal slots. If
    you are not confident about a venue, choose a well-known real venue
    for that city or leave that stop out of this patch.
  • Use vague ideas only in day.note, never as stop.name.

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
    ticket/reservation/upload marking request, add the needed attachment
    to the relevant existing stop. Keep the user's itinerary as-is.
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
  • Set attachment.url when you know the official booking, ticket,
    reservation, airline, train, museum, hotel or restaurant URL. Prefer
    official sites over aggregators. If unsure, set url null.
  • In summary, speak naturally to the traveler. Do not mention internal
    mechanics like days, patches, rewrites, schemas, preserving data, or
    safety checks. Say things like: "我幫你補上訂票資訊了。"

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
              "url": string | null,
              "amount": string | null,
              "action_label": string | null,
              "checklist_text": string | null,
              "checklist_description": string | null,
              "checklist_kind": string | null,
              "status": "required" | "completed" | "uploaded"
            }
          ]
        }
      ]
    }
  ],
  "checklist": [                                              // optional
    { "text": string, "description": string | null,
      "kind": string, "start_date": "YYYY-MM-DD" | null,
      "phase": "early" | "week_before" | "days_before" | "travel_day" | "on_trip",
      "group_label": string, "subtasks": [{ "text": string, "done": false }],
      "suggested": true }
  ]
}

Per-day stops guidance:
  • Travel days (flight, train, long transit): emit one stop with
    kind:"transit", name = the route ("Taipei → Milan"),
    arrival_time = actual departure HH:MM, duration_min = actual
    travel time.
  • Arrival day: stop for hotel check-in (kind:"stay", typical 15:00,
    30 min) + maybe a light meal (kind:"meal") nearby.
  • Full days: 3–5 stops mixing specific sights / named restaurants /
    transit, in the order a real day flows (morning sight → lunch →
    afternoon → dinner).
  • Rest / unplanned days: a single stop named after the city with
    kind:"other" is fine. Empty stops[] is allowed but discouraged.
  • Add stop attachments for tickets, reservations, bookings and
   uploads that the user must complete; every attachment should include
    checklist_text and checklist_description so it becomes a helpful
    checklist item. Do not repeat the same
    checklist_text again in trip_draft.checklist.

Time rule applies here too — every stop on a planned day MUST carry
a concrete 24h arrival_time and duration_min. Times must be sorted
and not overlap (with a 15–30 min travel buffer between stops).

Day-level "note" doubles as the day's headline in the UI — write a
short thematic phrase (6-16 zh chars / <= 40 en chars) like "大教堂
周邊散策" or "Old town wander" whenever the day has real stops. Leave
"" only for pure-travel or rest days. Never repeat the city name in
note — the UI already shows it.
Use real, recognizable, map-searchable place names. Never invent
fictional landmarks, and never use generic neighborhood/activity names
as stop.name. If unsure, omit that stop from this patch instead of
writing "淺草散策", "在地餐廳", "市中心", "街區散步", or similar.

Do NOT use "date", "place", "location", "task", "item", or Chinese
keys. Each day MUST have day_date + city; "note" can be "" but the
key must exist. Each stop MUST have name; other fields optional but
preferred. Each checklist item MUST have text + kind + phase +
group_label + start_date + subtasks. Checklist subtasks are the concrete
steps the user can tick off. Checklist description is optional markdown
for guidance only: how to prepare, caveats, official-document hints, or
decision criteria. NEVER repeat the same wording as subtasks in
description. If there is no extra guidance beyond the subtasks, set
description to null.

Checklist timing:
  • "early": bookings, visas, insurance, hotels; start as soon as the
    trip is created, due before departure.
  • "week_before": documents, confirmations, eSIM install; start about
    7 days before departure.
  • "days_before": packing and offline copies; start 3-5 days before.
  • "travel_day": airport / flight-day tasks.
  • "on_trip": things to do only after arrival.
Every checklist item should have 2-5 subtasks. Keep subtasks concrete.

Extract dates from any pasted itinerary silently — outbound = start,
return = end. Compute duration yourself: (end - start + 1) days. Emit
one day object per calendar day, in chronological order.

Only ask one clarifying question when info is genuinely missing (e.g.
destination but no dates). Otherwise emit trip_draft immediately.

Title: short and human ("東京 + 京都"). Checklist: 3-6 items with kind ∈
{esim, money, flight, stay, ticket, visa, doc, transit, gear,
insurance}; mark each "suggested": true.

eSIM items: when emitting a checklist item with kind="esim", ALWAYS
include shop_filter so the storefront can deep-link to the matching
shop region with the slider pre-positioned. Shape:
  { "country": ISO_2, "days": number?, "gb": number? }
  • country  REQUIRED. Use an ISO 3166-1 alpha-2 code: "JP" (Japan),
             "KR" (Korea), "TW" (Taiwan), "TH" (Thailand), "FR", "DE",
             "GB", "US", "AU"… For a multi-country region pick the
             single dominant country (e.g. user going to "Italy +
             France" → "IT" or "FR"; never write "EU+UK" or "歐洲").
  • days     OPTIONAL. The trip length in days. Use the actual planned
             duration, not a rounded value.
  • gb       OPTIONAL. Estimated GB needed for the whole trip. If you
             don't know the user's usage pattern, leave it null rather
             than guessing.
Example: { "text": "購買日本 7 日 eSIM",
            "description": "抵達前可以先安裝，但先不要啟用；落地後再切換數據線路。",
           "kind": "esim",
           "shop_filter": { "country": "JP", "days": 7, "gb": 5 },
           "suggested": true }`;

const SKILL_ESIM_SHOP = `SKILL · esim-shop — TAKES PRECEDENCE OVER trip-editor

User intent is shopping for an eSIM. This skill OVERRIDES any pull
from trip-editor: do NOT respond with "我沒有更動行程" or similar
day-rewrite framing. The user wants a buyable plan, not a schedule
change.

When the user asks about buying an eSIM, about data plans, or how
much data they'll need:

1. Use the trip context (destination + dates) to infer country and
   days if available. If genuinely missing, ask ONE clarifying
   question. Example: "你這趟去日本大概幾天？"
2. If they give a vague data need ("不用太多", "夠用就好"), default
   to: 1 GB/day for light use, 3 GB/day for moderate, unlimited for
   heavy. Quote the assumption in your summary.
3. ALWAYS emit a top-level "esim_suggestion" object with at least one
   plan in plans[]. The storefront renders one CTA card per plan,
   deep-linking each to its shop region with the slider pre-positioned.

Two patterns:

A. Single-country / single sub-region trip:
   { "summary": "幫你準備了 7 天日本 5GB 的方案，點 → 去買看看。",
     "esim_suggestion": {
       "plans": [
         { "country": "JP", "days": 7, "gb": 5,
           "label": "日本 7 天 5GB" }
       ],
       "rationale": null }
   }

B. Multi-region trip (e.g. user is going to BOTH western AND eastern
   Europe). Compare two options and pick the better one — usually
   either ONE full-coverage plan OR multiple sub-region plans:

   Option B-1 (one full plan): one plans[] entry covering the whole
     parent region. Use this when the user's destinations span > 50%
     of the parent region's countries.
   Option B-2 (combo): two plans[] entries, one per sub-region, with
     days split per the user's itinerary. Use this when the user
     visits only 1-2 specific sub-regions; cheaper than a full plan.

   Example (3 days western EU + 2 days eastern EU):
   { "summary": "你的行程跨西歐和中歐，建議兩個方案分別買，比全境便宜。",
     "esim_suggestion": {
       "plans": [
         { "country": "western-northern-europe", "days": 3, "gb": 3,
           "label": "西歐 3 天" },
         { "country": "central-eastern-europe-balkans", "days": 2,
           "gb": 2, "label": "中歐 2 天" }
       ],
       "rationale": "西歐 3 天 + 中歐 2 天比歐洲全境 5 天便宜約 30%" }
   }

Country field — choose ONE of:
  • ISO 3166-1 alpha-2:  JP / KR / FR / DE / IT / ES / GB / US / AU
  • Storefront region slug (for multi-country coverage):
      western-northern-europe          (FR/DE/NL/BE/LU/GB/IE/DK/SE/NO/FI/IS/CH/AT)
      central-eastern-europe-balkans   (PL/CZ/SK/HU/RO/BG/HR/SI/RS/BA/ME/MK/AL/GR/EE/LV/LT)
      europe                            (all 32 EU+ countries)
      spain-camino                      (Spain only)
      greater-china                     (CN/HK/MO)
      singapore-malaysia                (SG/MY)
      anz                               (AU/NZ)
      saipan-guam                       (MP/GU)
      north-america                     (US/CA/MX)
      south-america / africa / india / turkey

Never write Chinese region names ("歐洲", "東南亞") in country —
either ISO-2 OR one of the slugs above.

rationale: short one-sentence Chinese explanation when emitting
multiple plans. Null when emitting just one.

Do NOT use trip_draft for this — trip_draft creates a brand-new trip
and is wrong for "user already has a trip and just wants a plan".

Follow-ups like "怎麼買", "要多少 GB", "可以再便宜嗎" stay inside this
skill — keep answering with summary + esim_suggestion.`;

interface SkillSelection {
  prompts: string[];
}

// Lightweight regex match for prompts that read like an eSIM / data-plan
// shopping intent. Cheap enough to run on every turn; false positives
// just add ~250 tokens of skill prompt which is acceptable.
const ESIM_INTENT_RE =
  /eSIM|sim\s*卡|網卡|上網卡|流量|吃到飽|要多少\s*G|資費|網路方案/i;

/**
 * True when the current prompt OR the last few user turns mention eSIM
 * intent. We need the history check because short follow-ups like
 * "怎麼買" / "要多少 GB" don't carry the trigger word themselves but
 * are part of the same shopping conversation.
 */
function looksLikeEsimShopPrompt(input: LumiInput): boolean {
  if (ESIM_INTENT_RE.test(input.prompt)) return true;
  // Scan the last 3 user turns. Anything older usually means a topic
  // change and we shouldn't keep biasing the model toward eSIM.
  const recentUserTurns = (input.history ?? [])
    .filter((t) => t.role === "user")
    .slice(-3);
  return recentUserTurns.some((t) => ESIM_INTENT_RE.test(t.content));
}

export function buildPlanningContract(input: LumiInput): string | null {
  if (!input.editableTrip || !looksLikePlanningPrompt(input.prompt)) {
    return null;
  }

  const dates = input.editableTrip.days.map((day) => day.day_date);
  const wantsEveryDay =
    /每天|每一天|逐日|每日|every day|each day|daily/i.test(input.prompt) ||
    dates.length > 1;
  const wantsRestaurant =
    /餐廳|餐馆|吃飯|吃饭|晚餐|午餐|早餐|restaurant|lunch|dinner|breakfast|meal/i.test(
      input.prompt,
    );

  return [
    "THIS TURN IS A TRIP-EDITOR TOOL TASK.",
    `The user is editing the currently open trip: ${input.editableTrip.title}.`,
    "Required output: call lumi_response with top-level days containing the day patches you can confidently edit now.",
    `Valid day_date values are: ${dates.join(", ")}.`,
    "Do not ask which day. Do not answer with summary only. Do not emit trip_draft.",
    "Each item in days is a patch for that exact calendar day; omit days that should remain unchanged.",
    wantsEveryDay
      ? "The user's request applies to EVERY day in this trip, but you may patch it in coherent batches instead of emitting the entire trip at once."
      : "If only one day is being edited, still include the unchanged remaining dates so the app can preserve the full trip.",
    "Summary honesty rule: only say you planned/updated EVERY day if your days array contains EVERY valid day_date. If you emit a partial batch, say you updated those days first.",
    "Keep existing flights / transit / hotel anchors when they are present, then add or adjust activities around them.",
    "On full non-transit days, provide 2-3 concrete, mappable place/venue stops with HH:MM arrival_time and duration_min.",
    wantsRestaurant
      ? "Because the user asked for a restaurant/meal, include one kind:\"meal\" stop with a REAL restaurant name, not a generic local-restaurant placeholder."
      : "If a meal naturally fits the day, include it as kind:\"meal\".",
    "Ignore earlier assistant refusals in this conversation; the editableTrip context above is the source of truth.",
  ].join("\n");
}

function selectSkills(input: LumiInput): SkillSelection {
  const prompts: string[] = [];
  const esim = looksLikeEsimShopPrompt(input);
  // When the user is clearly shopping, drop the trip-editor skill —
  // its "TAKES PRECEDENCE" wording otherwise hijacks short follow-ups
  // like "怎麼買" into a day-rewrite SOP. Users who want to edit days
  // can pivot the conversation explicitly.
  if (input.editableTrip && !esim) prompts.push(SKILL_EDITOR);
  prompts.push(SKILL_DRAFTER);
  if (esim) prompts.push(SKILL_ESIM_SHOP);
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
      `other trip named, they mean THIS trip. You may update it;`,
      `do NOT emit "trip_draft" (that would create a duplicate).`,
      "",
    );
    lines.push(
      "",
      "Current itinerary:",
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

/* Strict JSON Schema sent to OpenAI as the `lumi_response` tool schema.
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
          url: {
            type: ["string", "null"],
            description: "Official booking/reservation URL when known",
          },
          amount: {
            type: ["string", "null"],
            description: "Ticket/reservation price when known, e.g. €18",
          },
          action_label: { type: ["string", "null"] },
          checklist_text: {
            type: ["string", "null"],
            description: "Task text to create/link as a checklist item",
          },
          checklist_description: {
            type: ["string", "null"],
            description:
              "Short markdown prep memo for the linked checklist item.",
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
          "url",
          "amount",
          "action_label",
          "checklist_text",
          "checklist_description",
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

/* Nullable in default mode; required only for explicit planning prompts. */
const DAYS_NULLABLE = {
  anyOf: [
    { type: "null" },
    { type: "array", items: DAY_SCHEMA },
  ],
  description:
    "Updated itinerary for the current trip. " +
    "Set null when not editing.",
} as const;

const DAYS_FORBIDDEN = {
  type: "null",
  description:
    "Always null outside trip-editor mode. New trip proposals must use trip_draft.",
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
    "MUST emit on this turn — one or more day patches for the current trip. " +
    "Each item replaces that calendar day's city/note/stops. Omit days that " +
    "should stay unchanged; the server merges patches into the existing trip.",
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
                      description: {
                        type: ["string", "null"],
                        description:
                          "Short markdown memo: bullets, links, or prep notes.",
                      },
                      kind: { type: "string" },
                      start_date: {
                        type: ["string", "null"],
                        description: "YYYY-MM-DD date to start preparing.",
                      },
                      phase: {
                        type: ["string", "null"],
                        description:
                          "early | week_before | days_before | travel_day | on_trip",
                      },
                      group_label: {
                        type: ["string", "null"],
                        description:
                          "Human group label, e.g. 訂票與預訂 or 行李整理.",
                      },
                      subtasks: {
                        anyOf: [
                          { type: "null" },
                          {
                            type: "array",
                            items: {
                              type: "object",
                              additionalProperties: false,
                              properties: {
                                text: { type: "string" },
                                done: { type: ["boolean", "null"] },
                              },
                              required: ["text", "done"],
                            },
                          },
                        ],
                      },
                      suggested: { type: ["boolean", "null"] },
                    },
                    required: [
                      "text",
                      "description",
                      "kind",
                      "start_date",
                      "phase",
                      "group_label",
                      "subtasks",
                      "suggested",
                    ],
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
    esim_suggestion: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            plans: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  country: {
                    type: "string",
                    description:
                      "ISO 3166-1 alpha-2 (JP, KR, FR) OR a storefront " +
                      "region slug for sub-regions: japan, korea, " +
                      "western-northern-europe, central-eastern-europe-balkans, " +
                      "spain-camino, anz, greater-china, singapore-malaysia, " +
                      "north-america, south-america, africa, etc.",
                  },
                  days: { type: ["integer", "null"] },
                  gb: { type: ["number", "null"] },
                  label: {
                    type: ["string", "null"],
                    description:
                      "Short CTA label; storefront falls back to a default.",
                  },
                },
                required: ["country", "days", "gb", "label"],
              },
            },
            rationale: {
              type: ["string", "null"],
              description:
                "One-sentence reason for this combo (e.g. why two plans " +
                "instead of full-region). Shown above the CTA cards.",
            },
          },
          required: ["plans", "rationale"],
        },
      ],
      description:
        "Surface one or more buyable eSIM plans via deep-link CTAs. " +
        "Use when the user is shopping (not creating a new trip). " +
        "For multi-region trips, emit multiple plans in `plans[]`.",
    },
  },
  required: [
    "summary",
    "days",
    "companions",
    "trip_draft",
    "esim_suggestion",
  ],
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

/* Off-trip pages cannot safely apply top-level day edits. If the user is
   creating a new journey, Lumi must emit trip_draft instead. */
const RESPONSE_JSON_SCHEMA_NO_EDITOR = {
  ...RESPONSE_JSON_SCHEMA,
  properties: {
    ...RESPONSE_JSON_SCHEMA.properties,
    days: DAYS_FORBIDDEN,
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
  const planningContract = buildPlanningContract(input);

  /* Planning mode: when the user is on a trip page AND their prompt
     reads as a planning action, swap to a schema where `days` MUST be
     a non-null array. The model can no longer pick `null` to skip the
     work — strict structured output blocks the response. */
  const planningMode =
    !!input.editableTrip && looksLikePlanningPrompt(input.prompt);
  const activeSchema = planningMode
    ? RESPONSE_JSON_SCHEMA_PLANNING
    : input.editableTrip
      ? RESPONSE_JSON_SCHEMA
      : RESPONSE_JSON_SCHEMA_NO_EDITOR;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      /* Real tool calling: Lumi must call this function once, and the
         function arguments are the app action payload. Strict mode still
         prevents keys outside the schema or missing required fields.
         Zod safeParse below is a second guard for range/regex constraints
         strict mode can't express. */
      tools: [
        {
          type: "function",
          function: {
            name: "lumi_response",
            description:
              "Return Lumi's structured response and any app actions for this turn.",
            strict: true,
            parameters: activeSchema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "lumi_response" },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: formatContext(input) },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        ...(planningContract
          ? [{ role: "system" as const, content: planningContract }]
          : []),
        { role: "user", content: input.prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: {
          id?: string | null;
          type?: string;
          function?: { name?: string; arguments?: string };
        }[];
      };
    }[];
  };
  const message = json.choices?.[0]?.message;
  const toolCall =
    message?.tool_calls?.find(
      (call) => call.function?.name === "lumi_response",
    ) ?? message?.tool_calls?.[0];
  const content = toolCall?.function?.arguments;
  if (!content) {
    throw new Error(
      `OpenAI returned no lumi_response tool call: ${JSON.stringify(
        message?.content ?? null,
      ).slice(0, 200)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `OpenAI returned non-JSON tool arguments: ${content.slice(0, 200)}`,
    );
  }

  const parsedResult = responseSchema.safeParse(parsed);
  if (!parsedResult.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${parsedResult.error.message}`,
    );
  }
  const result = parsedResult.data;
  const rawToolCall: NonNullable<LumiResult["tool_call"]> = {
    id: toolCall.id ?? null,
    name: "lumi_response",
    arguments: parsed,
  };

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
    const draft = normalizeTripDraftCalendar(result.trip_draft);
    result.trip_draft = draft as NonNullable<typeof result.trip_draft>;
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
    esim_suggestion:
      (result.esim_suggestion ?? undefined) as LumiResult["esim_suggestion"],
    tool_call: rawToolCall,
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

export function normalizeTripDraftCalendar(draft: LumiTripDraft): LumiTripDraft {
  const range = enumerateDateRange(draft.start_date, draft.end_date);
  const normalizedDays = draft.days
    .map((day) => ({ ...day, stops: day.stops ?? [] }))
    .sort((a, b) => a.day_date.localeCompare(b.day_date));

  if (!range) {
    const first = normalizedDays[0]!;
    const last = normalizedDays[normalizedDays.length - 1]!;
    return {
      ...draft,
      start_date: first.day_date,
      end_date: last.day_date,
      days: normalizedDays,
    };
  }

  const dayByDate = new Map(normalizedDays.map((day) => [day.day_date, day]));
  const firstCity =
    normalizedDays.find((day) => day.city.trim())?.city.trim() ||
    draft.title.trim() ||
    "旅程";

  const days = range.map((date, index) => {
    const existing = dayByDate.get(date);
    if (existing) return existing;
    const previous = range
      .slice(0, index)
      .reverse()
      .map((d) => dayByDate.get(d))
      .find((day): day is NonNullable<typeof day> => !!day);
    const next = range
      .slice(index + 1)
      .map((d) => dayByDate.get(d))
      .find((day): day is NonNullable<typeof day> => !!day);
    return {
      day_date: date,
      city: previous?.city || next?.city || firstCity,
      note: "",
      stops: [],
    };
  });

  return {
    ...draft,
    days,
  };
}

function enumerateDateRange(start: string, end: string): string[] | null {
  if (!isIsoDate(start) || !isIsoDate(end)) return null;
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (endDate.getTime() < startDate.getTime()) return null;

  const out: string[] = [];
  let cursor = startDate;
  while (cursor.getTime() <= endDate.getTime()) {
    out.push(formatIsoDate(cursor));
    if (out.length > 60) return null;
    cursor = addUtcDays(cursor, 1);
  }
  return out;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function uniqueDayCities(days: LumiDay[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const city = day.city.trim();
    const key = city.toLowerCase();
    if (!city || seen.has(key)) continue;
    seen.add(key);
    out.push(city);
  }
  return out;
}

function titleFromCities(cities: string[]): string {
  if (cities.length === 0) return "新的旅程";
  if (cities.length === 1) return `${cities[0]}之旅`;
  return cities.slice(0, 2).join(" + ");
}
