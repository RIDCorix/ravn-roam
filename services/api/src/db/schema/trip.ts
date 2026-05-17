import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc, tripStatus } from "./_schema";

// Roam consumer trips. Owner is the Supabase auth user (`auth.users.id`)
// the storefront authenticated as. We store it as text so an account can be
// hard-deleted without cascading the trip away — trips are kept as a
// long-tail history.
export const trip = roamPoc.table(
  "trip",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    cover: text("cover"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: tripStatus("status").notNull().default("upcoming"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("trip_user_idx").on(t.userId),
    index("trip_status_idx").on(t.status),
    index("trip_user_start_idx").on(t.userId, t.startDate),
  ],
);

// Per-day itinerary entry. `sortOrder` is the canonical ordering — when
// Lumi rearranges the itinerary it updates sort_order; dates stay in their
// original calendar slot so the date column doesn't drift. (city, note) is
// what shifts.
export const tripDay = roamPoc.table(
  "trip_day",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    dayDate: date("day_date").notNull(),
    city: text("city").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("trip_day_trip_idx").on(t.tripId, t.sortOrder),
  ],
);

// Stops within a single day — Wanderlog-style. A day may have 0..N stops
// in `sortOrder`; geocode happens at the stop level so each pin lands on
// the actual place, not just the macro "city". Old single-city days are
// represented as one stop with name = the legacy `trip_day.city` value
// (see migration 0009 backfill).
export const tripDayStop = roamPoc.table(
  "trip_day_stop",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => tripDay.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    name: text("name").notNull(),
    /* sight | meal | transit | stay | shop | other — purely cosmetic, drives
       the pin icon and the timeline kind chip. Stays loose (text) so Lumi
       can introduce new kinds without a schema change. */
    kind: text("kind").notNull().default("other"),
    /* Free-form so "10:30", "morning", "afternoon" all work. The storefront
       only renders it as a label; nothing parses time math from it. */
    arrivalTime: text("arrival_time"),
    durationMin: integer("duration_min"),
    note: text("note").notNull().default(""),
    /* Per-stop preparation artifacts Lumi can require: ticket purchase,
       restaurant reservation, flight booking, image/document upload, etc.
       Each item may link to a trip_checklist_item; that checklist row's
       done state is the canonical completion signal. */
    attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`),
    /* Geocoded lat/lng. Nullable when geocoding hasn't run / failed —
       the map filters those out instead of pinning at [0,0]. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("trip_day_stop_day_idx").on(t.dayId, t.sortOrder)],
);

// Pre-trip checklist (eSIM, visa, flight, etc.). Suggestion = Lumi
// surfaced it; the storefront groups suggestions visually.
//
// `assignedCompanionId` (nullable) attaches the task to a specific
// companion. NULL = everyone / unowned. When the companion is deleted
// the column is nulled out (assign-by-reference, not a hard dependency).
export const tripChecklistItem = roamPoc.table(
  "trip_checklist_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    done: boolean("done").notNull().default(false),
    suggested: boolean("suggested").notNull().default(false),
    suggestedBy: text("suggested_by"),
    shortcut: text("shortcut"),
    shopFilter: jsonb("shop_filter"),
    dueDate: date("due_date"),
    assignedCompanionId: uuid("assigned_companion_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("trip_checklist_trip_idx").on(t.tripId)],
);
