import { sql } from "drizzle-orm";
import {
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc } from "./_schema";

// Persistent geocoder cache. We resolve city names (東京, 京都, …) via
// Nominatim once and keep the result here forever — Nominatim is free but
// rate-limited (1 req/s) and we never want to depend on it at render time.
// `name_normalized` is the lookup key: trimmed + lowercased so 'Kyoto' and
// 'kyoto ' hit the same row.
export const cityGeocode = roamPoc.table(
  "city_geocode",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nameNormalized: text("name_normalized").notNull(),
    displayName: text("display_name"),
    lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
    lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
    countryCode: text("country_code"),
    source: text("source").notNull().default("nominatim"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("city_geocode_name_unique").on(t.nameNormalized)],
);
