// /invite — companion invite resolution + acceptance.
//
// GET  /invite/:token  → public-ish info about the invite (trip title +
//                        the companion slot the link is for). No auth
//                        required so the recipient can see what they're
//                        joining before signing in.
//
// POST /invite/:token/accept → auth'd; attaches the caller's Supabase
//                        user_id to that companion slot and clears the
//                        invite token. Idempotent on the slot — calling
//                        again on a claimed slot returns 409.

import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";

export const inviteRouter = new Hono();

inviteRouter.get("/:token", async (c) => {
  const token = c.req.param("token");
  if (!token) return c.json({ error: "invalid_token" }, 400);
  const db = getDb();
  const [companion] = await db
    .select({
      id: schema.tripCompanion.id,
      display_name: schema.tripCompanion.displayName,
      color: schema.tripCompanion.color,
      accepted_at: schema.tripCompanion.acceptedAt,
      trip_id: schema.tripCompanion.tripId,
      trip_title: schema.trip.title,
      trip_owner_id: schema.trip.userId,
      start_date: schema.trip.startDate,
      end_date: schema.trip.endDate,
    })
    .from(schema.tripCompanion)
    .innerJoin(schema.trip, eq(schema.trip.id, schema.tripCompanion.tripId))
    .where(eq(schema.tripCompanion.inviteToken, token))
    .limit(1);
  if (!companion) return c.json({ error: "invalid_token" }, 404);
  if (companion.accepted_at) {
    return c.json({ error: "already_accepted" }, 409);
  }
  return c.json({
    invite: {
      companion_id: companion.id,
      display_name: companion.display_name,
      color: companion.color,
      trip_id: companion.trip_id,
      trip_title: companion.trip_title,
      start_date: companion.start_date,
      end_date: companion.end_date,
    },
  });
});

inviteRouter.post("/:token/accept", requireAuth, async (c) => {
  const user = getUser(c);
  const token = c.req.param("token");
  if (!token) return c.json({ error: "invalid_token" }, 400);
  const db = getDb();
  const [companion] = await db
    .select()
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.inviteToken, token))
    .limit(1);
  if (!companion) return c.json({ error: "invalid_token" }, 404);
  if (companion.userId) return c.json({ error: "already_accepted" }, 409);

  const [row] = await db
    .update(schema.tripCompanion)
    .set({
      userId: user.id,
      acceptedAt: new Date(),
      inviteToken: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tripCompanion.id, companion.id))
    .returning();
  return c.json({
    companion: {
      id: row!.id,
      trip_id: row!.tripId,
      display_name: row!.displayName,
    },
  });
});
