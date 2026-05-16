import { sql } from "drizzle-orm";
import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";
import { trip } from "./trip";

// Travel companions for a trip. A companion is a *weak* relationship —
// it might be a real signed-in user (user_id set), or just a placeholder
// the trip owner created so they can pre-assign tasks before knowing who
// is actually coming. The invite_token, when set, is the share-link
// secret; once another user accepts via /invite/:token the token is
// cleared and user_id is populated.
export const tripCompanion = roamPoc.table(
  "trip_companion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    color: text("color").notNull().default("#0FB8B4"),
    sortOrder: integer("sort_order").notNull().default(0),
    // Linked auth user, if this companion has been claimed by someone.
    userId: text("user_id"),
    inviteToken: uuid("invite_token").defaultRandom(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("trip_companion_trip_idx").on(t.tripId, t.sortOrder),
    uniqueIndex("trip_companion_invite_token_unique").on(t.inviteToken),
    index("trip_companion_user_idx").on(t.userId),
  ],
);
