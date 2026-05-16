import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";
import { trip } from "./trip";

// Persistent Lumi chat history. One row per logical conversation; the
// optional `trip_id` ties a chat to the trip it edits so the storefront
// can scope the conversation list when the user is viewing that trip.
// Clearing the trip (delete) keeps the chat but null-references it.
export const lumiConversation = roamPoc.table(
  "lumi_conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("lumi_conversation_user_idx").on(t.userId, t.updatedAt),
    index("lumi_conversation_trip_idx").on(t.tripId),
  ],
);

// Individual turns. `metadata` stores anything we want to snapshot for
// future replay (e.g. the day list as it stood when the turn happened)
// without bloating the user-visible content.
export const lumiMessage = roamPoc.table(
  "lumi_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => lumiConversation.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("lumi_message_conversation_idx").on(t.conversationId, t.createdAt)],
);
