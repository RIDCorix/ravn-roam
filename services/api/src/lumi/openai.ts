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

export interface LumiDay {
  day_date: string;
  city: string;
  note: string;
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

const responseSchema = z.object({
  summary: z.string().min(1).max(1500),
  days: z
    .array(
      z.object({
        day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        city: z.string().min(1).max(120),
        note: z.string().max(2000).default(""),
      }),
    )
    .min(1)
    .max(60)
    .optional(),
  companions: z
    .array(
      z.object({
        id: z.string().nullable().optional(),
        display_name: z.string().min(1).max(80).optional(),
        color: z.string().max(20).optional(),
        delete: z.boolean().optional(),
      }),
    )
    .max(12)
    .optional(),
  trip_draft: z
    .object({
      title: z.string().min(1).max(200),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cover: z.string().max(80).nullish(),
      days: z
        .array(
          z.object({
            day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            city: z.string().min(1).max(120),
            note: z.string().max(2000).default(""),
          }),
        )
        .min(1)
        .max(60),
      checklist: z
        .array(
          z.object({
            text: z.string().min(1).max(500),
            kind: z.string().min(1).max(40),
            suggested: z.boolean().optional(),
          }),
        )
        .max(40)
        .optional(),
    })
    .optional(),
});

// ── Core prompt ────────────────────────────────────────────────────────
// Kept deliberately tiny. It only describes who Lumi is and the response
// envelope. Situational SOPs live in the SKILLS map below and are loaded
// conditionally per turn so the model isn't drowning in instructions
// that don't apply to its current input.

const CORE_PROMPT = `You are Lumi, a travel assistant inside the Roam eSIM app.
Reply with strict JSON, no markdown, no commentary.

Possible shapes:
  { "summary": string }                              // default — just answer
  { "summary": ..., "days": [ … ] }                  // edit current trip's days
  { "summary": ..., "companions": [ … ] }            // CRUD current trip's companions
  { "summary": ..., "trip_draft": { … } }            // propose a brand-new trip

Add keys only when the relevant skill below tells you to. Write "summary" in the user's language (default 繁中, 一兩句話). Be honest about what you don't know.`;

// ── Skills ─────────────────────────────────────────────────────────────
// Each skill is a focused SOP. selectSkills() picks which to attach to
// a given turn — typically one, sometimes two. Adding more skills (e.g.
// "esim-troubleshoot", "shop-recommend") goes here without touching the
// core prompt.

const SKILL_EDITOR = `SKILL · trip-editor
The user is viewing this trip's detail page right now. You may rewrite
its days and/or CRUD its companions.

days: chronological { day_date: "YYYY-MM-DD", city, note }[]. Reorder,
edit notes, add/remove days, change cities. Omit when not editing.

companions: each row is { id? | display_name | color? | delete? }. Omit
id to create. Provide existing id to rename or { id, delete: true } to
remove. Never invent uuids. Omit when not editing.`;

const SKILL_DRAFTER = `SKILL · trip-drafter
If the user is describing a new trip (destination + when + duration —
including pastes of flight tickets, e-tickets, hotel confirmations),
emit trip_draft:
  { title, start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD",
    cover?: 2-letter region tag, days: [...], checklist?: [...] }

Extract dates from any pasted itinerary silently — outbound = start,
return = end. Compute duration yourself: (end - start + 1) days.
Never re-ask what's already in the input.

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
    lines.push(
      "",
      "Editable trip — the user is viewing this trip's detail page right now.",
      "You may rewrite its days. Current day list (ground truth):",
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

export async function runLumiTurn(input: LumiInput): Promise<LumiResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the API service — set it in services/api/.env.",
    );
  }

  const history = (input.history ?? []).slice(-12);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${result.error.message}`,
    );
  }

  if (result.data.days) {
    // Safety: editor mode requires an editable trip in the input. If
    // Lumi tries to emit days without it, drop them.
    if (!input.editableTrip) {
      delete result.data.days;
    } else {
      for (let i = 1; i < result.data.days.length; i++) {
        if (
          result.data.days[i]!.day_date <= result.data.days[i - 1]!.day_date
        ) {
          throw new Error("OpenAI returned non-chronological day list");
        }
      }
    }
  }
  if (result.data.companions && !input.editableTrip) {
    delete result.data.companions;
  }
  if (result.data.trip_draft) {
    const draft = result.data.trip_draft;
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

  return result.data;
}
