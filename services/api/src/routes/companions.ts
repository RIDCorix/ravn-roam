// Trip companion routes (mounted under /trips/:tripId/companions).
//
// Companion concept: a weakly-bound trip participant. Three placeholders
// are auto-created when a trip is seeded so the user can pre-assign
// tasks before the rest of the group is even confirmed. Each row owns a
// per-companion `invite_token` — share `/invite/<token>` and whoever
// signs in there is permanently linked as that companion.

import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";

export const companionsRouter = new Hono();
companionsRouter.use("*", requireAuth);

type CompanionRow = typeof schema.tripCompanion.$inferSelect;

function rowToCompanion(row: CompanionRow) {
  return {
    id: row.id,
    trip_id: row.tripId,
    display_name: row.displayName,
    color: row.color,
    sort_order: row.sortOrder,
    user_id: row.userId,
    invite_token: row.inviteToken,
    accepted_at: row.acceptedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const PLACEHOLDER_COLORS = ["#0FB8B4", "#6F7DF7", "#E29A2C", "#D26AAF", "#57C383"];

export function placeholderCompanions(): {
  display_name: string;
  color: string;
}[] {
  return [
    { display_name: "旅伴 1", color: PLACEHOLDER_COLORS[0]! },
    { display_name: "旅伴 2", color: PLACEHOLDER_COLORS[1]! },
    { display_name: "旅伴 3", color: PLACEHOLDER_COLORS[2]! },
  ];
}

// Verify the caller owns the trip (or is one of its companions). Returns
// null if forbidden, otherwise the trip row.
async function loadTripFor(
  tripId: string,
  userId: string,
): Promise<{ id: string } | null> {
  const db = getDb();
  const [trip] = await db
    .select({ id: schema.trip.id })
    .from(schema.trip)
    .where(and(eq(schema.trip.id, tripId), eq(schema.trip.userId, userId)))
    .limit(1);
  if (trip) return trip;
  // Companions can also see this trip — admit them too.
  const [companion] = await db
    .select({ id: schema.tripCompanion.id })
    .from(schema.tripCompanion)
    .where(
      and(
        eq(schema.tripCompanion.tripId, tripId),
        eq(schema.tripCompanion.userId, userId),
      ),
    )
    .limit(1);
  return companion ? { id: tripId } : null;
}

// ─── LIST ──────────────────────────────────────────────────────────────

companionsRouter.get("/", async (c) => {
  const user = getUser(c);
  const tripId = c.req.param("tripId");
  if (!tripId) return c.json({ error: "missing_trip" }, 400);
  const trip = await loadTripFor(tripId, user.id);
  if (!trip) return c.json({ error: "not_found" }, 404);
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.tripId, tripId))
    .orderBy(asc(schema.tripCompanion.sortOrder));
  return c.json({ companions: rows.map(rowToCompanion) });
});

// ─── CREATE ────────────────────────────────────────────────────────────

const createInput = z.object({
  display_name: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
});

companionsRouter.post("/", async (c) => {
  const user = getUser(c);
  const tripId = c.req.param("tripId");
  if (!tripId) return c.json({ error: "missing_trip" }, 400);
  const trip = await loadTripFor(tripId, user.id);
  if (!trip) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json();
  const parsed = createInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  const existing = await db
    .select({ sortOrder: schema.tripCompanion.sortOrder })
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.tripId, tripId));
  const nextOrder =
    existing.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
  const color =
    parsed.data.color ??
    PLACEHOLDER_COLORS[nextOrder % PLACEHOLDER_COLORS.length]!;
  const [row] = await db
    .insert(schema.tripCompanion)
    .values({
      tripId,
      displayName: parsed.data.display_name,
      color,
      sortOrder: nextOrder,
    })
    .returning();
  return c.json({ companion: rowToCompanion(row!) }, 201);
});

// ─── PATCH ─────────────────────────────────────────────────────────────

const patchInput = z.object({
  display_name: z.string().min(1).max(80).optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().min(0).optional(),
  // Clear the invite token + linked user (un-claim the slot).
  reset_invite: z.boolean().optional(),
});

companionsRouter.patch("/:id", async (c) => {
  const user = getUser(c);
  const tripId = c.req.param("tripId");
  const id = c.req.param("id");
  if (!tripId) return c.json({ error: "missing_trip" }, 400);
  const trip = await loadTripFor(tripId, user.id);
  if (!trip) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json();
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.display_name != null) patch.displayName = parsed.data.display_name;
  if (parsed.data.color != null) patch.color = parsed.data.color;
  if (parsed.data.sort_order != null) patch.sortOrder = parsed.data.sort_order;
  if (parsed.data.reset_invite) {
    patch.userId = null;
    patch.acceptedAt = null;
    // Rotate the token so old share-links stop working.
    patch.inviteToken = crypto.randomUUID();
  }
  const [row] = await db
    .update(schema.tripCompanion)
    .set(patch)
    .where(
      and(
        eq(schema.tripCompanion.id, id),
        eq(schema.tripCompanion.tripId, tripId),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ companion: rowToCompanion(row) });
});

// ─── DELETE ────────────────────────────────────────────────────────────

companionsRouter.delete("/:id", async (c) => {
  const user = getUser(c);
  const tripId = c.req.param("tripId");
  const id = c.req.param("id");
  if (!tripId) return c.json({ error: "missing_trip" }, 400);
  const trip = await loadTripFor(tripId, user.id);
  if (!trip) return c.json({ error: "not_found" }, 404);
  const db = getDb();
  // Null out any checklist items that were pointing at this companion
  // before deletion (we don't have an FK constraint so the column would
  // otherwise dangle).
  await db
    .update(schema.tripChecklistItem)
    .set({ assignedCompanionId: null })
    .where(eq(schema.tripChecklistItem.assignedCompanionId, id));
  const [row] = await db
    .delete(schema.tripCompanion)
    .where(
      and(
        eq(schema.tripCompanion.id, id),
        eq(schema.tripCompanion.tripId, tripId),
      ),
    )
    .returning({ id: schema.tripCompanion.id });
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
