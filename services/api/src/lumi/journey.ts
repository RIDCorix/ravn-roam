// Lumi V2 journey planner. A staged pipeline with a server-enforced ORDER
// and model-decided CONTENT:
//
//   1. frame   — trip window + ordered city stays (nights per city)
//   2. anchors — the must-do highlights per city
//   3. days    — full daily schedule, planned one city block at a time
//
// Every step may either return a structured conclusion ("complete") or a
// single traveler-facing question ("question") written by the model in the
// user's language. The server never invents question copy; it only decides
// which step runs next and validates the structured output.

import { z } from "zod";

import { env } from "../env.js";
import {
  LUMI_DAY_JSON_SCHEMA,
  lumiDayListAnchorIssue,
  lumiDaySchema,
  normalizeTripDraftCalendar,
  tripDraftFromLooseDays,
  type LumiDay,
  type LumiFlightDetailsPatch,
  type LumiTripDraft,
} from "./openai.js";

export type JourneyStepId = "frame" | "anchors" | "days";

export interface JourneyQA {
  step: JourneyStepId;
  question: string;
  answer: string;
}

export interface JourneyCityStay {
  name: string;
  country_code: string | null;
  nights: number;
  reason: string;
  lat?: number | null;
  lng?: number | null;
}

export interface JourneyFrame {
  title: string;
  origin: string | null;
  start_date: string;
  end_date: string;
  cities: JourneyCityStay[];
  flight_details?: LumiFlightDetailsPatch[] | null;
}

export interface JourneyAnchorItem {
  name: string;
  place_name: string;
  kind: string;
  note: string;
}

export interface JourneyCityAnchors {
  city: string;
  anchors: JourneyAnchorItem[];
}

export interface JourneyStepInput {
  prompt: string;
  current_date?: string | null;
  qa: JourneyQA[];
  frame: JourneyFrame | null;
  anchors: JourneyCityAnchors[] | null;
  days: LumiDay[];
}

export interface JourneyQuestion {
  text: string;
  options: string[];
}

export type JourneyStepResult =
  | { step: JourneyStepId; status: "question"; question: JourneyQuestion }
  | { step: "frame"; status: "complete"; frame: JourneyFrame; finished: false }
  | {
      step: "anchors";
      status: "complete";
      anchors: JourneyCityAnchors[];
      finished: false;
    }
  | {
      step: "days";
      status: "complete";
      days: LumiDay[];
      block_city: string;
      block_dates: string[];
      finished: boolean;
      trip_draft: LumiTripDraft | null;
    };

// ── Validation schemas ─────────────────────────────────────────────────

const questionSchema = z.object({
  text: z.string().min(1).max(400),
  options: z.array(z.string().min(1).max(80)).max(4).default([]),
});

export const journeyFrameSchema = z.object({
  title: z.string().min(1).max(120),
  origin: z.string().max(120).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flight_details: z
    .array(
      z.object({
        leg_key: z.string().min(1).max(80),
        departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
        departure_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
        flight_number: z.string().min(1).max(16).nullish(),
        terminal: z.string().min(1).max(24).nullish(),
        gate: z.string().min(1).max(12).nullish(),
      }),
    )
    .max(12)
    .nullish(),
  cities: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        country_code: z.string().max(8).nullish(),
        nights: z.number().int().min(0).max(45),
        reason: z.string().max(200).default(""),
        lat: z.number().nullish(),
        lng: z.number().nullish(),
      }),
    )
    .min(1)
    .max(8),
});

export const journeyAnchorsSchema = z
  .array(
    z.object({
      city: z.string().min(1).max(120),
      anchors: z
        .array(
          z.object({
            name: z.string().min(1).max(160),
            place_name: z.string().min(1).max(200),
            kind: z.string().max(40).default("sight"),
            note: z.string().max(300).default(""),
          }),
        )
        .min(1)
        .max(6),
    }),
  )
  .min(1)
  .max(8);

const frameStepResponseSchema = z.object({
  status: z.enum(["complete", "question"]),
  question: questionSchema.nullish(),
  frame: journeyFrameSchema.nullish(),
});

const anchorsStepResponseSchema = z.object({
  status: z.enum(["complete", "question"]),
  question: questionSchema.nullish(),
  cities: journeyAnchorsSchema.nullish(),
});

const daysStepResponseSchema = z.object({
  status: z.enum(["complete", "question"]),
  question: questionSchema.nullish(),
  days: z.array(lumiDaySchema).min(1).max(20).nullish(),
});

// ── Strict JSON schemas sent to OpenAI ─────────────────────────────────

const QUESTION_JSON_SCHEMA = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
          description:
            "One concise question for the traveler, in the traveler's language.",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 short tappable answers in the traveler's language. Empty when free text fits better.",
        },
      },
      required: ["text", "options"],
    },
  ],
} as const;

const FRAME_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      description:
        '"complete" when the trip window and city stays are determined or confidently inferable; "question" when the traveler must decide.',
    },
    question: QUESTION_JSON_SCHEMA,
    frame: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            title: {
              type: "string",
              description: "Short trip title in the traveler's language.",
            },
            origin: {
              type: ["string", "null"],
              description: "Home/departure city when known, else null.",
            },
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
            flight_details: {
              anyOf: [
                { type: "null" },
                {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      leg_key: {
                        type: "string",
                        description:
                          "Flight leg key: outbound, leg-1, leg-2, or return.",
                      },
                      departure_date: {
                        type: ["string", "null"],
                        description: "YYYY-MM-DD local departure date when known.",
                      },
                      departure_time: {
                        type: ["string", "null"],
                        description: "HH:mm local departure time when known.",
                      },
                      flight_number: {
                        type: ["string", "null"],
                        description: "Flight number exactly as provided.",
                      },
                      terminal: {
                        type: ["string", "null"],
                        description:
                          "Airport terminal exactly as provided, e.g. Terminal 1, T1, 第一航廈. Do not put terminal values in gate.",
                      },
                      gate: {
                        type: ["string", "null"],
                        description:
                          "Boarding gate exactly as provided when known. Use null when only a terminal is known.",
                      },
                    },
                    required: [
                      "leg_key",
                      "departure_date",
                      "departure_time",
                      "flight_number",
                      "terminal",
                      "gate",
                    ],
                  },
                },
              ],
              description:
                "Structured flight facts provided by the user. Do not invent missing values.",
            },
            cities: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string", description: "City display name in the traveler's language." },
                  country_code: { type: ["string", "null"], description: "ISO 3166-1 alpha-2." },
                  nights: { type: "integer", description: "Nights spent in this city. All nights must sum to the trip length." },
                  reason: { type: "string", description: "One short clause: why this city / what for. Traveler's language." },
                },
                required: ["name", "country_code", "nights", "reason"],
              },
            },
          },
          required: [
            "title",
            "origin",
            "start_date",
            "end_date",
            "flight_details",
            "cities",
          ],
        },
      ],
    },
  },
  required: ["status", "question", "frame"],
} as const;

const ANCHORS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", description: '"complete" or "question".' },
    question: QUESTION_JSON_SCHEMA,
    cities: {
      anyOf: [
        { type: "null" },
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              city: { type: "string", description: "Must match a frame city name exactly." },
              anchors: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string", description: "Traveler-facing highlight label." },
                    place_name: { type: "string", description: "Exact real Google Maps place name." },
                    kind: { type: "string", description: "sight | meal | shop | other" },
                    note: { type: "string", description: "One short clause: why it is worth it. Traveler's language." },
                  },
                  required: ["name", "place_name", "kind", "note"],
                },
              },
            },
            required: ["city", "anchors"],
          },
        },
      ],
    },
  },
  required: ["status", "question", "cities"],
} as const;

const DAYS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", description: '"complete" or "question".' },
    question: QUESTION_JSON_SCHEMA,
    days: {
      anyOf: [{ type: "null" }, { type: "array", items: LUMI_DAY_JSON_SCHEMA }],
    },
  },
  required: ["status", "question", "days"],
} as const;

// ── Prompts ────────────────────────────────────────────────────────────

const JOURNEY_CORE_PROMPT = `You are Lumi, a travel planner inside the Roam eSIM app.
You are executing ONE step of a staged planning pipeline. Read the traveler's
original prompt and the Q&A so far, then either:

- return status "complete" with this step's structured conclusion, when the
  facts are stated or confidently inferable from the prompt; or
- return status "question" when a decision genuinely needs the traveler
  (missing dates or duration, ambiguous destination, conflicting constraints).
  Ask ONE concise question in the traveler's language, with 2-4 short
  tappable options when natural. Never ask about anything already stated in
  the prompt or already answered in the Q&A. Never ask more than necessary.

Quality bar: recommend real, specific, well-known places that exist. Never
invent venues and never pad with generic filler. Write traveler-facing text
(titles, reasons, notes, questions) in the traveler's language.`;

const FRAME_STEP_PROMPT = `STEP: trip frame (window + city stays).
Decide the trip title, departure origin (null if unknown), start_date and
end_date (resolve relative wording like "下個月" or "month after next" using
today's date), and the ordered list of cities with nights per city. Nights
must sum to the trip length. If the traveler gave a duration but no dates,
or no duration at all, ask. If they named a region but no concrete cities,
propose the best-fit cities yourself; that is your job, not a question.
If the traveler provided ticket or flight facts, set frame.flight_details with leg_key, departure_date, departure_time, flight_number, terminal, and gate. Use null for unknown values and do not invent missing flight facts. Put Terminal 1/T1/第一航廈 into terminal, not gate. Only fill gate when a real boarding gate is provided.`;

const ANCHORS_STEP_PROMPT = `STEP: main highlights per city.
For every frame city, pick 2-4 anchor experiences the trip should be built
around: the signature sights, meals, or shops that match the traveler's
stated interests. Each anchor needs the exact real place name. Only ask a
question if the prompt makes the trip's focus genuinely undecidable.`;

const DAYS_STEP_PROMPT = `STEP: daily schedule for ONE city block.
Plan complete days for exactly the requested dates, in the requested city.
Schema rules: every stop is anchor_mode "exact_place" with a real place_name,
or "regional" with area_name + search_query for discovery slots. Use this
city's anchors on suitable days. 3-5 stops per full day, each with a short
traveler-facing note. On a day that arrives from another city (or from the
trip origin), include explicit kind:"transit" stops anchored to the real
airports or stations, with realistic processing time in duration_min. On the
final trip date, route back toward the origin when the prompt implies a round
trip. day.note is a 1-5 word headline. Questions are a last resort here;
prefer planning with sensible assumptions.`;

// ── Step selection ─────────────────────────────────────────────────────

export interface JourneyDayBlock {
  city: string;
  dates: string[];
}

export function journeyDayBlocks(frame: JourneyFrame): JourneyDayBlock[] {
  const allDates = enumerateDates(frame.start_date, frame.end_date);
  if (allDates.length === 0) return [];
  const blocks: JourneyDayBlock[] = [];
  let cursor = 0;
  for (const [index, city] of frame.cities.entries()) {
    const isLast = index === frame.cities.length - 1;
    const span = isLast
      ? allDates.length - cursor
      : Math.max(1, Math.min(city.nights, allDates.length - cursor - (frame.cities.length - 1 - index)));
    if (cursor >= allDates.length) break;
    blocks.push({
      city: city.name,
      dates: allDates.slice(cursor, cursor + span),
    });
    cursor += span;
  }
  return blocks.filter((block) => block.dates.length > 0);
}

export function nextJourneyDayBlock(
  frame: JourneyFrame,
  days: LumiDay[],
): JourneyDayBlock | null {
  const planned = new Set(days.map((day) => day.day_date));
  for (const block of journeyDayBlocks(frame)) {
    if (block.dates.some((date) => !planned.has(date))) return block;
  }
  return null;
}

function enumerateDates(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return [];
  }
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  while (cursor.getTime() <= endDate.getTime() && out.length <= 60) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ── OpenAI call ────────────────────────────────────────────────────────

const JOURNEY_REQUEST_TIMEOUT_MS = 120_000;
const MAX_STEP_ATTEMPTS = 3;

async function requestJourneyCompletion({
  system,
  user,
  jsonSchema,
  correction,
}: {
  system: string;
  user: string;
  jsonSchema: unknown;
  correction?: string | null;
}): Promise<unknown> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the API service — set it in services/api/.env.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    JOURNEY_REQUEST_TIMEOUT_MS,
  );
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        ...(/^(gpt-5|o\d)/i.test(env.OPENAI_MODEL) ? {} : { temperature: 0.2 }),
        tools: [
          {
            type: "function",
            function: {
              name: "journey_step",
              description: "Return this planning step's structured result.",
              strict: true,
              parameters: jsonSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "journey_step" } },
        messages: [
          { role: "system", content: system },
          ...(correction
            ? [{ role: "system" as const, content: correction }]
            : []),
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("OpenAI request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: {
      message?: {
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("OpenAI returned no journey_step tool call");
  try {
    return JSON.parse(args);
  } catch {
    throw new Error(`OpenAI returned non-JSON tool arguments: ${args.slice(0, 200)}`);
  }
}

// ── Step runners ───────────────────────────────────────────────────────

function formatJourneyContext(input: JourneyStepInput): string {
  const lines: string[] = [];
  if (input.current_date) lines.push(`Today's date: ${input.current_date}`);
  lines.push("", "Traveler's original prompt:", input.prompt);
  if (input.qa.length > 0) {
    lines.push("", "Q&A so far (the traveler already answered these):");
    for (const qa of input.qa) {
      lines.push(`Q (${qa.step}): ${qa.question}`, `A: ${qa.answer}`);
    }
  }
  if (input.frame) {
    lines.push("", "Confirmed trip frame:", JSON.stringify(input.frame));
  }
  if (input.anchors) {
    lines.push("", "Confirmed highlights:", JSON.stringify(input.anchors));
  }
  if (input.days.length > 0) {
    lines.push(
      "",
      "Days already planned (do not change them):",
      JSON.stringify(
        input.days.map((day) => ({
          day_date: day.day_date,
          city: day.city,
          stops: (day.stops ?? []).map((stop) => stop.name),
        })),
      ),
    );
  }
  return lines.join("\n");
}

export async function runJourneyStep(
  input: JourneyStepInput,
): Promise<JourneyStepResult> {
  if (!input.frame) return runFrameStep(input);
  if (!input.anchors) return runAnchorsStep(input);
  return runDaysStep(input);
}

async function runFrameStep(input: JourneyStepInput): Promise<JourneyStepResult> {
  let correction: string | null = null;
  for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS; attempt++) {
    const raw = await requestJourneyCompletion({
      system: `${JOURNEY_CORE_PROMPT}\n\n${FRAME_STEP_PROMPT}`,
      user: formatJourneyContext(input),
      jsonSchema: FRAME_JSON_SCHEMA,
      correction,
    });
    const parsed = frameStepResponseSchema.safeParse(raw);
    if (!parsed.success) {
      correction = `Previous response failed validation: ${parsed.error.message.slice(0, 400)}. Re-emit a valid journey_step.`;
      continue;
    }
    if (parsed.data.status === "question" && parsed.data.question) {
      return { step: "frame", status: "question", question: { text: parsed.data.question.text, options: parsed.data.question.options } };
    }
    if (parsed.data.frame) {
      const frame = parsed.data.frame;
      if (frame.end_date < frame.start_date) {
        correction = "end_date must not be before start_date. Re-emit.";
        continue;
      }
      return {
        step: "frame",
        status: "complete",
        frame: {
          ...frame,
          origin: frame.origin ?? null,
          cities: frame.cities.map((city) => ({
            ...city,
            country_code: city.country_code ?? null,
            lat: null,
            lng: null,
          })),
        },
        finished: false,
      };
    }
    correction =
      'Response had status "complete" but frame was null. Emit the frame, or ask a question.';
  }
  throw new Error("journey frame step failed validation after retries");
}

async function runAnchorsStep(
  input: JourneyStepInput,
): Promise<JourneyStepResult> {
  let correction: string | null = null;
  for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS; attempt++) {
    const raw = await requestJourneyCompletion({
      system: `${JOURNEY_CORE_PROMPT}\n\n${ANCHORS_STEP_PROMPT}`,
      user: formatJourneyContext(input),
      jsonSchema: ANCHORS_JSON_SCHEMA,
      correction,
    });
    const parsed = anchorsStepResponseSchema.safeParse(raw);
    if (!parsed.success) {
      correction = `Previous response failed validation: ${parsed.error.message.slice(0, 400)}. Re-emit a valid journey_step.`;
      continue;
    }
    if (parsed.data.status === "question" && parsed.data.question) {
      return { step: "anchors", status: "question", question: { text: parsed.data.question.text, options: parsed.data.question.options } };
    }
    if (parsed.data.cities && parsed.data.cities.length > 0) {
      return {
        step: "anchors",
        status: "complete",
        anchors: parsed.data.cities,
        finished: false,
      };
    }
    correction =
      'Response had status "complete" but cities was null or empty. Emit anchors for every frame city, or ask a question.';
  }
  throw new Error("journey anchors step failed validation after retries");
}

async function runDaysStep(input: JourneyStepInput): Promise<JourneyStepResult> {
  const frame = input.frame!;
  const block = nextJourneyDayBlock(frame, input.days);
  if (!block) {
    // Everything already planned — assemble the final draft.
    return {
      step: "days",
      status: "complete",
      days: [],
      block_city: "",
      block_dates: [],
      finished: true,
      trip_draft: assembleJourneyDraft(frame, input.days),
    };
  }

  const blockBrief = [
    `Plan ONLY these dates, all in ${block.city}: ${block.dates.join(", ")}.`,
    `Emit exactly one day object per listed date — no other dates.`,
  ].join("\n");

  let correction: string | null = null;
  for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS; attempt++) {
    const raw = await requestJourneyCompletion({
      system: `${JOURNEY_CORE_PROMPT}\n\n${DAYS_STEP_PROMPT}\n\n${blockBrief}`,
      user: formatJourneyContext(input),
      jsonSchema: DAYS_JSON_SCHEMA,
      correction,
    });
    const parsed = daysStepResponseSchema.safeParse(raw);
    if (!parsed.success) {
      correction = `Previous response failed validation: ${parsed.error.message.slice(0, 400)}. Re-emit a valid journey_step.`;
      continue;
    }
    if (parsed.data.status === "question" && parsed.data.question) {
      return { step: "days", status: "question", question: { text: parsed.data.question.text, options: parsed.data.question.options } };
    }
    const days = parsed.data.days ?? [];
    const expected = new Set(block.dates);
    const emitted = new Set(days.map((day) => day.day_date));
    const missing = block.dates.filter((date) => !emitted.has(date));
    const extra = days.filter((day) => !expected.has(day.day_date));
    if (missing.length > 0 || extra.length > 0) {
      correction = `Date contract failed. Missing: ${missing.join(", ") || "none"}. Out of range: ${extra.map((day) => day.day_date).join(", ") || "none"}. Emit exactly one day per requested date.`;
      continue;
    }
    const anchorIssue = lumiDayListAnchorIssue(days as LumiDay[]);
    if (anchorIssue && attempt < MAX_STEP_ATTEMPTS - 1) {
      correction = anchorIssue;
      continue;
    }

    const allDays = [...input.days, ...(days as LumiDay[])].sort((a, b) =>
      a.day_date.localeCompare(b.day_date),
    );
    const finished = nextJourneyDayBlock(frame, allDays) === null;
    return {
      step: "days",
      status: "complete",
      days: days as LumiDay[],
      block_city: block.city,
      block_dates: block.dates,
      finished,
      trip_draft: finished ? assembleJourneyDraft(frame, allDays) : null,
    };
  }
  throw new Error("journey days step failed validation after retries");
}

function assembleJourneyDraft(
  frame: JourneyFrame,
  days: LumiDay[],
): LumiTripDraft {
  const base = tripDraftFromLooseDays(days);
  return normalizeTripDraftCalendar({
    ...base,
    title: frame.title,
    start_date: frame.start_date,
    end_date: frame.end_date,
    cover: frame.cities[0]?.name?.slice(0, 2) ?? base.cover,
    flight_details: frame.flight_details ?? null,
  });
}
