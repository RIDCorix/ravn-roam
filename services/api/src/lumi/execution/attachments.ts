import { and, eq } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import schema from "../../db/schema/index.js";
import type { LumiCommand } from "../contracts/commands.js";
import type { ExecutedLumiCommand } from "./itinerary.js";

type AttachmentCommand = Extract<
  LumiCommand,
  { type: "upsert_stop_attachment" }
>;

type StoredAttachment = {
  id?: string | null;
  type?: string;
  label: string;
  url?: string | null;
  amount?: string | null;
  action_label?: string | null;
  checklist_text?: string | null;
  checklist_description?: string | null;
  checklist_kind?: string | null;
  checklist_item_id?: string | null;
  status?: "required" | "completed" | "uploaded";
};

function storedAttachments(value: unknown): StoredAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is StoredAttachment =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { label?: unknown }).label === "string",
  );
}

function attachmentKey(attachment: StoredAttachment): string {
  return `${attachment.type ?? "ticket"}::${attachment.checklist_text ?? attachment.label}`;
}

export async function executeAttachmentCommand(
  command: AttachmentCommand,
  context: { userId: string; tripId: string },
): Promise<ExecutedLumiCommand> {
  const db = getDb();
  try {
    const [ownedStop] = await db
      .select({
        id: schema.tripDayStop.id,
        name: schema.tripDayStop.name,
        dayDate: schema.tripDay.dayDate,
        attachments: schema.tripDayStop.attachments,
      })
      .from(schema.tripDayStop)
      .innerJoin(schema.tripDay, eq(schema.tripDayStop.dayId, schema.tripDay.id))
      .innerJoin(schema.trip, eq(schema.tripDay.tripId, schema.trip.id))
      .where(
        and(
          eq(schema.tripDayStop.id, command.stop_id),
          eq(schema.trip.id, context.tripId),
          eq(schema.trip.userId, context.userId),
        ),
      )
      .limit(1);
    if (!ownedStop) {
      return {
        type: command.type,
        status: "error",
        target_id: command.stop_id,
        code: "invalid_reference",
      };
    }

    const incoming: StoredAttachment = {
      ...command.attachment,
      id: command.attachment.id ?? null,
      type: command.attachment.type ?? "ticket",
      url: command.attachment.url ?? null,
      amount: command.attachment.amount ?? null,
      action_label: command.attachment.action_label ?? null,
      checklist_text: command.attachment.checklist_text ?? null,
      checklist_description: command.attachment.checklist_description ?? null,
      checklist_kind: command.attachment.checklist_kind ?? null,
      checklist_item_id: command.attachment.checklist_item_id ?? null,
      status: command.attachment.status ?? "required",
    };
    const attachments = storedAttachments(ownedStop.attachments);
    const index = attachments.findIndex((current) =>
      incoming.id && current.id
        ? incoming.id === current.id
        : attachmentKey(incoming) === attachmentKey(current),
    );
    if (index >= 0) attachments[index] = { ...attachments[index], ...incoming };
    else attachments.push(incoming);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.tripDayStop)
        .set({ attachments })
        .where(eq(schema.tripDayStop.id, ownedStop.id));
      await tx
        .update(schema.trip)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(schema.trip.id, context.tripId),
            eq(schema.trip.userId, context.userId),
          ),
        );
    });

    return {
      type: command.type,
      status: "success",
      target_id: command.stop_id,
    };
  } catch {
    return {
      type: command.type,
      status: "error",
      target_id: command.stop_id,
      code: "execution_failed",
    };
  }
}
