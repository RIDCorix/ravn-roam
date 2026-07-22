// Storefront-facing trip routes:
//
//   GET    /trips                       list trips for the auth'd user
//   POST   /trips                       create a trip (header + days + checklist)
//   GET    /trips/:id                   detail (trip + days + checklist)
//   PATCH  /trips/:id                   update title / dates / status
//   DELETE /trips/:id                   delete a trip
//   PUT    /trips/:id/days              replace the day list (Lumi or manual)
//   PATCH  /trips/:id/checklist/:itemId update one checklist item
//   DELETE /trips/:id/checklist/:itemId delete one checklist item
//   POST   /trips/:id/lumi              run OpenAI itinerary edit
//
// Every route runs through requireAuth so we get the Supabase user.id and
// scope queries by it. The DB has no RLS on these tables yet — the
// app-layer WHERE user_id = $1 is the only gate.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";
import { companionsRouter, placeholderCompanions } from "./companions.js";
import { readSupplierItems } from "./supplier-metadata.js";
import {
  checklistSubtasksFromDescription,
  fallbackChecklistKind,
} from "./trip-shared.js";
import { geocodeCities } from "../geocode/nominatim.js";
import {
  normalizePlaceSuggestions,
  scheduleTripPlaceSuggestionRefresh,
} from "../trips/place-suggestions.js";
import { normalizeTripStopAnchorMode } from "../db/schema/trip.js";

export const tripsRouter = new Hono();

tripsRouter.use("*", requireAuth);
tripsRouter.route("/:tripId/companions", companionsRouter);

// ─── Schemas ───────────────────────────────────────────────────────────

/* A single stop inside a day — Wanderlog-style "place visited". `name` is
   the only required field; the rest are optional enrichments. */
const stopInput = z.object({
  name: z.string().min(1).max(200),
  anchor_mode: z
    .enum(["exact_place", "regional", "suggested_places"])
    .default("exact_place")
    .transform(normalizeTripStopAnchorMode),
  place_name: z.string().max(200).nullish(),
  place_id: z.string().max(300).nullish(),
  place_address: z.string().max(1000).nullish(),
  area_name: z.string().max(200).nullish(),
  search_query: z.string().max(240).nullish(),
  country_code: z.string().max(8).nullish(),
  place_types: z.array(z.string().min(1).max(80)).max(12).default([]),
  suggestion_count: z.number().int().min(1).max(10).default(5),
  place_suggestions: z
    .array(
      z.object({
        id: z.string().min(1).max(300),
        place_id: z.string().max(300).nullish(),
        name: z.string().min(1).max(200),
        address: z.string().max(1000).nullish(),
        lat: z.number(),
        lng: z.number(),
        primary_type: z.string().max(100).nullish(),
        types: z.array(z.string().max(100)).max(30).default([]),
        rating: z.number().nullish(),
        user_rating_count: z.number().int().nullish(),
        maps_url: z.string().url().max(1200).nullish(),
        selected: z.boolean().optional(),
      }),
    )
    .max(10)
    .default([]),
  suggestions_status: z.string().max(40).default("idle"),
  /* sight | meal | transit | stay | shop | other. Loose so Lumi can
     introduce new kinds without a schema change. */
  kind: z.string().max(40).default("other"),
  /* Free-form: "10:30", "morning", "after lunch". */
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
        image_name: z.string().max(240).nullish(),
        image_data_url: z.string().max(8_000_000).nullish(),
        status: z.enum(["required", "completed", "uploaded"]).default("required"),
      }),
    )
    .max(8)
    .default([]),
  /* Pre-geocoded coords (e.g., from a user pin-drop). If null, the GET
     handler fills them via the nominatim cache by name. */
  lat: z.number().nullish(),
  lng: z.number().nullish(),
});

const daySegmentPart = z.enum(["morning", "afternoon", "evening", "full_day"]);

const daySegmentInput = z.object({
  city: z.string().min(1).max(120),
  start_part: daySegmentPart.default("full_day"),
  end_part: daySegmentPart.default("full_day"),
  note: z.string().max(2000).default(""),
});

const dayInput = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /* Macro city label — kept for backwards compatibility and as the
     overview-map pin name. Lumi still emits this. */
  city: z.string().max(120).default(""),
  /* Ordered cities touched by the day. Defaults to [city] for old clients. */
  cities: z.array(z.string().min(1).max(120)).max(8).optional(),
  /* Editable overview blocks inside this day. A travel day can have two
     segments, e.g. morning Milan and afternoon Paris, while both remain
     independently editable in the overview. */
  segments: z.array(daySegmentInput).max(8).optional(),
  note: z.string().max(2000).default(""),
  /* Multi-stop itinerary within this day. Empty array is allowed (e.g.
     "rest day"); legacy callers that don't send `stops` only get an
     auto-derived stop when `city` is known. */
  stops: z.array(stopInput).default([]),
});

const checklistInput = z.object({
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
        done: z.boolean().default(false),
        image_name: z.string().max(240).nullish(),
        image_data_url: z.string().max(8_000_000).nullish(),
      }),
    )
    .max(20)
    .default([]),
  done: z.boolean().default(false),
  suggested: z.boolean().default(false),
  suggested_by: z.string().max(40).nullish(),
  shortcut: z.string().max(40).nullish(),
  shop_filter: z.record(z.unknown()).nullish(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

const tripCreate = z.object({
  title: z.string().min(1).max(200),
  cover: z.string().max(80).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["upcoming", "active", "past", "cancelled"]).default("upcoming"),
  metadata: z.record(z.unknown()).default({}),
  days: z.array(dayInput).default([]),
  checklist: z.array(checklistInput).default([]),
});

const tripPatch = z.object({
  title: z.string().min(1).max(200).optional(),
  cover: z.string().max(80).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["upcoming", "active", "past", "cancelled"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const daysReplace = z.object({ days: z.array(dayInput).min(1) });

/* Legacy callers can send days with just a city and no stops. Materialize a
   placeholder stop for those callers, but let Lumi-generated drafts opt out
   so missing itinerary stops stay visible as missing content. */
type DaySegmentInput = z.infer<typeof daySegmentInput>;

function defaultStopFromCity(city: string): z.infer<typeof stopInput> {
  return {
    name: city,
    anchor_mode: "exact_place",
    place_name: null,
    place_id: null,
    place_address: null,
    area_name: null,
    search_query: null,
    country_code: null,
    place_types: [],
    suggestion_count: 5,
    place_suggestions: [],
    suggestions_status: "idle",
    kind: "other",
    arrival_time: null,
    duration_min: null,
    note: "",
    attachments: [],
    lat: null,
    lng: null,
  };
}

export function shouldSeedDefaultStops(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.source !== "lumi";
}

export function normalizeTripDayCities(
  city: string,
  cities?: readonly string[] | null,
  segments?: readonly Pick<DaySegmentInput, "city">[] | null,
): string[] {
  if (
    Array.isArray(cities) &&
    cities.length === 0 &&
    Array.isArray(segments) &&
    segments.length === 0
  ) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const name = value?.trim();
    if (!name) return;
    if (isAirportOverviewCity(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  for (const segment of segments ?? []) push(segment.city);
  push(city);
  for (const name of cities ?? []) push(name);
  return out;
}

function segmentPartForIndex(index: number, total: number): DaySegmentInput["start_part"] {
  if (total <= 1) return "full_day";
  if (index === 0) return "morning";
  if (index === 1) return "afternoon";
  return "evening";
}

function normalizeTripDaySegments(
  city: string,
  cities?: readonly string[] | null,
  segments?: readonly DaySegmentInput[] | null,
): DaySegmentInput[] {
  const parsedSegments = (segments ?? [])
    .map((segment) => ({
      city: segment.city.trim(),
      start_part: segment.start_part,
      end_part: segment.end_part,
      note: segment.note.trim(),
    }))
    .filter((segment) => segment.city && !isAirportOverviewCity(segment.city));
  if (parsedSegments.length > 0) return parsedSegments;

  const normalizedCities = normalizeTripDayCities(city, cities);
  return normalizedCities.map((name, index) => {
    const part = segmentPartForIndex(index, normalizedCities.length);
    return {
      city: name,
      start_part: part,
      end_part: part,
      note: "",
    };
  });
}

function isAirportOverviewCity(value: string): boolean {
  return /機場|airport|aéroport|aeroporto|aeropuerto|\bTPE\b|\bTSA\b|\bMXP\b|\bLIN\b|\bCDG\b|\bLHR\b|\bBCN\b/i.test(
    value,
  );
}

function primaryCityFromSegments(
  city: string,
  cities?: readonly string[] | null,
  segments?: readonly DaySegmentInput[] | null,
): string {
  return normalizeTripDaySegments(city, cities, segments)[0]?.city ?? city.trim();
}

function dayCities(row: Pick<TripDayRow, "city" | "cities" | "segments">): string[] {
  return normalizeTripDayCities(row.city, row.cities, row.segments);
}

function uniqueCitiesFromDays(days: Pick<TripDayRow, "city" | "cities" | "segments">[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    for (const city of dayCities(day)) {
      const key = city.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(city);
    }
  }
  return out;
}

// ─── Row → JSON ────────────────────────────────────────────────────────

type TripRow = typeof schema.trip.$inferSelect;
type TripDayRow = typeof schema.tripDay.$inferSelect;
type TripDayStopRow = typeof schema.tripDayStop.$inferSelect;
type ChecklistRow = typeof schema.tripChecklistItem.$inferSelect;
type StopAttachmentInput = z.infer<typeof stopInput>["attachments"][number];

function rowToTrip(row: TripRow) {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    cover: row.cover,
    start_date: row.startDate,
    end_date: row.endDate,
    status: row.status,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/* Serialize a stop row, optionally enriching lat/lng from the nominatim
   cache if the stored values are null. */
function rowToStop(
  row: TripDayStopRow,
  coordsByName: Map<string, { lat: number; lng: number }>,
  checklistById: Map<string, ChecklistRow>,
) {
  const coords = coordsForStopRow(row, coordsByName);
  return {
    id: row.id,
    day_id: row.dayId,
    sort_order: row.sortOrder,
    name: row.name,
    anchor_mode: normalizeTripStopAnchorMode(row.anchorMode),
    place_name: row.placeName ?? null,
    place_id: row.placeId ?? null,
    place_address: row.placeAddress ?? null,
    area_name: row.areaName ?? null,
    search_query: row.searchQuery ?? null,
    country_code: row.countryCode ?? null,
    place_types: Array.isArray(row.placeTypes) ? row.placeTypes : [],
    suggestion_count: row.suggestionCount,
    place_suggestions: normalizePlaceSuggestions(row.placeSuggestions),
    suggestions_status: row.suggestionsStatus,
    kind: row.kind,
    arrival_time: row.arrivalTime,
    duration_min: row.durationMin,
    note: row.note,
    attachments: normalizeStopAttachments(row.attachments, checklistById),
    lat: row.lat ?? coords?.lat ?? null,
    lng: row.lng ?? coords?.lng ?? null,
  };
}

export function stopMappableNameForTrip(
  stop: Pick<TripDayStopRow, "name" | "placeName">,
): string {
  return stop.placeName?.trim() || stop.name;
}

export function stopLookupNamesForTrip(
  stop: Pick<TripDayStopRow, "name" | "placeName">,
): string[] {
  return Array.from(
    new Set(
      [stop.placeName?.trim() ?? "", stop.name.trim()].filter(Boolean),
    ),
  );
}

function coordsForStopRow(
  stop: Pick<TripDayStopRow, "name" | "placeName">,
  coordsByName: Map<string, { lat: number; lng: number }>,
) {
  for (const name of stopLookupNamesForTrip(stop)) {
    const coords = coordsByName.get(name.toLowerCase());
    if (coords) return coords;
  }
  return null;
}

function rowToDay(
  row: TripDayRow,
  stops: TripDayStopRow[],
  coordsByName: Map<string, { lat: number; lng: number }>,
  checklistById: Map<string, ChecklistRow>,
) {
  return {
    id: row.id,
    trip_id: row.tripId,
    sort_order: row.sortOrder,
    day_date: row.dayDate,
    city: row.city,
    cities: dayCities(row),
    segments: normalizeTripDaySegments(row.city, row.cities, row.segments),
    note: row.note,
    stops: stops.map((s) => rowToStop(s, coordsByName, checklistById)),
  };
}

interface ChecklistOrderState {
  order_id: string;
  order_number: string;
  status: "pending" | "ready" | "shared";
  profile_count: number;
  assigned_count: number;
}

async function loadChecklistOrderStates(
  db: ReturnType<typeof getDb>,
  checklistRows: ChecklistRow[],
  trips: Array<typeof schema.trip.$inferSelect>,
): Promise<Map<string, ChecklistOrderState>> {
  const checklistIds = checklistRows.map((row) => row.id);
  if (checklistIds.length === 0) return new Map();

  const assignedByChecklist = new Map<string, number>();
  for (const trip of trips) {
    const metadata =
      trip.metadata && typeof trip.metadata === "object"
        ? (trip.metadata as Record<string, unknown>)
        : {};
    const esims = Array.isArray(metadata.esims) ? metadata.esims : [];
    for (const raw of esims) {
      if (!raw || typeof raw !== "object") continue;
      const checklistId = String(
        (raw as Record<string, unknown>).checklist_item_id ?? "",
      );
      if (!checklistId) continue;
      assignedByChecklist.set(
        checklistId,
        (assignedByChecklist.get(checklistId) ?? 0) + 1,
      );
    }
  }

  const rows = await db
    .select({
      order: schema.orderRecord,
      item: schema.orderItem,
      checklistItemId: sql<string>`${schema.orderRecord.metadata}->>'checklist_item_id'`,
    })
    .from(schema.orderRecord)
    .innerJoin(schema.orderItem, eq(schema.orderItem.orderId, schema.orderRecord.id))
    .where(
      inArray(
        sql<string>`${schema.orderRecord.metadata}->>'checklist_item_id'`,
        checklistIds,
      ),
    )
    .orderBy(desc(schema.orderRecord.createdAt));

  const byChecklist = new Map<string, ChecklistOrderState>();
  for (const row of rows) {
    const checklistId = row.checklistItemId;
    if (!checklistId || byChecklist.has(checklistId)) continue;
    const profileCount = readSupplierItems(row.order.metadata).length;
    const assignedCount = assignedByChecklist.get(checklistId) ?? 0;
    byChecklist.set(checklistId, {
      order_id: row.order.id,
      order_number: row.order.orderNumber,
      status:
        assignedCount > 0
          ? "shared"
          : profileCount > 0 || row.order.status === "fulfilled"
            ? "ready"
            : "pending",
      profile_count: profileCount,
      assigned_count: assignedCount,
    });
  }
  return byChecklist;
}

function rowToChecklist(
  row: ChecklistRow,
  orderState?: ChecklistOrderState,
) {
  const subtasks = normalizeChecklistSubtasks(row.subtasks);
  return {
    id: row.id,
    trip_id: row.tripId,
    text: row.text,
    description: row.description,
    kind: row.kind,
    start_date: row.startDate,
    phase: row.phase,
    group_label: row.groupLabel,
    subtasks,
    done: row.done,
    suggested: row.suggested,
    suggested_by: row.suggestedBy,
    shortcut: row.shortcut ?? (row.kind === "esim" ? "shop" : null),
    shop_filter: row.shopFilter,
    esim_order: orderState ?? null,
    due_date: row.dueDate,
    assigned_companion_id: row.assignedCompanionId,
  };
}

function normalizeChecklistSubtasks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      if (typeof item.text !== "string" || !item.text.trim()) return null;
      return {
        text: item.text.trim(),
        done: item.done === true,
        image_name:
          typeof item.image_name === "string"
            ? item.image_name
            : typeof item.imageName === "string"
              ? item.imageName
              : null,
        image_data_url:
          typeof item.image_data_url === "string"
            ? item.image_data_url
            : typeof item.imageDataUrl === "string"
              ? item.imageDataUrl
              : null,
      };
    })
    .filter(
      (
        item,
      ): item is {
        text: string;
        done: boolean;
        image_name: string | null;
        image_data_url: string | null;
      } => !!item,
    );
}

function normalizeStopAttachments(
  value: unknown,
  checklistById: Map<string, ChecklistRow>,
) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const label = typeof raw.label === "string" ? raw.label : "";
    if (!label.trim()) return [];
    const checklistItemId =
      typeof raw.checklist_item_id === "string" ? raw.checklist_item_id : null;
    const linked = checklistItemId ? checklistById.get(checklistItemId) : undefined;
    const status =
      raw.status === "completed" || raw.status === "uploaded"
        ? raw.status
        : "required";
    return [
      {
        id: typeof raw.id === "string" ? raw.id : label,
        type: typeof raw.type === "string" ? raw.type : "ticket",
        label,
        url: typeof raw.url === "string" ? raw.url : null,
        amount: typeof raw.amount === "string" ? raw.amount : null,
        action_label:
          typeof raw.action_label === "string" ? raw.action_label : null,
        checklist_item_id: checklistItemId,
        checklist_text:
          typeof raw.checklist_text === "string" ? raw.checklist_text : null,
        checklist_kind:
          typeof raw.checklist_kind === "string" ? raw.checklist_kind : null,
        image_name: typeof raw.image_name === "string" ? raw.image_name : null,
        image_data_url:
          typeof raw.image_data_url === "string" ? raw.image_data_url : null,
        status,
        done:
          linked?.done ?? (status === "completed" || status === "uploaded"),
      },
    ];
  });
}

function attachmentChecklistText(
  attachment: StopAttachmentInput,
  stopName: string,
): string {
  return attachment.checklist_text?.trim() || `${stopName}：${attachment.label}`;
}

function checklistKey(text: string, kind: string): string {
  return `${kind.trim().toLowerCase()}::${text.trim().toLowerCase()}`;
}

// ─── LIST ──────────────────────────────────────────────────────────────

tripsRouter.get("/", async (c) => {
  const user = getUser(c);
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.trip)
    .where(eq(schema.trip.userId, user.id))
    .orderBy(asc(schema.trip.startDate));
  if (rows.length === 0) return c.json({ trips: [] });

  const tripIds = rows.map((row) => row.id);
  const [days, checklist] = await Promise.all([
    db
      .select()
      .from(schema.tripDay)
      .where(inArray(schema.tripDay.tripId, tripIds))
      .orderBy(asc(schema.tripDay.sortOrder)),
    db
      .select()
      .from(schema.tripChecklistItem)
      .where(inArray(schema.tripChecklistItem.tripId, tripIds)),
  ]);

  const daysByTrip = new Map<string, TripDayRow[]>();
  for (const day of days) {
    const existing = daysByTrip.get(day.tripId);
    if (existing) existing.push(day);
    else daysByTrip.set(day.tripId, [day]);
  }

  const checklistStats = new Map<string, { total: number; done: number }>();
  for (const item of checklist) {
    const stats = checklistStats.get(item.tripId) ?? { total: 0, done: 0 };
    stats.total += 1;
    if (item.done) stats.done += 1;
    checklistStats.set(item.tripId, stats);
  }

  const trips = rows.map((row) => {
    const tripDays = daysByTrip.get(row.id) ?? [];
    const stats = checklistStats.get(row.id) ?? { total: 0, done: 0 };
    return {
      ...rowToTrip(row),
      days_count: tripDays.length,
      cities: uniqueCitiesFromDays(tripDays),
      checklist_total: stats.total,
      checklist_done: stats.done,
    };
  });

  return c.json({ trips });
});

// ─── CHECKLISTS (flat list for home-page todo grouping) ────────────────
//
// Returns every checklist item for the auth'd user across all their
// trips. Cheap variant of /:id that skips days/stops/companions so the
// home screen can render real task text without N+1 calls.
//
//   GET /trips/checklists?done=false   only incomplete (default)
//   GET /trips/checklists?done=any     incomplete + done

tripsRouter.get("/checklists", async (c) => {
  const user = getUser(c);
  const db = getDb();
  const doneParam = c.req.query("done");
  const includeDone = doneParam === "any" || doneParam === "true";

  const tripIds = (
    await db
      .select({ id: schema.trip.id })
      .from(schema.trip)
      .where(eq(schema.trip.userId, user.id))
  ).map((row) => row.id);
  if (tripIds.length === 0) return c.json({ items: [] });

  const rows = await db
    .select()
    .from(schema.tripChecklistItem)
    .where(inArray(schema.tripChecklistItem.tripId, tripIds))
    .orderBy(asc(schema.tripChecklistItem.createdAt));

  const trips = await db
    .select()
    .from(schema.trip)
    .where(inArray(schema.trip.id, tripIds));
  const orderStates = await loadChecklistOrderStates(db, rows, trips);
  const items = (includeDone ? rows : rows.filter((row) => !row.done)).map((row) =>
    rowToChecklist(row, orderStates.get(row.id)),
  );
  return c.json({ items });
});

// ─── DETAIL ────────────────────────────────────────────────────────────

tripsRouter.get("/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();

  const [trip] = await db
    .select()
    .from(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "not_found" }, 404);

  const [days, checklist, companionRows] = await Promise.all([
    db
      .select()
      .from(schema.tripDay)
      .where(eq(schema.tripDay.tripId, id))
      .orderBy(asc(schema.tripDay.sortOrder)),
    db
      .select()
      .from(schema.tripChecklistItem)
      .where(eq(schema.tripChecklistItem.tripId, id))
      .orderBy(asc(schema.tripChecklistItem.createdAt)),
    db
      .select()
      .from(schema.tripCompanion)
      .where(eq(schema.tripCompanion.tripId, id))
      .orderBy(asc(schema.tripCompanion.sortOrder)),
  ]);
  const checklistById = new Map(checklist.map((item) => [item.id, item]));

  // Trips seeded before the companion feature shipped have no rows. Lazy
  // backfill so the user sees three placeholders on the next page load.
  let companions = companionRows;
  if (companions.length === 0) {
    await db.insert(schema.tripCompanion).values(
      placeholderCompanions().map((p, i) => ({
        tripId: id,
        displayName: p.display_name,
        color: p.color,
        sortOrder: i,
      })),
    );
    companions = await db
      .select()
      .from(schema.tripCompanion)
      .where(eq(schema.tripCompanion.tripId, id))
      .orderBy(asc(schema.tripCompanion.sortOrder));
  }

  // Fetch all stops for these days in one batch query, then group by day.
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
  const stopsByDay = new Map<string, TripDayStopRow[]>();
  for (const s of stops) {
    const arr = stopsByDay.get(s.dayId);
    if (arr) arr.push(s);
    else stopsByDay.set(s.dayId, [s]);
  }

  /* Two-pass geocoding. Pass 1 resolves the macro cities with the
     default (multi-country-friendly) logic. Pass 2 resolves each stop
     STRICTLY constrained to its day's city's country — so Chinese-
     script place names on a Milan trip can't cross-language-match to
     Chinese cities (the "米蘭時尚區 → Shanghai" bug). Stops without a
     matchable hit return null lat/lng → no pin > wrong pin. */
  const cityList = uniqueCitiesFromDays(days);
  const cityGeocoded = await geocodeCities(cityList, {
    fetchMisses: false,
  }).catch(() => []);
  const cityCountryByName = new Map(
    cityGeocoded.map((g) => [
      g.name.trim().toLowerCase(),
      g.country_code,
    ]),
  );

  /* Group stop names by the country they SHOULD live in (taken from
     their day's city). One geocodeCities call per country, each in
     strict mode. */
  const stopsByCountry = new Map<string | null, Set<string>>();
  for (const d of days) {
    const primaryCity = dayCities(d)[0] ?? "";
    const cc =
      cityCountryByName.get(primaryCity.trim().toLowerCase()) ?? null;
    for (const s of stopsByDay.get(d.id) ?? []) {
      const set = stopsByCountry.get(cc) ?? new Set<string>();
      for (const name of stopLookupNamesForTrip(s)) set.add(name);
      stopsByCountry.set(cc, set);
    }
  }
  const stopGeocoded: Awaited<ReturnType<typeof geocodeCities>> = [];
  for (const [cc, names] of stopsByCountry) {
    if (names.size === 0) continue;
    /* Without a city country we can't reliably constrain — skip,
       leaving stops unpinned rather than risking a wrong-country hit. */
    if (!cc) continue;
    const batch = await geocodeCities(Array.from(names), {
      strictCountry: cc,
      fetchMisses: false,
    }).catch(() => []);
    stopGeocoded.push(...batch);
  }

  const coordByName = new Map<string, { lat: number; lng: number }>();
  for (const g of [...cityGeocoded, ...stopGeocoded]) {
    coordByName.set(g.name.trim().toLowerCase(), { lat: g.lat, lng: g.lng });
  }

  /* `cities` is the macro overview-map data (one pin per city in
     itinerary order). Days/stops carry their own coords for the
     day-level map. */
  const cities = cityList.map((name) => {
    const c = coordByName.get(name.toLowerCase());
    return { name, lat: c?.lat ?? null, lng: c?.lng ?? null };
  });
  const orderStates = await loadChecklistOrderStates(db, checklist, [trip]);

  scheduleTripPlaceSuggestionRefresh(trip.id);

  return c.json({
    trip: rowToTrip(trip),
    days: days.map((d) =>
      rowToDay(d, stopsByDay.get(d.id) ?? [], coordByName, checklistById),
    ),
    checklist: checklist.map((row) => rowToChecklist(row, orderStates.get(row.id))),
    cities,
    companions: [
      {
        id: `owner:${trip.userId}`,
        trip_id: trip.id,
        display_name: user.email?.split("@")[0] || "我",
        color: "#111111",
        sort_order: -1,
        user_id: trip.userId,
        invite_token: null,
        accepted_at: trip.createdAt.toISOString(),
        role: "owner",
      },
      ...companions.map((c) => ({
        id: c.id,
        trip_id: c.tripId,
        display_name: c.displayName,
        color: c.color,
        sort_order: c.sortOrder,
        user_id: c.userId,
        invite_token: c.inviteToken,
        accepted_at: c.acceptedAt?.toISOString() ?? null,
        role: "companion",
      })),
    ],
  });
});

// ─── CREATE ────────────────────────────────────────────────────────────

tripsRouter.post("/", async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const parsed = tripCreate.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.flatten() }, 400);
  }
  const db = getDb();
  const [trip] = await db
    .insert(schema.trip)
    .values({
      userId: user.id,
      title: parsed.data.title,
      cover: parsed.data.cover ?? null,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
      status: parsed.data.status,
      metadata: parsed.data.metadata,
    })
    .returning();
  const createdChecklistKeys = new Set<string>();
  const seedDefaultStops = shouldSeedDefaultStops(parsed.data.metadata);

  if (parsed.data.days.length > 0) {
    const insertedDays = await db
      .insert(schema.tripDay)
      .values(
        parsed.data.days.map((d, i) => {
          const segments = normalizeTripDaySegments(d.city, d.cities, d.segments);
          const city = primaryCityFromSegments(d.city, d.cities, segments);
          return {
            tripId: trip!.id,
            sortOrder: i,
            dayDate: d.day_date,
            city,
            cities: normalizeTripDayCities(city, d.cities, segments),
            segments,
            note: d.note,
          };
        }),
      )
      .returning({ id: schema.tripDay.id, sortOrder: schema.tripDay.sortOrder });

    /* Build stop rows for every day. If the caller didn't supply stops[],
       seed one stop named after `city` only when the city is known. */
    const stopRows = [];
    for (let i = 0; i < parsed.data.days.length; i++) {
      const d = parsed.data.days[i]!;
      const dayRow = insertedDays.find((r) => r.sortOrder === i);
      if (!dayRow) continue;
      const effective =
        d.stops.length > 0
          ? d.stops
          : seedDefaultStops && d.city.trim()
            ? [defaultStopFromCity(d.city)]
            : [];
      for (let j = 0; j < effective.length; j++) {
        const s = effective[j]!;
        const attachments = [];
        for (const a of s.attachments) {
          let checklistItemId = a.checklist_item_id ?? null;
          if (!checklistItemId) {
            const text = attachmentChecklistText(a, s.name);
            const kind = a.checklist_kind ?? fallbackChecklistKind(a.type);
            const [item] = await db
              .insert(schema.tripChecklistItem)
              .values({
                tripId: trip!.id,
                text,
                description: a.checklist_description ?? null,
                kind,
                startDate: d.day_date,
                phase: "on_trip",
                groupLabel:
                  kind === "ticket" || kind === "stay"
                    ? "訂票與預訂"
                    : "抵達當地",
                subtasks: checklistSubtasksFromDescription(
                  a.checklist_description,
                ),
                done: a.status === "completed" || a.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: d.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
            createdChecklistKeys.add(checklistKey(text, kind));
          }
          attachments.push({ ...a, checklist_item_id: checklistItemId });
        }
        stopRows.push({
          dayId: dayRow.id,
          sortOrder: j,
          name: s.name,
          anchorMode: normalizeTripStopAnchorMode(s.anchor_mode),
          placeName: s.place_name ?? null,
          placeId: s.place_id ?? null,
          placeAddress: s.place_address ?? null,
          areaName: s.area_name ?? null,
          searchQuery: s.search_query ?? null,
          countryCode: s.country_code ?? null,
          placeTypes: s.place_types ?? [],
          suggestionCount: s.suggestion_count ?? 5,
          placeSuggestions: normalizePlaceSuggestions(s.place_suggestions),
          suggestionsStatus: s.suggestions_status ?? "idle",
          kind: s.kind,
          arrivalTime: s.arrival_time ?? null,
          durationMin: s.duration_min ?? null,
          note: s.note,
          attachments,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
        });
      }
    }
    if (stopRows.length > 0) {
      await db.insert(schema.tripDayStop).values(stopRows);
    }
  }

  const checklistRows = parsed.data.checklist.filter(
    (c) => !createdChecklistKeys.has(checklistKey(c.text, c.kind)),
  );
  if (checklistRows.length > 0) {
    await db.insert(schema.tripChecklistItem).values(
      checklistRows.map((c) => ({
        tripId: trip!.id,
        text: c.text,
        description: c.description ?? null,
        kind: c.kind,
        startDate: c.start_date ?? null,
        phase: c.phase ?? null,
        groupLabel: c.group_label ?? null,
        subtasks: c.subtasks,
        done: c.done,
        suggested: c.suggested,
        suggestedBy: c.suggested_by ?? null,
        shortcut: c.shortcut ?? (c.kind === "esim" ? "shop" : null),
        shopFilter: c.shop_filter ?? null,
        dueDate: c.due_date ?? null,
      })),
    );
  }

  // Seed one placeholder companion. The owner is rendered as a virtual
  // participant in the detail payload, so a two-person ticket reads as
  // "owner + one companion" instead of three empty companion slots.
  await db.insert(schema.tripCompanion).values(
    placeholderCompanions().map((p, i) => ({
      tripId: trip!.id,
      displayName: p.display_name,
      color: p.color,
      sortOrder: i,
    })),
  );

  scheduleTripPlaceSuggestionRefresh(trip!.id);

  return c.json({ trip: rowToTrip(trip!) }, 201);
});

// ─── PATCH ─────────────────────────────────────────────────────────────

tripsRouter.patch("/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = tripPatch.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.flatten() }, 400);
  }
  const db = getDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title != null) patch.title = parsed.data.title;
  if (parsed.data.cover !== undefined) patch.cover = parsed.data.cover ?? null;
  if (parsed.data.start_date) patch.startDate = parsed.data.start_date;
  if (parsed.data.end_date) patch.endDate = parsed.data.end_date;
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;

  const [row] = await db
    .update(schema.trip)
    .set(patch)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ trip: rowToTrip(row) });
});

// ─── DELETE ────────────────────────────────────────────────────────────

tripsRouter.delete("/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();
  const [row] = await db
    .delete(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .returning({ id: schema.trip.id });
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ─── REPLACE DAYS ──────────────────────────────────────────────────────
// Lumi (and the future drag-to-reorder UI) writes the canonical day list
// through here. We wipe + reinsert so sort_order stays dense and we don't
// chase diff edge cases.

tripsRouter.put("/:id/days", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = daysReplace.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  const [trip] = await db
    .select()
    .from(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "not_found" }, 404);

  await db.transaction(async (tx) => {
    /* `trip_day_stop.day_id` has ON DELETE CASCADE, so wiping the old days
       wipes their stops too. Then re-insert days, capture their new IDs,
       and bulk-insert stops keyed by day sort_order. */
    await tx.delete(schema.tripDay).where(eq(schema.tripDay.tripId, id));
    const insertedDays = await tx
      .insert(schema.tripDay)
      .values(
        parsed.data.days.map((d, i) => {
          const segments = normalizeTripDaySegments(d.city, d.cities, d.segments);
          const city = primaryCityFromSegments(d.city, d.cities, segments);
          return {
            tripId: id,
            sortOrder: i,
            dayDate: d.day_date,
            city,
            cities: normalizeTripDayCities(city, d.cities, segments),
            segments,
            note: d.note,
          };
        }),
      )
      .returning({ id: schema.tripDay.id, sortOrder: schema.tripDay.sortOrder });

    const stopRows = [];
    const seedDefaultStops = shouldSeedDefaultStops(
      trip.metadata as Record<string, unknown> | null | undefined,
    );
    for (let i = 0; i < parsed.data.days.length; i++) {
      const d = parsed.data.days[i]!;
      const dayRow = insertedDays.find((r) => r.sortOrder === i);
      if (!dayRow) continue;
      const effective =
        d.stops.length > 0
          ? d.stops
          : seedDefaultStops && d.city.trim()
            ? [defaultStopFromCity(d.city)]
            : [];
      for (let j = 0; j < effective.length; j++) {
        const s = effective[j]!;
        const attachments = [];
        for (const a of s.attachments) {
          let checklistItemId = a.checklist_item_id ?? null;
          if (!checklistItemId) {
            const [item] = await tx
              .insert(schema.tripChecklistItem)
              .values({
                tripId: id,
                text: attachmentChecklistText(a, s.name),
                description: a.checklist_description ?? null,
                kind: a.checklist_kind ?? fallbackChecklistKind(a.type),
                startDate: d.day_date,
                phase: "on_trip",
                groupLabel: "抵達當地",
                subtasks: checklistSubtasksFromDescription(
                  a.checklist_description,
                ),
                done: a.status === "completed" || a.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: d.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
          }
          attachments.push({ ...a, checklist_item_id: checklistItemId });
        }
        stopRows.push({
          dayId: dayRow.id,
          sortOrder: j,
          name: s.name,
          anchorMode: normalizeTripStopAnchorMode(s.anchor_mode),
          placeName: s.place_name ?? null,
          placeId: s.place_id ?? null,
          placeAddress: s.place_address ?? null,
          areaName: s.area_name ?? null,
          searchQuery: s.search_query ?? null,
          countryCode: s.country_code ?? null,
          placeTypes: s.place_types ?? [],
          suggestionCount: s.suggestion_count ?? 5,
          placeSuggestions: normalizePlaceSuggestions(s.place_suggestions),
          suggestionsStatus: s.suggestions_status ?? "idle",
          kind: s.kind,
          arrivalTime: s.arrival_time ?? null,
          durationMin: s.duration_min ?? null,
          note: s.note,
          attachments,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
        });
      }
    }
    if (stopRows.length > 0) {
      await tx.insert(schema.tripDayStop).values(stopRows);
    }

    await tx
      .update(schema.trip)
      .set({
        startDate: parsed.data.days[0]!.day_date,
        endDate: parsed.data.days[parsed.data.days.length - 1]!.day_date,
        updatedAt: new Date(),
      })
      .where(eq(schema.trip.id, id));
  });

  scheduleTripPlaceSuggestionRefresh(id);

  /* Read back days + stops to return the canonical post-update shape.
     Geocoding happens lazily in the GET /:id path; this response only
     surfaces the structural change for the caller (Lumi / the editor UI). */
  const days = await db
    .select()
    .from(schema.tripDay)
    .where(eq(schema.tripDay.tripId, id))
    .orderBy(asc(schema.tripDay.sortOrder));
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
  const stopsByDay = new Map<string, TripDayStopRow[]>();
  for (const s of stops) {
    const arr = stopsByDay.get(s.dayId);
    if (arr) arr.push(s);
    else stopsByDay.set(s.dayId, [s]);
  }
  const checklist = await db
    .select()
    .from(schema.tripChecklistItem)
    .where(eq(schema.tripChecklistItem.tripId, id));
  const checklistById = new Map(checklist.map((item) => [item.id, item]));
  const emptyCoords = new Map<string, { lat: number; lng: number }>();

  return c.json({
    days: days.map((d) =>
      rowToDay(d, stopsByDay.get(d.id) ?? [], emptyCoords, checklistById),
    ),
  });
});

// ─── CHECKLIST ITEM MUTATIONS ───────────────────────────────────────────
// Single-item updates and deletes. Used by the checklist row + the assignee
// dropdown.

const checklistPatch = z.object({
  done: z.boolean().optional(),
  // null = unassign; uuid = assign to that companion.
  assigned_companion_id: z.string().uuid().nullable().optional(),
  text: z.string().min(1).max(500).optional(),
  description: z.string().max(4000).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  phase: z.string().max(40).nullable().optional(),
  group_label: z.string().max(80).nullable().optional(),
  subtasks: z
    .array(
      z.object({
        text: z.string().min(1).max(300),
        done: z.boolean().default(false),
        image_name: z.string().max(240).nullish(),
        image_data_url: z.string().max(8_000_000).nullish(),
      }),
    )
    .max(20)
    .optional(),
});

const attachmentPatch = z.object({
  label: z.string().min(1).max(120).optional(),
  url: z.union([z.string().url().max(1200), z.literal("")]).optional(),
  amount: z.string().max(80).optional(),
  status: z.enum(["required", "completed", "uploaded"]).optional(),
  image_name: z.string().min(1).max(240).optional(),
  image_data_url: z
    .string()
    .startsWith("data:image/")
    .max(8_000_000)
    .optional(),
});

tripsRouter.patch("/:id/checklist/:itemId", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const itemId = c.req.param("itemId");
  const body = await c.req.json();
  const parsed = checklistPatch.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  // Ownership: trip must belong to user (we don't yet allow companions
  // to mutate the owner's checklist — that's a future permission tier).
  const [trip] = await db
    .select({ id: schema.trip.id })
    .from(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "not_found" }, 404);

  const patch: Record<string, unknown> = {};
  if (parsed.data.done != null) patch.done = parsed.data.done;
  if (parsed.data.text != null) patch.text = parsed.data.text;
  if ("description" in parsed.data) {
    patch.description = parsed.data.description?.trim() || null;
  }
  if ("start_date" in parsed.data) {
    patch.startDate = parsed.data.start_date ?? null;
  }
  if ("phase" in parsed.data) {
    patch.phase = parsed.data.phase?.trim() || null;
  }
  if ("group_label" in parsed.data) {
    patch.groupLabel = parsed.data.group_label?.trim() || null;
  }
  if ("subtasks" in parsed.data) {
    patch.subtasks = parsed.data.subtasks ?? [];
  }
  if ("assigned_companion_id" in parsed.data) {
    patch.assignedCompanionId = parsed.data.assigned_companion_id ?? null;
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: "no_op" }, 400);
  }

  const [row] = await db
    .update(schema.tripChecklistItem)
    .set(patch)
    .where(
      and(
        eq(schema.tripChecklistItem.id, itemId),
        eq(schema.tripChecklistItem.tripId, id),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({
    item: {
      id: row.id,
      trip_id: row.tripId,
      text: row.text,
      description: row.description,
      kind: row.kind,
      start_date: row.startDate,
      phase: row.phase,
      group_label: row.groupLabel,
      subtasks: normalizeChecklistSubtasks(row.subtasks),
      done: row.done,
      suggested: row.suggested,
      suggested_by: row.suggestedBy,
      shortcut: row.shortcut ?? (row.kind === "esim" ? "shop" : null),
      shop_filter: row.shopFilter,
      due_date: row.dueDate,
      assigned_companion_id: row.assignedCompanionId,
    },
  });
});

tripsRouter.delete("/:id/checklist/:itemId", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const itemId = c.req.param("itemId");
  const db = getDb();
  const [trip] = await db
    .select({ id: schema.trip.id })
    .from(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "not_found" }, 404);

  const [row] = await db
    .delete(schema.tripChecklistItem)
    .where(
      and(
        eq(schema.tripChecklistItem.id, itemId),
        eq(schema.tripChecklistItem.tripId, id),
      ),
    )
    .returning({ id: schema.tripChecklistItem.id });
  if (!row) return c.json({ error: "not_found" }, 404);

  await db
    .update(schema.trip)
    .set({ updatedAt: new Date() })
    .where(eq(schema.trip.id, id));

  return c.json({ ok: true, id: row.id });
});

tripsRouter.patch("/:id/stops/:stopId/attachments/:attachmentId", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const stopId = c.req.param("stopId");
  const attachmentId = decodeURIComponent(c.req.param("attachmentId"));
  const body = await c.req.json();
  const parsed = attachmentPatch.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [trip] = await db
    .select({ id: schema.trip.id })
    .from(schema.trip)
    .where(and(eq(schema.trip.id, id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "not_found" }, 404);

  const [stop] = await db
    .select({
      id: schema.tripDayStop.id,
      attachments: schema.tripDayStop.attachments,
    })
    .from(schema.tripDayStop)
    .innerJoin(schema.tripDay, eq(schema.tripDay.id, schema.tripDayStop.dayId))
    .where(
      and(
        eq(schema.tripDay.tripId, id),
        eq(schema.tripDayStop.id, stopId),
      ),
    )
    .limit(1);
  if (!stop) return c.json({ error: "not_found" }, 404);

  const attachments = normalizeStopAttachments(
    stop.attachments,
    new Map<string, ChecklistRow>(),
  );
  const idx = attachments.findIndex(
    (a) => a.id === attachmentId || a.label === attachmentId,
  );
  if (idx < 0) return c.json({ error: "attachment_not_found" }, 404);

  const nextStatus =
    parsed.data.status ??
    (parsed.data.image_data_url ? "uploaded" : attachments[idx]!.status);
  const updated = {
    ...attachments[idx]!,
    label: parsed.data.label ?? attachments[idx]!.label,
    url:
      parsed.data.url !== undefined
        ? parsed.data.url || null
        : attachments[idx]!.url,
    amount:
      parsed.data.amount !== undefined
        ? parsed.data.amount || null
        : attachments[idx]!.amount,
    status: nextStatus,
    image_name: parsed.data.image_name ?? attachments[idx]!.image_name,
    image_data_url:
      parsed.data.image_data_url ?? attachments[idx]!.image_data_url,
  };
  const next = [...attachments];
  next[idx] = updated;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.tripDayStop)
      .set({ attachments: next })
      .where(eq(schema.tripDayStop.id, stopId));
    if (updated.checklist_item_id) {
      await tx
        .update(schema.tripChecklistItem)
        .set({ done: nextStatus === "completed" || nextStatus === "uploaded" })
        .where(
          and(
            eq(schema.tripChecklistItem.id, updated.checklist_item_id),
            eq(schema.tripChecklistItem.tripId, id),
          ),
        );
    }
    await tx
      .update(schema.trip)
      .set({ updatedAt: new Date() })
      .where(eq(schema.trip.id, id));
  });

  return c.json({ attachment: { ...updated, done: true } });
});
