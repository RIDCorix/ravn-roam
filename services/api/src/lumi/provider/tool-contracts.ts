import { z } from "zod";

import type { LumiCapability } from "../capabilities.js";
import { realIsoDateSchema } from "../contracts/date.js";
import { lumiDaySchema as lumiDayContractSchema } from "../contracts/snapshot.js";
import type { LumiDay, LumiResult } from "../contracts/result.js";
import type { LumiStop } from "../contracts/values.js";
import { normalizeLumiDayCities } from "../domain/itinerary-values.js";

const flightDetailsSchema = z.object({
  leg_key: z.string().min(1).max(80),
  departure_date: realIsoDateSchema.nullish(),
  departure_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  flight_number: z.string().min(1).max(16).nullish(),
  terminal: z.string().min(1).max(24).nullish(),
  gate: z.string().min(1).max(12).nullish(),
}).strict();

/* A day with optional inline stops. `stops` defaults to [] so legacy Lumi
   replies that only set `city` still validate; the API materializes a
   single placeholder stop when stops is empty. */
export const lumiDaySchema = lumiDayContractSchema.transform((day) => ({
  ...day,
  cities: normalizeLumiDayCities(day),
}));

/* All "optional" top-level fields use `.nullish()` so the strict-mode
   JSON Schema can require them while letting the model emit `null` for
   "no action this turn". Range / length constraints below still gate
   the inner contents via post-parse zod validation. */
const responseSchema = z.object({
  summary: z.string().min(1).max(1500),
  days: z.array(lumiDaySchema).min(1).max(60).nullish(),
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
  flight_details: z.array(flightDetailsSchema).max(12).nullish(),
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
      days: z.array(lumiDaySchema).min(1).max(60),
      flight_details: z.array(flightDetailsSchema).max(12).nullish(),
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

function normalizeAreaSuggestionAnchors(
  result: z.infer<typeof responseSchema>,
): void {
  if (result.days) {
    result.days = result.days.map(normalizeAreaSuggestionDay);
  }
  if (result.trip_draft?.days) {
    result.trip_draft = {
      ...result.trip_draft,
      days: result.trip_draft.days.map(normalizeAreaSuggestionDay),
    };
  }
}

function normalizeAreaSuggestionDay<T extends { stops?: LumiStop[] }>(day: T): T {
  if (!day.stops?.length) return day;
  return {
    ...day,
    stops: day.stops.map(normalizeAreaSuggestionStop),
  };
}

function normalizeAreaSuggestionStop(stop: LumiStop): LumiStop {
  const anchorMode =
    stop.anchor_mode === "suggested_places" || stop.kind === "suggested_places"
      ? "regional"
      : stop.anchor_mode;
  if (stop.kind === "suggested_places") {
    stop = { ...stop, kind: "other" };
  }
  if (anchorMode !== "regional") return stop;
  return normalizeSuggestedStopDefaults({ ...stop, anchor_mode: "regional" });
}

function normalizeSuggestedStopDefaults(stop: LumiStop): LumiStop {
  return {
    ...stop,
    anchor_mode: "regional",
    place_name: null,
    place_id: null,
    place_address: null,
    area_name: stop.area_name ?? null,
    search_query: stop.search_query ?? null,
    place_types: stop.place_types ?? [],
    suggestion_count: stop.suggestion_count ?? 5,
    lat: null,
    lng: null,
  };
}

function anchorContractIssue(
  result: z.infer<typeof responseSchema>,
): string | null {
  const issues: string[] = [];
  const scanStop = (stop: LumiStop, location: string) => {
    const anchorMode =
      stop.anchor_mode === "suggested_places" || stop.kind === "suggested_places"
        ? "regional"
        : stop.anchor_mode ?? "exact_place";
    if (anchorMode === "regional") {
      if (stop.place_name?.trim()) {
        issues.push(`${location}: regional stop must set place_name to null.`);
      }
      if (!stop.search_query?.trim()) {
        issues.push(`${location}: regional stop must provide search_query.`);
      }
      return;
    }
    if (
      !stop.place_name?.trim() &&
      !stop.place_id?.trim() &&
      stop.kind !== "placeholder"
    ) {
      issues.push(`${location}: exact_place stop must provide place_name.`);
    }
  };
  const scanDays = (days: LumiDay[] | null | undefined, prefix: string) => {
    for (const [dayIndex, day] of (days ?? []).entries()) {
      for (const [stopIndex, stop] of (day.stops ?? []).entries()) {
        scanStop(stop, `${prefix}[${dayIndex}].stops[${stopIndex}]`);
      }
    }
  };

  scanDays(result.days, "days");
  scanDays(result.trip_draft?.days, "trip_draft.days");
  if (issues.length === 0) return null;
  return [
    "Structured stop anchor contract failed.",
    ...issues.slice(0, 8),
    "Re-emit with anchor_mode:\"regional\" plus search_query for discovery slots, and anchor_mode:\"exact_place\" plus a real place_name only for concrete named venues.",
  ].join(" ");
}

/* Anchor-contract check over a bare day list, for pipelines that do not
   use the chat response envelope (e.g. the V2 journey planner). */
export function lumiDayListAnchorIssue(days: LumiDay[]): string | null {
  return anchorContractIssue({
    summary: "journey",
    days,
    companions: null,
    esim_suggestion: null,
    trip_draft: null,
  } as z.infer<typeof responseSchema>);
}

/* Drop place_ids the model invented: an id is only trusted when it came
   from this turn's search_places results or already existed on the trip.
   Only active when a Places key is configured (otherwise nothing can be
   verified and legacy behavior applies). */
export function stripUnverifiedStopPlaceIds(
  result: { days?: LumiDay[] | null; trip_draft?: { days: LumiDay[] } | null },
  verified: ReadonlySet<string>,
): void {
  const scrub = (days: LumiDay[] | null | undefined) => {
    for (const day of days ?? []) {
      day.stops = (day.stops ?? []).map((stop) =>
        stop.place_id && !verified.has(stop.place_id)
          ? { ...stop, place_id: null }
          : stop,
      );
    }
  };
  scrub(result.days);
  scrub(result.trip_draft?.days);
}

/* Generic intercity-travel contract. Replaces the old server-side airport
   injection (which only knew five hardcoded cities): instead of patching the
   model's output, reject-and-retry until the model itself anchors every
   multi-city day with real transit stops. Works for any city worldwide. */
function flightRouteContractIssue(
  result: z.infer<typeof responseSchema>,
): string | null {
  const issues: string[] = [];
  const scanDays = (days: LumiDay[] | null | undefined, prefix: string) => {
    for (const [dayIndex, day] of (days ?? []).entries()) {
      const cities = normalizeLumiDayCities(day);
      if (cities.length < 2) continue;
      const hasTransitAnchor = (day.stops ?? []).some(
        (stop) =>
          (stop.kind === "transit" || stop.kind === "airport_transfer") &&
          (stop.place_name?.trim() || stop.place_id?.trim()),
      );
      if (!hasTransitAnchor) {
        issues.push(
          `${prefix}[${dayIndex}] (${day.day_date}) moves ${cities.join(" -> ")} but has no transit stop anchored to a real airport or station.`,
        );
      }
    }
  };
  scanDays(result.days, "days");
  scanDays(result.trip_draft?.days, "trip_draft.days");
  if (issues.length === 0) return null;
  return [
    "Intercity travel contract failed.",
    ...issues.slice(0, 6),
    'Every day whose cities path has two or more cities must include explicit kind:"transit" stops anchored to the real departure and arrival airports or stations (anchor_mode:"exact_place" with the real place_name). Reserve airport processing time in duration_min (about 120 departure / 45 arrival) and keep any same-day activities.',
  ].join(" ");
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
    stop_id: {
      type: ["string", "null"],
      description: "Exact existing stop_id when retaining a stop during update_trip_day; null for a new stop.",
    },
    name: {
      type: "string",
      description:
        "Traveler-facing itinerary label shown in the timeline. May be editorial.",
    },
    anchor_mode: {
      type: "string",
      description:
        "Only exact_place or regional. Never use transit, hotel, airport, sight, meal, shop, or other category words as anchor_mode; those belong in kind. Use exact_place only for one known real venue/place, including transit anchors such as airports and stations. Use regional for category/area discovery where the app should suggest multiple real places. Do not use exact_place with generic category names such as Design Shops, Furniture Showroom, Art Galleries, Restaurants, Shops, Stores, or Galleries.",
    },
    place_name: {
      type: ["string", "null"],
      description:
        "Exact real Google Maps venue/store/airport/hotel/place name for exact_place stops. Must be null for regional area/category discovery stops. Never put category labels, activity labels, or invented representative names here.",
    },
    place_id: {
      type: ["string", "null"],
      description:
        "Google Places id only when confirmed from a real Google Maps/Places candidate for place_name whose location roughly matches the expected city/country. Never invent or reuse an unrelated id; use null when uncertain.",
    },
    place_address: {
      type: ["string", "null"],
      description: "Google Maps formatted address when known; otherwise null.",
    },
    area_name: {
      type: ["string", "null"],
      description:
        "Neighborhood, district, street, landmark area, or null for city-wide regional discovery. Use null for exact_place.",
    },
    search_query: {
      type: ["string", "null"],
      description:
        "Required for regional discovery: concise English Google Places query, e.g. restaurant dinner, art gallery, design store concept shop, furniture showroom home goods store. Use null for exact_place.",
    },
    country_code: {
      type: ["string", "null"],
      description: "ISO country code when clear, e.g. IT, FR, ES, GB.",
    },
    place_types: {
      type: "array",
      items: { type: "string" },
      description:
        "Recommended for regional discovery when clear: Google Places types, e.g. restaurant, art_gallery, furniture_store, home_goods_store, store. Use [] when the text query is already clearer than a type filter, or for exact_place when unknown.",
    },
    suggestion_count: {
      type: ["integer", "null"],
      description: "How many regional candidates to suggest, usually 3-6.",
    },
    kind: {
      type: "string",
      description:
        "One of: sight | meal | transit | airport_transfer | placeholder | stay | shop | other",
    },
    arrival_time: {
      type: ["string", "null"],
      description: 'Free-form: "10:30" / "morning" / null',
    },
    duration_min: { type: ["integer", "null"] },
    note: {
      type: "string",
      description:
        "Traveler-facing: one short clause on why this stop is worth it or " +
        "one practical tip, in the user's language. Required for sights, " +
        "meals, and shops; may be empty only for obvious transit anchors.",
    },
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
    "stop_id",
    "name",
    "anchor_mode",
    "place_name",
    "place_id",
    "place_address",
    "area_name",
    "search_query",
    "country_code",
    "place_types",
    "suggestion_count",
    "kind",
    "arrival_time",
    "duration_min",
    "note",
    "attachments",
  ],
} as const;

const DAY_SEGMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    city: { type: "string" },
    start_part: {
      type: "string",
      description: "morning | afternoon | evening | full_day",
    },
    end_part: {
      type: "string",
      description: "morning | afternoon | evening | full_day",
    },
    note: {
      type: "string",
      description: "Short label for the city block, or empty string.",
    },
  },
  required: ["city", "start_part", "end_part", "note"],
} as const;

export const LUMI_DAY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    day_date: { type: "string", description: "YYYY-MM-DD" },
    city: { type: "string" },
    cities: {
      type: "array",
      items: { type: "string" },
      description:
        "Ordered cities touched by this day. Single-city day: [city]. " +
        "Flight/arrow route day: ordered origin-to-destination path, e.g. " +
        "台北→米蘭 becomes ['台北','米蘭']; London→Milan becomes ['倫敦','米蘭']. " +
        "Night-move day: primary daytime city first, arrival city after. " +
        "Never leave an arrow route only as a transit stop name; both endpoint cities must appear here. " +
        "Airports are stops, never cities; do not put 桃園機場, Milan Malpensa Airport, CDG, or any airport name here.",
    },
    segments: {
      type: "array",
      items: DAY_SEGMENT_SCHEMA,
      description:
        "Editable overview city blocks inside the day. Single-city day: one full_day segment. " +
        "Arrow route day: include one segment for each endpoint city, never only the destination city. " +
        "Morning flight day: origin morning segment, destination afternoon/evening segment. " +
        "Night flight day: origin morning/afternoon segment, destination evening segment if arrival is same date. " +
        "Airports are transit stops only and must not become segments.",
    },
    note: { type: "string", description: "May be empty string" },
    stops: { type: "array", items: STOP_SCHEMA },
  },
  required: ["day_date", "city", "cities", "segments", "note", "stops"],
} as const;

/* Still part of the base response shape for normalization. Existing-trip
   editor calls override this with DAYS_FORBIDDEN and must use day tools. */
const DAYS_NULLABLE = {
  anyOf: [
    { type: "null" },
    { type: "array", items: LUMI_DAY_JSON_SCHEMA },
  ],
  description:
    "Updated itinerary for the current trip. " +
    "Set null when not editing.",
} as const;

const DAYS_FORBIDDEN = {
  type: "null",
  description:
    "Always null. Existing-trip itinerary edits must be staged through update_trip_day. New trip proposals must use trip_draft.",
} as const;

const FLIGHT_DETAILS_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    leg_key: {
      type: "string",
      description:
        "Flight leg key in exploration Flights: outbound, leg-1, leg-2, or return.",
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
      description: "Airline flight number exactly as provided, e.g. BR 87.",
    },
    terminal: {
      type: ["string", "null"],
      description:
        "Airport terminal exactly as provided, e.g. Terminal 1, T1, 第一航廈. Do not put terminal values in gate.",
    },
    gate: {
      type: ["string", "null"],
      description:
        "Boarding gate exactly as provided when known, e.g. A12. Use null when only a terminal is known.",
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
} as const;

const FLIGHT_DETAILS_NULLABLE = {
  anyOf: [
    { type: "null" },
    { type: "array", items: FLIGHT_DETAILS_ITEM_SCHEMA },
  ],
  description:
    "Structured flight facts to save into the trip's Flights step. Use when the user provides ticket/flight information. Do not invent missing values.",
} as const;

const SET_FLIGHT_DETAILS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    flight_details: {
      type: "array",
      items: FLIGHT_DETAILS_ITEM_SCHEMA,
      description:
        "Flight facts to stage for the trip's exploration Flights step.",
    },
  },
  required: ["flight_details"],
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
    flight_details: FLIGHT_DETAILS_NULLABLE,
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
            days: { type: "array", items: LUMI_DAY_JSON_SCHEMA },
            flight_details: FLIGHT_DETAILS_NULLABLE,
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
                          "Human group label, e.g. Bookings or Packing.",
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
            "flight_details",
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
    "flight_details",
    "trip_draft",
    "esim_suggestion",
  ],
} as const;

/* Top-level day edits are never accepted from the final response. Existing-trip
   edits must be staged through update_trip_day; new journeys use trip_draft. */
const RESPONSE_JSON_SCHEMA_NO_EDITOR = {
  ...RESPONSE_JSON_SCHEMA,
  properties: {
    ...RESPONSE_JSON_SCHEMA.properties,
    days: DAYS_FORBIDDEN,
  },
} as const;

const ACTION_FIELD_FORBIDDEN = {
  type: "null",
  description: "Always null because this turn is not authorized for this action.",
} as const;

function finalResponseSchemaForCapabilities(
  capabilities: ReadonlySet<LumiCapability>,
): unknown {
  return {
    ...RESPONSE_JSON_SCHEMA_NO_EDITOR,
    properties: {
      ...RESPONSE_JSON_SCHEMA_NO_EDITOR.properties,
      companions: ACTION_FIELD_FORBIDDEN,
      flight_details: ACTION_FIELD_FORBIDDEN,
      trip_draft: capabilities.has("draft:finalize")
        ? RESPONSE_JSON_SCHEMA.properties.trip_draft
        : ACTION_FIELD_FORBIDDEN,
      esim_suggestion: capabilities.has("read:esim")
        ? RESPONSE_JSON_SCHEMA.properties.esim_suggestion
        : ACTION_FIELD_FORBIDDEN,
    },
  };
}

function dayJsonSchemaWithoutAttachmentEdits(): unknown {
  return {
    ...LUMI_DAY_JSON_SCHEMA,
    properties: {
      ...LUMI_DAY_JSON_SCHEMA.properties,
      stops: {
        ...LUMI_DAY_JSON_SCHEMA.properties.stops,
        items: {
          ...STOP_SCHEMA,
          properties: {
            ...STOP_SCHEMA.properties,
            attachments: {
              ...STOP_SCHEMA.properties.attachments,
              maxItems: 0,
              description:
                "Must be empty because this turn cannot edit attachments.",
            },
          },
        },
      },
    },
  };
}

const UPDATE_TRIP_DAY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retry_of: { type: ["string", "null"], description: "Opaque attempt_id from the immediately preceding rejected command, or null." },
    day_id: {
      type: "string",
      format: "uuid",
      description:
        "Exact day_id from editableTrip.days for the persisted day being updated.",
    },
    day: LUMI_DAY_JSON_SCHEMA,
  },
  required: ["day_id", "retry_of", "day"],
} as const;

const CREATE_TRIP_DAY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retry_of: { type: ["string", "null"], description: "Opaque attempt_id from the immediately preceding rejected command, or null." },
    trip_id: {
      type: "string",
      format: "uuid",
      description:
        "Exact trip_id from editableTrip for the persisted trip receiving the new day.",
    },
    day: LUMI_DAY_JSON_SCHEMA,
  },
  required: ["trip_id", "retry_of", "day"],
} as const;

const UPSERT_STOP_ATTACHMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retry_of: { type: ["string", "null"], description: "Opaque attempt_id from the immediately preceding rejected command, or null." },
    stop_id: {
      type: "string",
      format: "uuid",
      description:
        "Exact stop_id from editableTrip.days[].stops for the persisted stop receiving the attachment.",
    },
    attachment: STOP_SCHEMA.properties.attachments.items,
  },
  required: ["stop_id", "retry_of", "attachment"],
} as const;

const COMPANION_VALUES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    display_name: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
  },
  required: ["display_name", "color"],
} as const;

const FLIGHT_LEG_VALUES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    departure_date: { type: ["string", "null"] },
    departure_time: { type: ["string", "null"] },
    flight_number: { type: ["string", "null"] },
    terminal: { type: ["string", "null"] },
    gate: { type: ["string", "null"] },
  },
  required: ["departure_date", "departure_time", "flight_number", "terminal", "gate"],
} as const;

function exactCommandSchema(reference: "trip_id" | "companion_id" | "leg_id", valueName?: "companion" | "patch" | "leg", valueSchema: object = FLIGHT_LEG_VALUES_JSON_SCHEMA) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      [reference]: { type: "string", format: "uuid" },
      retry_of: { type: ["string", "null"], description: "Opaque attempt_id from the immediately preceding rejected command, or null." },
      ...(valueName ? { [valueName]: valueSchema } : {}),
    },
    required: valueName ? [reference, "retry_of", valueName] : [reference, "retry_of"],
  };
}

const SEARCH_PLACES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: {
      type: "string",
      description:
        "What to look up, e.g. a venue name to verify ('Septime'), or a category to discover ('specialty coffee').",
    },
    city: {
      type: ["string", "null"],
      description: "City to scope the search, e.g. 巴黎 or Paris.",
    },
    country_code: {
      type: ["string", "null"],
      description: "ISO 3166-1 alpha-2 when known, e.g. FR.",
    },
    max_results: {
      type: ["integer", "null"],
      description: "How many candidates to return, 1-8. Default 5.",
    },
  },
  required: ["query", "city", "country_code", "max_results"],
} as const;

const STAGE_TRIP_DRAFT_DAYS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: LUMI_DAY_JSON_SCHEMA,
      description:
        "One batch of dated days for a new trip draft. Use multiple calls for long pasted manuscripts.",
    },
  },
  required: ["days"],
} as const;


const stageTripDraftDaysToolSchema = z.object({
  days: z.array(lumiDaySchema).min(1).max(60),
}).strict();

const setFlightDetailsToolSchema = z.object({
  flight_details: z.array(flightDetailsSchema).min(1).max(12),
}).strict();

const searchPlacesToolSchema = z.object({
  query: z.string().min(1).max(200),
  city: z.string().max(120).nullish(),
  country_code: z.string().max(8).nullish(),
  max_results: z.number().int().min(1).max(8).nullish(),
}).strict();

const ACTION_TOOL_CAPABILITIES: Record<
  string,
  readonly LumiCapability[]
> = {
  search_places: ["read:places"],
  set_flight_details: ["draft:finalize"],
  update_trip_day: ["trip:update-day"],
  create_trip_day: ["trip:create-day"],
  upsert_stop_attachment: ["trip:edit-attachment"],
  create_companion: ["trip:edit-companion"],
  update_companion: ["trip:edit-companion"],
  delete_companion: ["trip:edit-companion"],
  create_flight_leg: ["trip:update-flight"],
  update_flight_leg: ["trip:update-flight"],
  stage_trip_draft_days: ["draft:stage-day"],
};

export {
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
  flightDetailsSchema,
  flightRouteContractIssue,
  normalizeAreaSuggestionAnchors,
  responseSchema,
  searchPlacesToolSchema,
  setFlightDetailsToolSchema,
  stageTripDraftDaysToolSchema,
};
