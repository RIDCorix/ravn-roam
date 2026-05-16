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

import { and, asc, eq } from "drizzle-orm";
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

const dayInput = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1).max(120),
  note: z.string().max(2000).default(""),
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

// ─── Row → JSON ────────────────────────────────────────────────────────

type TripRow = typeof schema.trip.$inferSelect;
type TripDayRow = typeof schema.tripDay.$inferSelect;
type ChecklistRow = typeof schema.tripChecklistItem.$inferSelect;

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

function rowToDay(row: TripDayRow) {
  return {
    id: row.id,
    trip_id: row.tripId,
    sort_order: row.sortOrder,
    day_date: row.dayDate,
    city: row.city,
    note: row.note,
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

  // Build the de-duplicated, in-itinerary-order city list and geocode it.
  // The map renderer wants both: order (for the route polyline) and coords.
  const orderedCities: string[] = [];
  const seen = new Set<string>();
  for (const d of days) {
    const key = d.city.trim();
    if (!seen.has(key)) {
      seen.add(key);
      orderedCities.push(key);
    }
  }
  const geocoded = await geocodeCities(orderedCities).catch(() => []);
  const coordByName = new Map(
    geocoded.map((g) => [g.name.trim().toLowerCase(), g]),
  );
  const cities = orderedCities.map((name) => {
    const c = coordByName.get(name.toLowerCase());
    return {
      name,
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
    };
  });

  return c.json({
    trip: rowToTrip(trip),
    days: days.map(rowToDay),
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

  if (parsed.data.days.length > 0) {
    await db.insert(schema.tripDay).values(
      parsed.data.days.map((d, i) => ({
        tripId: trip!.id,
        sortOrder: i,
        dayDate: d.day_date,
        city: d.city,
        note: d.note,
      })),
    );
  }

  if (parsed.data.checklist.length > 0) {
    await db.insert(schema.tripChecklistItem).values(
      parsed.data.checklist.map((c) => ({
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
    await tx.delete(schema.tripDay).where(eq(schema.tripDay.tripId, id));
    await tx.insert(schema.tripDay).values(
      parsed.data.days.map((d, i) => ({
        tripId: id,
        sortOrder: i,
        dayDate: d.day_date,
        city: d.city,
        note: d.note,
      })),
    );
    await tx
      .update(schema.trip)
      .set({
        startDate: parsed.data.days[0]!.day_date,
        endDate: parsed.data.days[parsed.data.days.length - 1]!.day_date,
        updatedAt: new Date(),
      })
      .where(eq(schema.trip.id, id));
  });

  const days = await db
    .select()
    .from(schema.tripDay)
    .where(eq(schema.tripDay.tripId, id))
    .orderBy(asc(schema.tripDay.sortOrder));

  return c.json({ days: days.map(rowToDay) });
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

