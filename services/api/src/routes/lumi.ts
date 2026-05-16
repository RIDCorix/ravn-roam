// Read-side Lumi chat routes (list conversations, fetch messages,
// delete conversations). Writes go through POST /trips/:id/lumi which
// already runs the OpenAI turn and persists alongside it.

import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { geocodeCities } from "../geocode/nominatim.js";
import { runLumiTurn } from "../lumi/openai.js";
import { getUser, requireAuth } from "./_auth.js";

export const lumiRouter = new Hono();
lumiRouter.use("*", requireAuth);

type ConversationRow = typeof schema.lumiConversation.$inferSelect;
type MessageRow = typeof schema.lumiMessage.$inferSelect;

function rowToConversation(row: ConversationRow) {
  return {
    id: row.id,
    user_id: row.userId,
    trip_id: row.tripId,
    title: row.title,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function rowToMessage(row: MessageRow) {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    role: row.role as "user" | "assistant",
    content: row.content,
    created_at: row.createdAt.toISOString(),
  };
}

// List the user's conversations. Optional `trip_id` filter — the
// storefront uses this on a trip page to show only chats for that trip.
lumiRouter.get("/conversations", async (c) => {
  const user = getUser(c);
  const url = new URL(c.req.url);
  const tripId = url.searchParams.get("trip_id");
  const db = getDb();
  const conditions = [eq(schema.lumiConversation.userId, user.id)];
  if (tripId) conditions.push(eq(schema.lumiConversation.tripId, tripId));
  const rows = await db
    .select()
    .from(schema.lumiConversation)
    .where(and(...conditions))
    .orderBy(desc(schema.lumiConversation.updatedAt))
    .limit(50);
  return c.json({ conversations: rows.map(rowToConversation) });
});

lumiRouter.get("/conversations/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();
  const [conv] = await db
    .select()
    .from(schema.lumiConversation)
    .where(
      and(
        eq(schema.lumiConversation.id, id),
        eq(schema.lumiConversation.userId, user.id),
      ),
    )
    .limit(1);
  if (!conv) return c.json({ error: "not_found" }, 404);
  const messages = await db
    .select()
    .from(schema.lumiMessage)
    .where(eq(schema.lumiMessage.conversationId, id))
    .orderBy(asc(schema.lumiMessage.createdAt));
  return c.json({
    conversation: rowToConversation(conv),
    messages: messages.map(rowToMessage),
  });
});

lumiRouter.delete("/conversations/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const db = getDb();
  const [row] = await db
    .delete(schema.lumiConversation)
    .where(
      and(
        eq(schema.lumiConversation.id, id),
        eq(schema.lumiConversation.userId, user.id),
      ),
    )
    .returning({ id: schema.lumiConversation.id });
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────
// CHAT — unified Lumi entry point.
//   * Page context (active trip, eSIM, tasks) folded into the system prompt.
//   * If current_trip_id is set AND the user owns it, Lumi may rewrite
//     its days. Otherwise concierge-mode answers only.
// ────────────────────────────────────────────────────────────────────────

const pageContextSchema = z
  .object({
    current_date: z.string().optional(),
    user_name: z.string().nullish(),
    active_trip: z
      .object({
        id: z.string(),
        title: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        days_total: z.number(),
        today_index: z.number().nullable(),
        today_city: z.string().nullable(),
        today_note: z.string().nullable(),
      })
      .nullish(),
    active_esim: z
      .object({
        country_name: z.string(),
        plan: z.string(),
        used_gb: z.number(),
        total_gb: z.number(),
        days_left: z.number(),
        days_total: z.number(),
        network: z.string(),
        signal: z.number(),
        speed: z.string(),
      })
      .nullish(),
    today_tasks: z
      .object({
        trip_id: z.string(),
        total: z.number(),
        done: z.number(),
        items: z.array(
          z.object({
            text: z.string(),
            done: z.boolean(),
            kind: z.string(),
            due_date: z.string().nullable(),
            suggested: z.boolean(),
          }),
        ),
      })
      .nullish(),
  })
  .strict();

const chatInput = z.object({
  prompt: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(40)
    .optional(),
  conversation_id: z.string().uuid().optional(),
  // When set, Lumi is allowed to rewrite this trip's days. The route
  // verifies ownership before unlocking editor mode.
  current_trip_id: z.string().uuid().optional(),
  context: pageContextSchema.optional(),
});

lumiRouter.post("/chat", async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const parsed = chatInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb();

  // Resolve editable trip (if any).
  let editableTrip: Awaited<ReturnType<typeof loadEditableTrip>> | null = null;
  if (parsed.data.current_trip_id) {
    editableTrip = await loadEditableTrip(parsed.data.current_trip_id, user.id);
    if (editableTrip === "forbidden") {
      // Caller passed a trip they don't own. Fall back to concierge.
      editableTrip = null;
    }
  }

  // Resolve / create conversation. trip_id is set when we have an editable
  // trip, otherwise null (concierge conversations group together).
  let conversationId = parsed.data.conversation_id ?? null;
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(schema.lumiConversation)
      .where(
        and(
          eq(schema.lumiConversation.id, conversationId),
          eq(schema.lumiConversation.userId, user.id),
        ),
      )
      .limit(1);
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const title = parsed.data.prompt.slice(0, 60);
    const [row] = await db
      .insert(schema.lumiConversation)
      .values({
        userId: user.id,
        tripId: editableTrip ? editableTrip.tripId : null,
        title,
      })
      .returning({ id: schema.lumiConversation.id });
    conversationId = row!.id;
  }
  await db.insert(schema.lumiMessage).values({
    conversationId,
    role: "user",
    content: parsed.data.prompt,
  });

  let result;
  try {
    result = await runLumiTurn({
      prompt: parsed.data.prompt,
      history: parsed.data.history,
      editableTrip: editableTrip
        ? {
            title: editableTrip.title,
            start_date: editableTrip.start_date,
            end_date: editableTrip.end_date,
            days: editableTrip.days,
            cities: editableTrip.cities,
            companions: editableTrip.companions,
          }
        : undefined,
      context: parsed.data.context,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "lumi_error";
    await db.insert(schema.lumiMessage).values({
      conversationId,
      role: "assistant",
      content: `（Lumi 暫時連不上：${message}）`,
    });
    return c.json(
      { error: "lumi_error", message, conversation_id: conversationId },
      502,
    );
  }

  // Apply day rewrite (editor mode only).
  let updatedDays: typeof editableTrip extends null
    ? never
    : Array<{ day_date: string; city: string; note: string }> | null = null;
  let updatedCities: Array<{
    name: string;
    lat: number | null;
    lng: number | null;
  }> | null = null;
  if (result.days && editableTrip) {
    const tripId = editableTrip.tripId;
    await db.transaction(async (tx) => {
      await tx.delete(schema.tripDay).where(eq(schema.tripDay.tripId, tripId));
      await tx.insert(schema.tripDay).values(
        result.days!.map((d, i) => ({
          tripId,
          sortOrder: i,
          dayDate: d.day_date,
          city: d.city,
          note: d.note,
        })),
      );
      await tx
        .update(schema.trip)
        .set({
          startDate: result.days![0]!.day_date,
          endDate: result.days![result.days!.length - 1]!.day_date,
          updatedAt: new Date(),
        })
        .where(eq(schema.trip.id, tripId));
    });
    updatedDays = result.days;
    const orderedCities: string[] = [];
    const seen = new Set<string>();
    for (const d of result.days) {
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
    updatedCities = orderedCities.map((name) => ({
      name,
      lat: coordByName.get(name.toLowerCase())?.lat ?? null,
      lng: coordByName.get(name.toLowerCase())?.lng ?? null,
    }));
  }

  // Apply companion CRUD (editor mode only). The Lumi system prompt only
  // emits ids that exist in the input — but we still scope every write
  // by tripId so a bad id can't escape the trip.
  let companionsTouched = false;
  if (result.companions && editableTrip) {
    const tripId = editableTrip.tripId;
    const knownIds = new Set(editableTrip.companions.map((cmp) => cmp.id));
    const existingSortOrder = editableTrip.companions.reduce(
      (max, cmp, i) => Math.max(max, i),
      -1,
    );
    let nextSort = existingSortOrder + 1;
    for (const edit of result.companions) {
      if (edit.id && knownIds.has(edit.id)) {
        if (edit.delete) {
          await db
            .update(schema.tripChecklistItem)
            .set({ assignedCompanionId: null })
            .where(eq(schema.tripChecklistItem.assignedCompanionId, edit.id));
          await db
            .delete(schema.tripCompanion)
            .where(
              and(
                eq(schema.tripCompanion.id, edit.id),
                eq(schema.tripCompanion.tripId, tripId),
              ),
            );
          companionsTouched = true;
        } else {
          const patch: Record<string, unknown> = { updatedAt: new Date() };
          if (edit.display_name) patch.displayName = edit.display_name;
          if (edit.color) patch.color = edit.color;
          if (Object.keys(patch).length > 1) {
            await db
              .update(schema.tripCompanion)
              .set(patch)
              .where(
                and(
                  eq(schema.tripCompanion.id, edit.id),
                  eq(schema.tripCompanion.tripId, tripId),
                ),
              );
            companionsTouched = true;
          }
        }
      } else if (!edit.delete && edit.display_name) {
        // Create.
        await db.insert(schema.tripCompanion).values({
          tripId,
          displayName: edit.display_name,
          color: edit.color ?? "#0FB8B4",
          sortOrder: nextSort++,
        });
        companionsTouched = true;
      }
    }
  }

  await db.insert(schema.lumiMessage).values({
    conversationId,
    role: "assistant",
    content: result.summary,
  });
  await db
    .update(schema.lumiConversation)
    .set({ updatedAt: new Date() })
    .where(eq(schema.lumiConversation.id, conversationId));

  let updatedCompanions:
    | Array<{
        id: string;
        display_name: string;
        color: string;
        user_id: string | null;
        accepted_at: string | null;
      }>
    | null = null;
  if (companionsTouched && editableTrip) {
    const rows = await db
      .select()
      .from(schema.tripCompanion)
      .where(eq(schema.tripCompanion.tripId, editableTrip.tripId))
      .orderBy(asc(schema.tripCompanion.sortOrder));
    updatedCompanions = rows.map((r) => ({
      id: r.id,
      display_name: r.displayName,
      color: r.color,
      user_id: r.userId,
      accepted_at: r.acceptedAt?.toISOString() ?? null,
    }));
  }

  return c.json({
    summary: result.summary,
    days: updatedDays,
    cities: updatedCities,
    companions: updatedCompanions,
    trip_draft: result.trip_draft ?? null,
    conversation_id: conversationId,
  });
});

interface LoadedEditableTrip {
  tripId: string;
  title: string;
  start_date: string;
  end_date: string;
  days: { day_date: string; city: string; note: string }[];
  cities: {
    name: string;
    lat: number | null;
    lng: number | null;
    country_code: string | null;
  }[];
  companions: {
    id: string;
    display_name: string;
    color: string;
    user_id: string | null;
    accepted_at: string | null;
  }[];
}

async function loadEditableTrip(
  tripId: string,
  userId: string,
): Promise<LoadedEditableTrip | "forbidden"> {
  const db = getDb();
  const [trip] = await db
    .select()
    .from(schema.trip)
    .where(and(eq(schema.trip.id, tripId), eq(schema.trip.userId, userId)))
    .limit(1);
  if (!trip) return "forbidden";

  const days = await db
    .select()
    .from(schema.tripDay)
    .where(eq(schema.tripDay.tripId, tripId))
    .orderBy(asc(schema.tripDay.sortOrder));

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
  const cities = orderedCities.map((name) => ({
    name,
    lat: coordByName.get(name.toLowerCase())?.lat ?? null,
    lng: coordByName.get(name.toLowerCase())?.lng ?? null,
    country_code: coordByName.get(name.toLowerCase())?.country_code ?? null,
  }));

  const companions = await db
    .select()
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.tripId, tripId))
    .orderBy(asc(schema.tripCompanion.sortOrder));

  return {
    tripId: trip.id,
    title: trip.title,
    start_date: trip.startDate,
    end_date: trip.endDate,
    days: days.map((d) => ({
      day_date: d.dayDate,
      city: d.city,
      note: d.note,
    })),
    cities,
    companions: companions.map((c) => ({
      id: c.id,
      display_name: c.displayName,
      color: c.color,
      user_id: c.userId,
      accepted_at: c.acceptedAt?.toISOString() ?? null,
    })),
  };
}
