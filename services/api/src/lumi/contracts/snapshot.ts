import { z } from "zod";

import type { LumiCity, LumiCompanion, LumiStop } from "./values.js";

const snapshotStopSchema = z.object({
  stop_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  anchor_mode: z
    .enum(["exact_place", "regional", "suggested_places"])
    .default("exact_place")
    .transform((value) =>
      value === "suggested_places" ? "regional" : value,
    ),
  place_name: z.string().max(200).nullish(),
  place_id: z.string().max(300).nullish(),
  place_address: z.string().max(1000).nullish(),
  area_name: z.string().max(200).nullish(),
  search_query: z.string().max(240).nullish(),
  country_code: z.string().max(8).nullish(),
  place_types: z.array(z.string().min(1).max(80)).max(12).default([]),
  suggestion_count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullish()
    .transform((value) => value ?? 5),
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
        status: z
          .enum(["required", "completed", "uploaded"])
          .default("required"),
      }).strict(),
    )
    .max(8)
    .default([]),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
}).strict();

const snapshotDaySegmentSchema = z.object({
  city: z.string().min(1).max(120),
  start_part: z
    .enum(["morning", "afternoon", "evening", "full_day"])
    .default("full_day"),
  end_part: z
    .enum(["morning", "afternoon", "evening", "full_day"])
    .default("full_day"),
  note: z.string().max(2000).default(""),
}).strict();

/** Provider-independent itinerary value contract shared by command adapters. */
export const lumiDaySchema = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().max(120),
  cities: z.array(z.string().min(1).max(120)).max(8).default([]),
  segments: z.array(snapshotDaySegmentSchema).max(8).default([]),
  note: z.string().max(2000).default(""),
  stops: z.array(snapshotStopSchema).max(40).default([]),
}).strict();

export interface EditableStopSnapshot extends LumiStop {
  stop_id: string;
}

export interface EditableDaySnapshot {
  day_id: string;
  day_date: string;
  city: string;
  cities: string[];
  segments?: LumiDaySegment[];
  note: string;
  stops: EditableStopSnapshot[];
}

export interface EditableTripSnapshot {
  trip_id: string;
  title: string;
  start_date: string;
  end_date: string;
  days: EditableDaySnapshot[];
  cities: LumiCity[];
  companions: LumiCompanion[];
  flight_legs?: LumiFlightLeg[];
}

export interface LumiFlightLeg {
  leg_id: string;
  departure_date?: string | null;
  departure_time?: string | null;
  flight_number?: string | null;
  terminal?: string | null;
  gate?: string | null;
}

export interface LumiDaySegment {
  city: string;
  start_part: "morning" | "afternoon" | "evening" | "full_day";
  end_part: "morning" | "afternoon" | "evening" | "full_day";
  note: string;
}
