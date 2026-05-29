/**
 * Daily-runnable crawler that asks an LLM to research upcoming
 * festivals / carnivals / seasonal events across the regions the
 * storefront catalogues, then upserts them into
 * `roam_poc.storefront_event`. The /shop "Trending now" carousel reads
 * these rows.
 *
 * Usage:
 *   pnpm --filter @roam/api tsx src/cli/crawl-shop-events.ts [--dry-run] [--horizon-months=6]
 *
 * Schedule it on Railway / Vercel cron at e.g. 04:00 UTC daily.
 * Idempotent — slug is the unique key, lastSeenAt updates each run.
 */

import { eq } from "drizzle-orm";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";

// The slug set that maps directly into apps/web's storefront-regions.ts.
// We pass it to the LLM so it can never invent unknown regions.
const REGION_SLUGS = [
  "japan",
  "korea",
  "taipei",
  "hong-kong",
  "macau",
  "china",
  "greater-china",
  "singapore-malaysia",
  "thailand",
  "vietnam",
  "indonesia",
  "anz",
  "saipan-guam",
  "europe",
  "western-northern-europe",
  "central-eastern-europe-balkans",
  "spain-camino",
  "turkey",
  "usa",
  "north-america",
  "south-america",
  "africa",
  "india",
] as const;

const EVENT_TYPES = [
  "festival",
  "carnival",
  "religious",
  "music",
  "sports",
  "food",
  "seasonal",
  "cultural",
  "other",
] as const;

const TINTS = ["warm", "cool", "violet", "ember", "spring"] as const;

interface CrawledEvent {
  slug: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string | null;
  subtitle_en: string | null;
  event_type: (typeof EVENT_TYPES)[number];
  region_slug: (typeof REGION_SLUGS)[number];
  suggested_days: number | null;
  suggested_gb: number | null;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  tint: (typeof TINTS)[number] | null;
  badge_override: string | null;
  source_url: string | null;
}

function buildPrompt(horizonMonths: number): string {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + horizonMonths);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return `You are a travel-events researcher for an eSIM storefront. Today is ${fmt(now)}.

Return a JSON object { "events": Event[] } where each Event captures one major festival, carnival, religious holiday, music/food event, sports event, or seasonal phenomenon that occurs between ${fmt(now)} and ${fmt(horizon)}.

Requirements:
- 15-30 events total. Prioritise globally famous, photo-worthy events that move tourism (e.g. Sakura, Songkran, Holi, Gion Matsuri, Oktoberfest, Coachella, Venice Carnival, NYE fireworks). Skip obscure local events.
- Each event MUST be tagged to a region_slug from this list:
  ${REGION_SLUGS.join(", ")}
  Pick the SMALLEST region that fully covers the event city. (Tokyo → "japan", not "asia". Venice → "europe", not just a subregion that excludes Italy.)
- event_type ∈ ${EVENT_TYPES.join(" | ")}.
- slug: kebab-case, stable across re-runs (e.g. "jp-sakura-2026", "kyoto-gion-matsuri", "venice-carnival"). For annually-recurring events without a year suffix is fine.
- title_zh / title_en / subtitle_zh / subtitle_en: short, punchy.
  - title_zh / subtitle_zh MUST be Traditional Chinese (繁體中文 zh-TW) using Taiwan-style vocabulary (e.g. "巴西狂歡節" not "巴西狂欢节"; "櫻花" not "樱花"; "影展" not "电影节"; "新加坡" not "新嘉坡"). Reject any simplified-character output.
- Dates:
  - If the event has confirmed exact dates this cycle, set start_date / end_date (YYYY-MM-DD).
  - If it's a recurring annual season (e.g. sakura in March-April), set recurring_month_start (1-12) / recurring_month_end (1-12) and leave start_date / end_date null.
- suggested_days: typical trip length for a visitor coming for THIS event (1-30). null if unsure.
- suggested_gb: typical data need in GB for the trip (1-30). null if unsure.
- tint ∈ ${TINTS.join(" | ")} — pick a hue that matches the event mood (spring sakura → "spring", winter NYE → "cool", carnival → "warm").
- badge_override: short date label like "3-4月" / "12月底" / "夏季" — null if you don't want a custom one (the frontend will auto-derive).
- source_url: best-known Wikipedia or official source URL when confident; null otherwise.

Be honest about uncertainty — null any field you don't know.`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
          title_zh: { type: "string" },
          title_en: { type: "string" },
          subtitle_zh: { type: ["string", "null"] },
          subtitle_en: { type: ["string", "null"] },
          event_type: { type: "string", enum: [...EVENT_TYPES] },
          region_slug: { type: "string", enum: [...REGION_SLUGS] },
          suggested_days: { type: ["integer", "null"] },
          suggested_gb: { type: ["number", "null"] },
          start_date: { type: ["string", "null"] },
          end_date: { type: ["string", "null"] },
          recurring_month_start: { type: ["integer", "null"] },
          recurring_month_end: { type: ["integer", "null"] },
          tint: {
            anyOf: [{ type: "null" }, { type: "string", enum: [...TINTS] }],
          },
          badge_override: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "slug",
          "title_zh",
          "title_en",
          "subtitle_zh",
          "subtitle_en",
          "event_type",
          "region_slug",
          "suggested_days",
          "suggested_gb",
          "start_date",
          "end_date",
          "recurring_month_start",
          "recurring_month_end",
          "tint",
          "badge_override",
          "source_url",
        ],
      },
    },
  },
  required: ["events"],
} as const;

async function callOpenAI(
  horizonMonths: number,
): Promise<CrawledEvent[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.LUMI_MODEL ?? "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Reply with strict JSON only." },
        { role: "user", content: buildPrompt(horizonMonths) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "events_response",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const parsed = JSON.parse(json.choices[0]!.message.content) as {
    events: CrawledEvent[];
  };
  return parsed.events;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const horizonArg = argv.find((a) => a.startsWith("--horizon-months="));
  const horizon = horizonArg ? Number(horizonArg.split("=")[1]) : 6;

  console.log(
    `[crawl-events] horizon=${horizon}mo dry-run=${dryRun} fetching from OpenAI…`,
  );
  const events = await callOpenAI(horizon);
  console.log(`[crawl-events] LLM returned ${events.length} events`);

  if (dryRun) {
    for (const e of events.slice(0, 8)) {
      console.log(
        `  ${e.region_slug.padEnd(28)} ${e.event_type.padEnd(10)} ${e.slug.padEnd(28)} ${e.title_zh}`,
      );
    }
    console.log(`  …and ${Math.max(0, events.length - 8)} more`);
    return;
  }

  const db = getDb();
  let inserted = 0;
  let updated = 0;
  const now = new Date();

  for (const e of events) {
    const values = {
      slug: e.slug,
      titleI18n: { "zh-TW": e.title_zh, en: e.title_en },
      subtitleI18n: {
        ...(e.subtitle_zh ? { "zh-TW": e.subtitle_zh } : {}),
        ...(e.subtitle_en ? { en: e.subtitle_en } : {}),
      },
      eventType: e.event_type,
      regionSlug: e.region_slug,
      suggestedDays: e.suggested_days,
      suggestedGb: e.suggested_gb == null ? null : String(e.suggested_gb),
      startDate: e.start_date,
      endDate: e.end_date,
      recurringMonthStart: e.recurring_month_start,
      recurringMonthEnd: e.recurring_month_end,
      tint: e.tint,
      badgeOverride: e.badge_override,
      source: "openai" as const,
      sourceUrl: e.source_url,
      lastSeenAt: now,
      rawPayload: e as unknown as Record<string, unknown>,
      active: true,
    };

    const [existing] = await db
      .select({ id: schema.storefrontEvent.id })
      .from(schema.storefrontEvent)
      .where(eq(schema.storefrontEvent.slug, e.slug))
      .limit(1);
    if (existing) {
      await db
        .update(schema.storefrontEvent)
        .set({ ...values, updatedAt: now })
        .where(eq(schema.storefrontEvent.id, existing.id));
      updated++;
    } else {
      await db.insert(schema.storefrontEvent).values(values);
      inserted++;
    }
  }

  console.log(`[crawl-events] done: inserted=${inserted} updated=${updated}`);
}

main().catch((err) => {
  console.error("[crawl-events] FAILED:", err);
  process.exit(1);
});
