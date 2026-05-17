// Read-side Lumi chat routes (list conversations, fetch messages,
// delete conversations). Writes go through POST /trips/:id/lumi which
// already runs the OpenAI turn and persists alongside it.

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { geocodeCities } from "../geocode/nominatim.js";
import { runLumiTurn, type LumiDay } from "../lumi/openai.js";
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

  /* Reconstruct conversation history from DB rather than trusting the
     client's text-only memory. For assistant turns we rebuild the JSON
     envelope from `metadata` (saved on each insert) so the model can
     see its OWN past structured outputs, not just summary prose. Caps
     at 12 turns to match the previous client-side window. */
  const historyRows = await db
    .select()
    .from(schema.lumiMessage)
    .where(eq(schema.lumiMessage.conversationId, conversationId))
    .orderBy(asc(schema.lumiMessage.createdAt));
  // Drop the just-inserted user prompt — runLumiTurn re-adds it as the
  // final user message.
  const trimmedRows = historyRows.slice(0, -1).slice(-12);
  const history = trimmedRows.map((row) => {
    if (row.role === "assistant") {
      const meta = (row.metadata ?? null) as {
        days?: unknown;
        companions?: unknown;
        trip_draft?: unknown;
      } | null;
      /* Reconstruct the envelope this assistant turn actually returned,
         so the model can tell "I already shipped days[] last turn" from
         "I only acknowledged". Falls back to plain text if metadata is
         missing (older rows pre-this-fix). */
      const envelope: Record<string, unknown> = { summary: row.content };
      if (meta?.days) envelope.days = meta.days;
      if (meta?.companions) envelope.companions = meta.companions;
      if (meta?.trip_draft) envelope.trip_draft = meta.trip_draft;
      return {
        role: "assistant" as const,
        content: JSON.stringify(envelope),
      };
    }
    return { role: "user" as const, content: row.content };
  });

  let result;
  try {
    result = await runLumiTurn({
      prompt: parsed.data.prompt,
      history,
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
  let summary = result.summary;
  if (result.days && editableTrip && isAttachmentOnlyPrompt(parsed.data.prompt)) {
    const touched = await applyAttachmentPatch({
      tripId: editableTrip.tripId,
      editableTrip,
      days: result.days,
    });
    if (touched) {
      updatedDays = editableTrip.days;
      delete result.days;
      summary = "我已經把需要票券、訂位或上傳資料的行程標記上去了，原本的行程內容有保留下來。";
    } else {
      delete result.days;
      summary =
        "我先保護原本行程，這次沒有找到可安全對應的活動來標記票券或訂位。請指定活動名稱，我再幫你標上去。";
    }
  } else if (result.days && editableTrip) {
    if (!isSafeFullDayRewrite(parsed.data.prompt, editableTrip, result.days)) {
      delete result.days;
      summary =
        "我先保護原本行程，沒有套用這次會刪減既有活動的更新。如果你真的要重排，請明確說「重新規劃整天」。";
    }
  }

  if (result.days && editableTrip) {
    const tripId = editableTrip.tripId;
    await db.transaction(async (tx) => {
      /* trip_day_stop has ON DELETE CASCADE from trip_day, so wiping
         days clears stops too. Then re-insert days with `.returning`
         and bulk-insert their stops keyed by sort_order. Mirrors the
         shape in services/api/src/routes/trips.ts so the two write
         paths stay consistent. */
      await tx.delete(schema.tripDay).where(eq(schema.tripDay.tripId, tripId));
      const insertedDays = await tx
        .insert(schema.tripDay)
        .values(
          result.days!.map((d, i) => ({
            tripId,
            sortOrder: i,
            dayDate: d.day_date,
            city: d.city,
            note: d.note,
          })),
        )
        .returning({
          id: schema.tripDay.id,
          sortOrder: schema.tripDay.sortOrder,
        });

      const stopRows = [];
      for (let i = 0; i < result.days!.length; i++) {
        const d = result.days![i]!;
        const dayRow = insertedDays.find((r) => r.sortOrder === i);
        if (!dayRow) continue;
        /* Lumi may omit stops for a placeholder/rest day. Seed one
           stop named after `city` so the day still pins on the map. */
        const effective =
          d.stops && d.stops.length > 0
            ? d.stops
            : [{ name: d.city, kind: "other", note: "", attachments: [] }];
        for (let j = 0; j < effective.length; j++) {
          const s = effective[j]!;
          const attachments = [];
          for (const a of s.attachments ?? []) {
            let checklistItemId = a.checklist_item_id ?? null;
            if (!checklistItemId) {
              const [item] = await tx
                .insert(schema.tripChecklistItem)
                .values({
                  tripId,
                  text: a.checklist_text?.trim() || `${s.name}：${a.label}`,
                  kind: a.checklist_kind ?? fallbackChecklistKind(a.type ?? "ticket"),
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
            kind: s.kind ?? "other",
            arrivalTime: s.arrival_time ?? null,
            durationMin: s.duration_min ?? null,
            note: s.note ?? "",
            attachments,
            lat: null,
            lng: null,
          });
        }
      }
      if (stopRows.length > 0) {
        await tx.insert(schema.tripDayStop).values(stopRows);
      }

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

  /* Persist the FULL response payload in `metadata` so future turns can
     reconstruct what Lumi actually output, not just what she said. Without
     this, gpt-4o-mini drifts across turns — it sees only its prior
     summary text and treats acknowledgments ("我將為您規劃") as if they
     already shipped the structured days[]. Mirrors the LumiResult shape. */
  await db.insert(schema.lumiMessage).values({
    conversationId,
    role: "assistant",
    content: summary,
    metadata: {
      days: result.days ?? null,
      companions: result.companions ?? null,
      trip_draft: result.trip_draft ?? null,
    },
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
    summary,
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
  days: {
    day_date: string;
    city: string;
    note: string;
    /* Stops as currently stored. Empty array = day is unplanned, the
       model should treat that as "needs filling". Non-empty = already
       planned, model should preserve unless asked to rewrite. */
    stops: {
      id: string;
      name: string;
      kind: string;
      arrival_time: string | null;
      duration_min: number | null;
      note: string;
      attachments: {
        id?: string | null;
        type?: string;
        label: string;
        action_label?: string | null;
        checklist_text?: string | null;
        checklist_kind?: string | null;
        checklist_item_id?: string | null;
        image_name?: string | null;
        image_data_url?: string | null;
        status?: "required" | "completed" | "uploaded";
      }[];
    }[];
  }[];
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

  /* Pull every day's stops in one batch + group by day. Empty arrays
     are valid (placeholder days). The model uses this to tell "already
     planned" from "still needs filling". */
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
  const stopsByDay = new Map<string, typeof stops>();
  for (const s of stops) {
    const arr = stopsByDay.get(s.dayId);
    if (arr) arr.push(s);
    else stopsByDay.set(s.dayId, [s]);
  }

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
      stops: (stopsByDay.get(d.id) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        arrival_time: s.arrivalTime,
        duration_min: s.durationMin,
        note: s.note,
        attachments: normalizeLoadedAttachments(s.attachments),
      })),
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

function fallbackChecklistKind(type: string): string {
  if (type === "reservation") return "stay";
  if (type === "booking" || type === "flight") return "flight";
  if (type === "upload" || type === "document") return "doc";
  if (type === "transit") return "transit";
  return "ticket";
}

const ATTACHMENT_ONLY_PROMPT_RE =
  /買票|訂票|門票|票券|定位|訂位|預約|附件|上傳|標記|需要.*票|reservation|reserve|booking|book|ticket|attachment|upload|mark/i;

const REWRITE_SHRINK_OK_RE =
  /重新規劃|重排|刪|移除|拿掉|減少|精簡|只留|縮短|remove|delete|drop|shorten|simplify|replan|rewrite/i;

function isAttachmentOnlyPrompt(prompt: string): boolean {
  return (
    ATTACHMENT_ONLY_PROMPT_RE.test(prompt) &&
    !/重新規劃|重排|排程|安排|規劃整天|replan|rewrite|reschedule/i.test(prompt)
  );
}

function isSafeFullDayRewrite(
  prompt: string,
  editableTrip: LoadedEditableTrip,
  days: LumiDay[],
): boolean {
  if (REWRITE_SHRINK_OK_RE.test(prompt)) return true;

  const existingDates = new Set(editableTrip.days.map((d) => d.day_date));
  const nextDates = new Set(days.map((d) => d.day_date));
  for (const date of existingDates) {
    if (!nextDates.has(date)) return false;
  }

  const existingStopCount = editableTrip.days.reduce(
    (sum, d) => sum + d.stops.length,
    0,
  );
  const nextStopCount = days.reduce(
    (sum, d) => sum + (d.stops?.length ?? 0),
    0,
  );
  return existingStopCount === 0 || nextStopCount >= existingStopCount;
}

async function applyAttachmentPatch({
  tripId,
  editableTrip,
  days,
}: {
  tripId: string;
  editableTrip: LoadedEditableTrip;
  days: LumiDay[];
}): Promise<boolean> {
  const db = getDb();
  let touched = false;

  await db.transaction(async (tx) => {
    const existingDayByDate = new Map(
      editableTrip.days.map((day) => [day.day_date, day]),
    );

    for (const incomingDay of days) {
      const existingDay = existingDayByDate.get(incomingDay.day_date);
      if (!existingDay) continue;
      for (const incomingStop of incomingDay.stops ?? []) {
        const incomingAttachments = incomingStop.attachments ?? [];
        if (incomingAttachments.length === 0) continue;
        const existingStop = findMatchingStop(existingDay.stops, incomingStop.name);
        if (!existingStop) continue;

        const merged = [...existingStop.attachments];
        let stopTouched = false;
        const seen = new Set(
          merged.map((a) =>
            attachmentKey(
              a.type ?? "ticket",
              a.checklist_text ?? a.label,
            ),
          ),
        );

        for (const attachment of incomingAttachments) {
          const label = attachment.label?.trim();
          if (!label) continue;
          const type = attachment.type ?? "ticket";
          const checklistText =
            attachment.checklist_text?.trim() ||
            `${existingStop.name}：${label}`;
          const key = attachmentKey(type, checklistText);
          if (seen.has(key)) continue;

          let checklistItemId = attachment.checklist_item_id ?? null;
          if (!checklistItemId) {
            const [item] = await tx
              .insert(schema.tripChecklistItem)
              .values({
                tripId,
                text: checklistText,
                kind: attachment.checklist_kind ?? fallbackChecklistKind(type),
                done:
                  attachment.status === "completed" ||
                  attachment.status === "uploaded",
                suggested: true,
                suggestedBy: "Lumi",
                dueDate: incomingDay.day_date,
              })
              .returning({ id: schema.tripChecklistItem.id });
            checklistItemId = item?.id ?? null;
          }

          merged.push({
            id: attachment.id ?? null,
            type,
            label,
            action_label: attachment.action_label ?? null,
            checklist_text: checklistText,
            checklist_kind:
              attachment.checklist_kind ?? fallbackChecklistKind(type),
            checklist_item_id: checklistItemId,
            status: attachment.status ?? "required",
          });
          seen.add(key);
          stopTouched = true;
          touched = true;
        }

        if (stopTouched) {
          await tx
            .update(schema.tripDayStop)
            .set({ attachments: merged })
            .where(eq(schema.tripDayStop.id, existingStop.id));
        }
      }
    }

    if (touched) {
      await tx
        .update(schema.trip)
        .set({ updatedAt: new Date() })
        .where(eq(schema.trip.id, tripId));
    }
  });

  return touched;
}

function findMatchingStop(
  stops: LoadedEditableTrip["days"][number]["stops"],
  name: string,
) {
  const normalizedName = normalizeMatchText(name);
  return (
    stops.find((stop) => normalizeMatchText(stop.name) === normalizedName) ??
    stops.find((stop) => {
      const existing = normalizeMatchText(stop.name);
      return (
        existing.length >= 4 &&
        normalizedName.length >= 4 &&
        (existing.includes(normalizedName) || normalizedName.includes(existing))
      );
    })
  );
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[\s:：·・,，。()（）-]/g, "");
}

function attachmentKey(type: string, text: string): string {
  return `${type.trim().toLowerCase()}::${normalizeMatchText(text)}`;
}

function normalizeLoadedAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const label = typeof raw.label === "string" ? raw.label : "";
    if (!label.trim()) return [];
    const status: "required" | "completed" | "uploaded" =
      raw.status === "completed" || raw.status === "uploaded"
        ? raw.status
        : "required";
    return [
      {
        id: typeof raw.id === "string" ? raw.id : null,
        type: typeof raw.type === "string" ? raw.type : "ticket",
        label,
        action_label:
          typeof raw.action_label === "string" ? raw.action_label : null,
        checklist_text:
          typeof raw.checklist_text === "string" ? raw.checklist_text : null,
        checklist_kind:
          typeof raw.checklist_kind === "string" ? raw.checklist_kind : null,
        checklist_item_id:
          typeof raw.checklist_item_id === "string"
            ? raw.checklist_item_id
            : null,
        image_name: typeof raw.image_name === "string" ? raw.image_name : null,
        image_data_url:
          typeof raw.image_data_url === "string" ? raw.image_data_url : null,
        status,
      },
    ];
  });
}
