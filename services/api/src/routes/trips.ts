// Storefront-facing trip routes:
//
//   GET    /trips                       list trips for the auth'd user
//   POST   /trips                       create a trip (header + days + checklist)
//   GET    /trips/:id                   detail (trip + days + checklist)
//   PATCH  /trips/:id                   update title / dates / status
//   DELETE /trips/:id                   delete a trip
//   PUT    /trips/:id/days              replace the day list (Lumi or manual)
//   POST   /trips/:id/lumi              run OpenAI itinerary edit
//
// Every route runs through requireAuth so we get the Supabase user.id and
// scope queries by it. The DB has no RLS on these tables yet — the
// app-layer WHERE user_id = $1 is the only gate.

import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";
import { companionsRouter, placeholderCompanions } from "./companions.js";
import { geocodeCities } from "../geocode/nominatim.js";

export const tripsRouter = new Hono();

tripsRouter.use("*", requireAuth);
tripsRouter.route("/:tripId/companions", companionsRouter);

// ─── Schemas ───────────────────────────────────────────────────────────

/* A single stop inside a day — Wanderlog-style "place visited". `name` is
   the only required field; the rest are optional enrichments. */
const stopInput = z.object({
  name: z.string().min(1).max(200),
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
        action_label: z.string().max(80).nullish(),
        checklist_text: z.string().max(500).nullish(),
        checklist_kind: z.string().max(40).nullish(),
        checklist_item_id: z.string().uuid().nullish(),
        image_name: z.string().max(240).nullish(),
        image_data_url: z.string().max(2_000_000).nullish(),
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

const dayInput = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /* Macro city label — kept for backwards compatibility and as the
     overview-map pin name. Lumi still emits this. */
  city: z.string().min(1).max(120),
  note: z.string().max(2000).default(""),
  /* Multi-stop itinerary within this day. Empty array is allowed (e.g.
     "rest day"); legacy callers that don't send `stops` get an
     auto-derived single stop named after `city`. */
  stops: z.array(stopInput).default([]),
});

const checklistInput = z.object({
  text: z.string().min(1).max(500),
  kind: z.string().min(1).max(40),
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
  days: z.array(dayInput).default([]),
  checklist: z.array(checklistInput).default([]),
});

const tripPatch = z.object({
  title: z.string().min(1).max(200).optional(),
  cover: z.string().max(80).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["upcoming", "active", "past", "cancelled"]).optional(),
});

const daysReplace = z.object({ days: z.array(dayInput).min(1) });

/* Legacy callers (and Lumi until the prompt rewrite lands) send days with
   just a city and no stops. Materialize a single placeholder stop so the
   day still pins on the map and the timeline isn't empty. */
function defaultStopFromCity(city: string): z.infer<typeof stopInput> {
  return {
    name: city,
    kind: "other",
    arrival_time: null,
    duration_min: null,
    note: "",
    attachments: [],
    lat: null,
    lng: null,
  };
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
  const cached = coordsByName.get(row.name.trim().toLowerCase());
  return {
    id: row.id,
    day_id: row.dayId,
    sort_order: row.sortOrder,
    name: row.name,
    kind: row.kind,
    arrival_time: row.arrivalTime,
    duration_min: row.durationMin,
    note: row.note,
    attachments: normalizeStopAttachments(row.attachments, checklistById),
    lat: row.lat ?? cached?.lat ?? null,
    lng: row.lng ?? cached?.lng ?? null,
  };
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
    note: row.note,
    stops: stops.map((s) => rowToStop(s, coordsByName, checklistById)),
  };
}

function rowToChecklist(row: ChecklistRow) {
  return {
    id: row.id,
    trip_id: row.tripId,
    text: row.text,
    kind: row.kind,
    done: row.done,
    suggested: row.suggested,
    suggested_by: row.suggestedBy,
    shortcut: row.shortcut,
    shop_filter: row.shopFilter,
    due_date: row.dueDate,
    assigned_companion_id: row.assignedCompanionId,
  };
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

function fallbackChecklistKind(type: string): string {
  if (type === "reservation") return "stay";
  if (type === "booking" || type === "flight") return "flight";
  if (type === "upload" || type === "document") return "doc";
  if (type === "transit") return "transit";
  return "ticket";
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
  return c.json({ trips: rows.map(rowToTrip) });
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
  const cityList: string[] = [];
  const citySeen = new Set<string>();
  for (const d of days) {
    const key = d.city.trim();
    if (!citySeen.has(key.toLowerCase())) {
      citySeen.add(key.toLowerCase());
      cityList.push(key);
    }
  }
  const cityGeocoded = await geocodeCities(cityList).catch(() => []);
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
    const cc =
      cityCountryByName.get(d.city.trim().toLowerCase()) ?? null;
    for (const s of stopsByDay.get(d.id) ?? []) {
      const set = stopsByCountry.get(cc) ?? new Set<string>();
      set.add(s.name.trim());
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

  return c.json({
    trip: rowToTrip(trip),
    days: days.map((d) =>
      rowToDay(d, stopsByDay.get(d.id) ?? [], coordByName, checklistById),
    ),
    checklist: checklist.map(rowToChecklist),
    cities,
    companions: companions.map((c) => ({
      id: c.id,
      trip_id: c.tripId,
      display_name: c.displayName,
      color: c.color,
      sort_order: c.sortOrder,
      user_id: c.userId,
      invite_token: c.inviteToken,
      accepted_at: c.acceptedAt?.toISOString() ?? null,
    })),
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
    })
    .returning();
  const createdChecklistKeys = new Set<string>();

  if (parsed.data.days.length > 0) {
    const insertedDays = await db
      .insert(schema.tripDay)
      .values(
        parsed.data.days.map((d, i) => ({
          tripId: trip!.id,
          sortOrder: i,
          dayDate: d.day_date,
          city: d.city,
          note: d.note,
        })),
      )
      .returning({ id: schema.tripDay.id, sortOrder: schema.tripDay.sortOrder });

    /* Build stop rows for every day. If the caller didn't supply stops[],
       seed one stop named after `city` so the day still pins on the map. */
    const stopRows = [];
    for (let i = 0; i < parsed.data.days.length; i++) {
      const d = parsed.data.days[i]!;
      const dayRow = insertedDays.find((r) => r.sortOrder === i);
      if (!dayRow) continue;
      const effective = d.stops.length > 0 ? d.stops : [defaultStopFromCity(d.city)];
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
                kind,
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
        kind: c.kind,
        done: c.done,
        suggested: c.suggested,
        suggestedBy: c.suggested_by ?? null,
        shortcut: c.shortcut ?? null,
        shopFilter: c.shop_filter ?? null,
        dueDate: c.due_date ?? null,
      })),
    );
  }

  // Seed three placeholder companions so the user can pre-assign tasks
  // before figuring out who's actually coming.
  await db.insert(schema.tripCompanion).values(
    placeholderCompanions().map((p, i) => ({
      tripId: trip!.id,
      displayName: p.display_name,
      color: p.color,
      sortOrder: i,
    })),
  );

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
        parsed.data.days.map((d, i) => ({
          tripId: id,
          sortOrder: i,
          dayDate: d.day_date,
          city: d.city,
          note: d.note,
        })),
      )
      .returning({ id: schema.tripDay.id, sortOrder: schema.tripDay.sortOrder });

    const stopRows = [];
    for (let i = 0; i < parsed.data.days.length; i++) {
      const d = parsed.data.days[i]!;
      const dayRow = insertedDays.find((r) => r.sortOrder === i);
      if (!dayRow) continue;
      const effective = d.stops.length > 0 ? d.stops : [defaultStopFromCity(d.city)];
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
                kind: a.checklist_kind ?? fallbackChecklistKind(a.type),
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

// ─── CHECKLIST ITEM PATCH ───────────────────────────────────────────────
// Single-field updates (mark done, assign to a companion). Used by the
// checklist row + the assignee dropdown.

const checklistPatch = z.object({
  done: z.boolean().optional(),
  // null = unassign; uuid = assign to that companion.
  assigned_companion_id: z.string().uuid().nullable().optional(),
  text: z.string().min(1).max(500).optional(),
});

const attachmentPatch = z.object({
  status: z.enum(["required", "completed", "uploaded"]).optional(),
  image_name: z.string().min(1).max(240).optional(),
  image_data_url: z
    .string()
    .startsWith("data:image/")
    .max(2_000_000)
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
      kind: row.kind,
      done: row.done,
      suggested: row.suggested,
      suggested_by: row.suggestedBy,
      shortcut: row.shortcut,
      shop_filter: row.shopFilter,
      due_date: row.dueDate,
      assigned_companion_id: row.assignedCompanionId,
    },
  });
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
