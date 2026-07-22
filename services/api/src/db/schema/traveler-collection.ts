import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";

export const travelerProfile = roamPoc.table(
  "traveler_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    level: integer("level").notNull().default(1),
    xpTotal: integer("xp_total").notNull().default(0),
    xpIntoLevel: integer("xp_into_level").notNull().default(0),
    xpToNext: integer("xp_to_next").notNull().default(1000),
    visitedCountryCount: integer("visited_country_count").notNull().default(0),
    visitedCityCount: integer("visited_city_count").notNull().default(0),
    visitedPlaceCount: integer("visited_place_count").notNull().default(0),
    photoCount: integer("photo_count").notNull().default(0),
    achievementCount: integer("achievement_count").notNull().default(0),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("traveler_profile_user_uidx").on(t.userId),
    index("traveler_profile_level_idx").on(t.level),
  ],
);

export const travelerPlace = roamPoc.table(
  "traveler_place",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    placeKey: text("place_key").notNull(),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").notNull().default(sql`'{}'::jsonb`),
    country: text("country").notNull(),
    countryCode: text("country_code"),
    city: text("city"),
    continent: text("continent").notNull(),
    kind: text("kind").notNull().default("city"),
    status: text("status").notNull().default("visited"),
    visitedAt: date("visited_at"),
    coverImage: text("cover_image"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    favorite: boolean("favorite").notNull().default(false),
    sourceTripId: uuid("source_trip_id"),
    notes: text("notes").notNull().default(""),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("traveler_place_user_key_uidx").on(t.userId, t.placeKey),
    index("traveler_place_user_status_idx").on(t.userId, t.status),
    index("traveler_place_user_visited_idx").on(t.userId, t.visitedAt),
  ],
);

export const travelerPhoto = roamPoc.table(
  "traveler_photo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    photoKey: text("photo_key").notNull(),
    placeId: uuid("place_id").references(() => travelerPlace.id, {
      onDelete: "set null",
    }),
    tripId: uuid("trip_id"),
    imageUrl: text("image_url").notNull(),
    caption: text("caption").notNull().default(""),
    takenAt: date("taken_at"),
    xpAwarded: integer("xp_awarded").notNull().default(10),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("traveler_photo_user_key_uidx").on(t.userId, t.photoKey),
    index("traveler_photo_user_taken_idx").on(t.userId, t.takenAt),
    index("traveler_photo_place_idx").on(t.placeId),
  ],
);

export const travelerAchievement = roamPoc.table(
  "traveler_achievement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    achievementKey: text("achievement_key").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    badgeImage: text("badge_image"),
    unlockedAt: date("unlocked_at").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("traveler_achievement_user_key_uidx").on(
      t.userId,
      t.achievementKey,
    ),
    index("traveler_achievement_user_unlocked_idx").on(t.userId, t.unlockedAt),
  ],
);
