import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { roamPoc, storefrontEventType } from "./_schema";

/**
 * Seasonal / promotional events surfaced in the /shop "Trending now"
 * carousel. The crawler upserts here daily; ops can also hand-author
 * rows (e.g. flash promo tied to a specific date). Each row deep-links
 * to a region page, optionally pre-positioning the day-slider / data
 * tier so the user lands on a sensible buyable plan.
 *
 * Recurrence model: events that repeat every year set
 * `recurring_month_start`/`_end` (1..12). One-off events use the
 * explicit `start_date`/`end_date` columns. Either set is fine — the
 * API filter prefers explicit dates when both are present.
 */
export const storefrontEvent = roamPoc.table(
  "storefront_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable slug used in URLs and the crawler upsert key. Combine
    // event + year for one-off, or just event-name for recurring.
    slug: text("slug").notNull(),
    titleI18n: jsonb("title_i18n").notNull().default(sql`'{}'::jsonb`),
    subtitleI18n: jsonb("subtitle_i18n").notNull().default(sql`'{}'::jsonb`),
    eventType: storefrontEventType("event_type").notNull().default("other"),
    // FK-ish — matches storefront-regions.ts slug. Not a real FK
    // because regions live in code, not the DB.
    regionSlug: text("region_slug").notNull(),

    // Optional shopping hints. Frontend passes them as ?days=&gb= to
    // the region page.
    suggestedDays: integer("suggested_days"),
    suggestedGb: numeric("suggested_gb", { precision: 5, scale: 1 }),

    // Date model — explicit date wins, otherwise recurring month range.
    startDate: date("start_date"),
    endDate: date("end_date"),
    recurringMonthStart: smallint("recurring_month_start"),
    recurringMonthEnd: smallint("recurring_month_end"),

    // Presentation
    coverImage: text("cover_image"), // path under /illustrations or remote URL
    tint: text("tint"), // warm | cool | violet | ember | spring
    badgeOverride: text("badge_override"), // "3-4月" etc; auto-derived if null

    // Crawl metadata
    source: text("source").notNull().default("manual"), // manual | openai | wikipedia
    sourceUrl: text("source_url"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),

    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("storefront_event_slug_unique").on(t.slug),
    // Hot path: list active events optionally filtered by type.
    index("storefront_event_active_type_idx").on(t.active, t.eventType),
    // Hot path: list events for a single region page.
    index("storefront_event_region_idx").on(t.regionSlug),
  ],
);
