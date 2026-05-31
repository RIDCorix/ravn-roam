/**
 * Weekly-runnable crawler that researches events by market and category,
 * archives the canonical facts, translates them, then upserts rows into
 * `roam_poc.storefront_event`. The /shop "Trending now" carousel reads
 * these rows.
 *
 * Usage:
 *   pnpm --filter @roam/api tsx src/cli/crawl-shop-events.ts [--dry-run] [--horizon-months=6]
 *   pnpm --filter @roam/api tsx src/cli/crawl-shop-events.ts --dry-run --market=japan --category=seasonal
 *
 * Schedule weekly on Railway / Vercel cron. Idempotent — slug is the
 * unique key, lastSeenAt updates each run.
 */

import { eq } from "drizzle-orm";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getDb } from "../db/client.js";
import type { Db } from "../db/client.js";
import schema from "../db/schema/index.js";
import { env } from "../env.js";
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  HOT_MARKETS,
  REGION_SLUGS,
  TINTS,
  type EventCategory,
  type EventCrawlerProvider,
  type EventType,
  type HotMarket,
  type RegionSlug,
  type Tint,
} from "./shop-event-crawler-config.js";

export { EVENT_CATEGORIES, HOT_MARKETS } from "./shop-event-crawler-config.js";

const CRAWL_VERSION = "market-category-v1";
const DEFAULT_CHECKPOINT_FILE = ".cache/shop-events-crawler-checkpoint.json";
let lastRequestAt = 0;

interface CrawledEvent {
  slug: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string | null;
  subtitle_en: string | null;
  event_type: EventType;
  region_slug: RegionSlug;
  suggested_days: number | null;
  suggested_gb: number | null;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  tint: Tint | null;
  badge_override: string | null;
  source_url: string | null;
  source: EventCrawlerProvider;
  raw_payload: Record<string, unknown>;
}

interface DiscoveredEvent {
  slug: string;
  canonical_name: string;
  city: string | null;
  country_code: string | null;
  summary: string | null;
  event_type: EventType;
  region_slug: RegionSlug;
  suggested_days: number | null;
  suggested_gb: number | null;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  tint: Tint | null;
  badge_hint: string | null;
  source_url: string | null;
  market_id: string;
  market_zh: string;
  market_en: string;
  category_id: string;
  category_zh: string;
  category_en: string;
}

interface TranslatedEvent {
  slug: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string | null;
  subtitle_en: string | null;
  badge_override: string | null;
}

interface CrawlOptions {
  horizonMonths: number;
  markets: readonly HotMarket[];
  categories: readonly EventCategory[];
  provider: EventCrawlerProvider;
}

interface CrawlCheckpoint {
  version: string;
  provider: EventCrawlerProvider;
  horizonMonths: number;
  completed: string[];
  updated_at: string;
}

interface BatchResult {
  key: string;
  events: CrawledEvent[];
  inserted: number;
  updated: number;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildDiscoveryPrompt({
  market,
  category,
  horizonMonths,
  now = new Date(),
}: {
  market: HotMarket;
  category: EventCategory;
  horizonMonths: number;
  now?: Date;
}): string {
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + horizonMonths);

  return `You are a travel-events researcher for an eSIM storefront. Today is ${fmtDate(now)}.

Research ${category.label_en} in ${market.country_en} for travel demand between ${fmtDate(now)} and ${fmtDate(horizon)}.

Return only a JSON object { "events": Event[] } where each Event is one travel-worthy event or season for this market and category.

Requirements:
- 2-6 events for this exact market/category. Prioritise famous, photo-worthy, ticket-moving, or seasonal events that travelers would plan a trip around. Skip obscure neighborhood events.
- Category focus: ${category.search_focus}.
- region_slug MUST be "${market.region_slug}".
- country_code should be one of ${market.country_codes.join(", ")} when known.
- event_type MUST be one of ${category.event_types.join(" | ")}.
- slug: kebab-case, stable across re-runs, preferably prefixed by market (e.g. "jp-sakura", "kyoto-gion-matsuri", "uk-glastonbury-2026").
- canonical_name and summary should be factual archive fields, not marketing copy.
- Dates:
  - If the event has confirmed exact dates this cycle, set start_date / end_date (YYYY-MM-DD).
  - If it is a recurring annual season (e.g. sakura in March-April), set recurring_month_start (1-12) / recurring_month_end (1-12) and leave start_date / end_date null.
- suggested_days: typical trip length for a visitor coming for THIS event (1-30). null if unsure.
- suggested_gb: typical data need in GB for the trip (1-30). null if unsure.
- tint ∈ ${TINTS.join(" | ")} — pick a hue that matches the event mood (spring sakura → "spring", winter NYE → "cool", carnival → "warm").
- badge_hint: short neutral date hint like "March-April", "late December", "summer"; null if unsure.
- source_url: official event page first; otherwise best-known Wikipedia or tourism-board source. Use null when unsure.

Be honest about uncertainty — null any field you don't know.`;
}

export function buildTranslationPrompt(events: readonly DiscoveredEvent[]): string {
  return `Translate archived travel-event facts for a Taiwanese eSIM storefront.

Return a JSON object { "events": Event[] } with one translated row per input slug.

Tone:
- Short, direct, and useful for travelers.
- zh-TW MUST use Traditional Chinese and Taiwan vocabulary. Reject simplified Chinese.
- Do not invent dates or facts beyond the archive.
- subtitle should explain why a traveler would care in one compact phrase.
- badge_override should be a zh-TW date label like "3-4月", "12月底", "夏季", or null when the date fields already make it obvious.

Input:
${JSON.stringify(
  events.map((event) => ({
    slug: event.slug,
    canonical_name: event.canonical_name,
    summary: event.summary,
    city: event.city,
    market_zh: event.market_zh,
    market_en: event.market_en,
    category_zh: event.category_zh,
    category_en: event.category_en,
    event_type: event.event_type,
    start_date: event.start_date,
    end_date: event.end_date,
    recurring_month_start: event.recurring_month_start,
    recurring_month_end: event.recurring_month_end,
    badge_hint: event.badge_hint,
    source_url: event.source_url,
  })),
  null,
  2,
)}`;
}

const DISCOVERY_RESPONSE_SCHEMA = {
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
          canonical_name: { type: "string" },
          city: { type: ["string", "null"] },
          country_code: { type: ["string", "null"] },
          summary: { type: ["string", "null"] },
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
          badge_hint: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "slug",
          "canonical_name",
          "city",
          "country_code",
          "summary",
          "event_type",
          "region_slug",
          "suggested_days",
          "suggested_gb",
          "start_date",
          "end_date",
          "recurring_month_start",
          "recurring_month_end",
          "tint",
          "badge_hint",
          "source_url",
        ],
      },
    },
  },
  required: ["events"],
} as const;

const TRANSLATION_RESPONSE_SCHEMA = {
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
          badge_override: { type: ["string", "null"] },
        },
        required: [
          "slug",
          "title_zh",
          "title_en",
          "subtitle_zh",
          "subtitle_en",
          "badge_override",
        ],
      },
    },
  },
  required: ["events"],
} as const;

async function discoverEvents({
  market,
  category,
  horizonMonths,
  provider,
}: {
  market: HotMarket;
  category: EventCategory;
  horizonMonths: number;
  provider: EventCrawlerProvider;
}): Promise<DiscoveredEvent[]> {
  const parsed = await callJson<{
    events: Array<Omit<
      DiscoveredEvent,
      | "market_id"
      | "market_zh"
      | "market_en"
      | "category_id"
      | "category_zh"
      | "category_en"
    >>;
  }>({
    provider,
    phase: "discovery",
    prompt: buildDiscoveryPrompt({ market, category, horizonMonths }),
    schema: DISCOVERY_RESPONSE_SCHEMA,
    useSearch: true,
  });
  return parsed.events
    .filter((event) => category.event_types.includes(event.event_type))
    .map((event) => ({
      ...event,
      slug: normalizeSlug(event.slug, market.id, event.canonical_name),
      region_slug: market.region_slug,
      country_code: event.country_code?.toUpperCase() ?? null,
      market_id: market.id,
      market_zh: market.country_zh,
      market_en: market.country_en,
      category_id: category.id,
      category_zh: category.label_zh,
      category_en: category.label_en,
    }));
}

async function translateEvents(
  events: readonly DiscoveredEvent[],
  provider: EventCrawlerProvider,
): Promise<TranslatedEvent[]> {
  const out: TranslatedEvent[] = [];
  for (const chunk of chunks(events, 30)) {
    const parsed = await callJson<{ events: TranslatedEvent[] }>({
      provider,
      phase: "translation",
      prompt: buildTranslationPrompt(chunk),
      schema: TRANSLATION_RESPONSE_SCHEMA,
      useSearch: false,
    });
    out.push(...parsed.events);
  }
  return out;
}

async function callJson<T>({
  provider,
  phase,
  prompt,
  schema,
  useSearch,
}: {
  provider: EventCrawlerProvider;
  phase: "discovery" | "translation";
  prompt: string;
  schema: unknown;
  useSearch: boolean;
}): Promise<T> {
  if (provider === "gemini") {
    return callGeminiJson<T>({ phase, prompt, schema, useSearch });
  }
  return callOpenAIJson<T>({ phase, prompt, schema, useSearch });
}

async function callOpenAIJson<T>({
  phase,
  prompt,
  schema,
  useSearch,
}: {
  phase: "discovery" | "translation";
  prompt: string;
  schema: unknown;
  useSearch: boolean;
}): Promise<T> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = phase === "discovery" ? env.OPENAI_SEARCH_MODEL : env.OPENAI_MODEL;

  await paceRequests();
  const res = await fetchWithRetry("OpenAI", () => fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      ...(useSearch ? { web_search_options: { search_context_size: "medium" } } : {}),
      messages: [
        { role: "system", content: "Reply with strict JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: `event_${phase}_response`,
          strict: true,
          schema,
        },
      },
    }),
  }));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseJsonContent<T>(
    json.choices?.[0]?.message?.content ?? "",
    `OpenAI ${phase}`,
  );
}

async function callGeminiJson<T>({
  phase,
  prompt,
  schema,
  useSearch,
}: {
  phase: "discovery" | "translation";
  prompt: string;
  schema: unknown;
  useSearch: boolean;
}): Promise<T> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const model = phase === "discovery" ? env.GEMINI_SEARCH_MODEL : env.GEMINI_MODEL;
  const body = buildGeminiRequestBody({
    prompt,
    schema,
    useSearch,
    structuredOutput: !useSearch,
  });

  await paceRequests();
  const res = await fetchWithRetry("Gemini", () =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        normalizeGeminiModel(model),
      )}:generateContent`,
      {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      },
    ),
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  const content =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";
  return parseJsonContent<T>(content, `Gemini ${phase}`);
}

export function buildGeminiRequestBody({
  prompt,
  schema,
  useSearch,
  structuredOutput = true,
}: {
  prompt: string;
  schema: unknown;
  useSearch: boolean;
  structuredOutput?: boolean;
}): Record<string, unknown> {
  const jsonSchema = toGeminiSchema(schema);

  return {
    systemInstruction: {
      parts: [{ text: "Reply with strict JSON only." }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    ...(structuredOutput
      ? {
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        }
      : {
          generationConfig: {
            temperature: 0.2,
          },
        }),
  };
}

export function dedupeDiscoveredEvents(
  events: readonly DiscoveredEvent[],
): DiscoveredEvent[] {
  const bySlug = new Map<string, DiscoveredEvent>();
  const canonicalToSlug = new Map<string, string>();

  for (const event of events) {
    const slug = normalizeSlug(event.slug, event.market_id, event.canonical_name);
    const next = { ...event, slug };
    const key = dedupeKey(next);
    const existingSlug = canonicalToSlug.get(key);
    const existing = existingSlug ? bySlug.get(existingSlug) : bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, next);
      canonicalToSlug.set(key, slug);
      continue;
    }
    const winner = scoreEvent(next) > scoreEvent(existing) ? next : existing;
    bySlug.delete(existing.slug);
    bySlug.set(winner.slug, winner);
    canonicalToSlug.set(key, winner.slug);
  }

  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function combineEvents({
  discovered,
  translations,
  provider,
}: {
  discovered: readonly DiscoveredEvent[];
  translations: readonly TranslatedEvent[];
  provider: EventCrawlerProvider;
}): CrawledEvent[] {
  const translationsBySlug = new Map(
    translations.map((event) => [event.slug, event]),
  );

  return discovered.map((event) => {
    const translation = translationsBySlug.get(event.slug);
    return {
      slug: event.slug,
      title_zh: translation?.title_zh ?? event.canonical_name,
      title_en: translation?.title_en ?? event.canonical_name,
      subtitle_zh: translation?.subtitle_zh ?? event.summary,
      subtitle_en: translation?.subtitle_en ?? event.summary,
      event_type: event.event_type,
      region_slug: event.region_slug,
      suggested_days: event.suggested_days,
      suggested_gb: event.suggested_gb,
      start_date: event.start_date,
      end_date: event.end_date,
      recurring_month_start: event.recurring_month_start,
      recurring_month_end: event.recurring_month_end,
      tint: event.tint,
      badge_override: translation?.badge_override ?? null,
      source_url: event.source_url,
      source: provider,
      raw_payload: {
        crawl_version: CRAWL_VERSION,
        llm_provider: provider,
        market: {
          id: event.market_id,
          zh: event.market_zh,
          en: event.market_en,
          country_code: event.country_code,
          region_slug: event.region_slug,
        },
        category: {
          id: event.category_id,
          zh: event.category_zh,
          en: event.category_en,
        },
        canonical: {
          name: event.canonical_name,
          city: event.city,
          summary: event.summary,
          badge_hint: event.badge_hint,
          source_url: event.source_url,
        },
        translation: translation ?? null,
      },
    };
  });
}

async function crawlEvents(options: CrawlOptions): Promise<CrawledEvent[]> {
  const discovered: DiscoveredEvent[] = [];

  for (const market of options.markets) {
    for (const category of options.categories) {
      console.log(
        `[crawl-events] ${market.id}/${category.id} searching with ${providerModel(
          options.provider,
          "discovery",
        )}`,
      );
      discovered.push(
        ...(await discoverEvents({
          market,
          category,
          horizonMonths: options.horizonMonths,
          provider: options.provider,
        })),
      );
    }
  }

  const deduped = dedupeDiscoveredEvents(discovered);
  console.log(
    `[crawl-events] discovered=${discovered.length} deduped=${deduped.length} translating with ${providerModel(
      options.provider,
      "translation",
    )}`,
  );
  return combineEvents({
    discovered: deduped,
    translations: await translateEvents(deduped, options.provider),
    provider: options.provider,
  });
}

async function crawlBatch({
  market,
  category,
  horizonMonths,
  provider,
}: {
  market: HotMarket;
  category: EventCategory;
  horizonMonths: number;
  provider: EventCrawlerProvider;
}): Promise<CrawledEvent[]> {
  console.log(
    `[crawl-events] ${market.id}/${category.id} searching with ${providerModel(
      provider,
      "discovery",
    )}`,
  );
  const discovered = dedupeDiscoveredEvents(
    await discoverEvents({
      market,
      category,
      horizonMonths,
      provider,
    }),
  );
  console.log(
    `[crawl-events] ${market.id}/${category.id} discovered=${discovered.length} translating with ${providerModel(
      provider,
      "translation",
    )}`,
  );
  return combineEvents({
    discovered,
    translations: await translateEvents(discovered, provider),
    provider,
  });
}

async function runBatchedCrawl({
  horizonMonths,
  markets,
  categories,
  provider,
  dryRun,
  checkpointFile,
  resetCheckpoint,
  noCheckpoint,
  limitBatches,
}: {
  horizonMonths: number;
  markets: readonly HotMarket[];
  categories: readonly EventCategory[];
  provider: EventCrawlerProvider;
  dryRun: boolean;
  checkpointFile: string;
  resetCheckpoint: boolean;
  noCheckpoint: boolean;
  limitBatches: number | null;
}): Promise<BatchResult[]> {
  if (resetCheckpoint) await resetCheckpointFile(checkpointFile);
  const checkpoint =
    dryRun || noCheckpoint
      ? newCheckpoint({ provider, horizonMonths })
      : await loadCheckpoint({ checkpointFile, provider, horizonMonths });
  const completed = new Set(checkpoint.completed);
  const db = dryRun ? null : getDb();
  const results: BatchResult[] = [];

  let attempted = 0;
  for (const market of markets) {
    for (const category of categories) {
      const key = batchKey(market, category);
      if (completed.has(key)) {
        console.log(`[crawl-events] ${key} skipped (checkpoint)`);
        continue;
      }
      if (limitBatches != null && attempted >= limitBatches) {
        console.log(`[crawl-events] limit reached (${limitBatches} batch(es))`);
        return results;
      }
      attempted += 1;

      const events = await crawlBatch({
        market,
        category,
        horizonMonths,
        provider,
      });
      let inserted = 0;
      let updated = 0;

      if (dryRun) {
        for (const event of events.slice(0, 4)) {
          console.log(
            `  ${event.region_slug.padEnd(28)} ${event.event_type.padEnd(10)} ${event.slug.padEnd(28)} ${event.title_zh}`,
          );
        }
        console.log(`  ...and ${Math.max(0, events.length - 4)} more`);
      } else {
        const stats = await upsertEvents({
          db: db!,
          events,
          now: new Date(),
        });
        inserted = stats.inserted;
        updated = stats.updated;
        completed.add(key);
        if (!noCheckpoint) {
          await saveCheckpoint({
            checkpointFile,
            checkpoint: {
              ...checkpoint,
              completed: [...completed].sort(),
              updated_at: new Date().toISOString(),
            },
          });
        }
      }

      results.push({ key, events, inserted, updated });
      console.log(
        `[crawl-events] ${key} done: events=${events.length} inserted=${inserted} updated=${updated}`,
      );
    }
  }
  return results;
}

export function parseArgs(argv: readonly string[]): {
  dryRun: boolean;
  horizon: number;
  markets: readonly HotMarket[];
  categories: readonly EventCategory[];
  provider: EventCrawlerProvider;
  checkpointFile: string;
  resetCheckpoint: boolean;
  noCheckpoint: boolean;
  limitBatches: number | null;
} {
  const dryRun = argv.includes("--dry-run");
  const horizonArg = argv.find((a) => a.startsWith("--horizon-months="));
  const horizon = horizonArg ? Number(horizonArg.split("=")[1]) : 6;
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 18) {
    throw new Error("--horizon-months must be a number from 1 to 18");
  }

  const marketFilter = parseCsvFlag(argv, "--market=");
  const categoryFilter = parseCsvFlag(argv, "--category=");
  const limitArg = argv.find((a) => a.startsWith("--limit-batches="));
  const limitBatches = limitArg ? Number(limitArg.split("=")[1]) : null;
  if (
    limitBatches != null &&
    (!Number.isInteger(limitBatches) || limitBatches < 1)
  ) {
    throw new Error("--limit-batches must be a positive integer");
  }
  const markets = filterById(HOT_MARKETS, marketFilter, "market");
  const categories = filterById(EVENT_CATEGORIES, categoryFilter, "category");
  return {
    dryRun,
    horizon,
    markets,
    categories,
    provider: resolveProvider(argv),
    checkpointFile: resolve(
      parseStringFlag(argv, "--checkpoint-file=") ?? DEFAULT_CHECKPOINT_FILE,
    ),
    resetCheckpoint: argv.includes("--reset-checkpoint"),
    noCheckpoint: argv.includes("--no-checkpoint"),
    limitBatches,
  };
}

async function main() {
  const {
    dryRun,
    horizon,
    markets,
    categories,
    provider,
    checkpointFile,
    resetCheckpoint,
    noCheckpoint,
    limitBatches,
  } = parseArgs(
    process.argv.slice(2),
  );

  console.log(
    `[crawl-events] horizon=${horizon}mo markets=${markets.length} categories=${categories.length} provider=${provider} dry-run=${dryRun} checkpoint=${dryRun || noCheckpoint ? "off" : checkpointFile}`,
  );
  const results = await runBatchedCrawl({
    horizonMonths: horizon,
    markets,
    categories,
    provider,
    dryRun,
    checkpointFile,
    resetCheckpoint,
    noCheckpoint,
    limitBatches,
  });
  const eventCount = results.reduce((sum, result) => sum + result.events.length, 0);
  const inserted = results.reduce((sum, result) => sum + result.inserted, 0);
  const updated = results.reduce((sum, result) => sum + result.updated, 0);
  console.log(
    `[crawl-events] done: batches=${results.length} events=${eventCount} inserted=${inserted} updated=${updated}`,
  );
}

async function upsertEvents({
  db,
  events,
  now,
}: {
  db: Db;
  events: readonly CrawledEvent[];
  now: Date;
}): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

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
      source: e.source,
      sourceUrl: e.source_url,
      lastSeenAt: now,
      rawPayload: e.raw_payload,
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

  return { inserted, updated };
}

function parseCsvFlag(argv: readonly string[], prefix: string): Set<string> | null {
  const arg = argv.find((a) => a.startsWith(prefix));
  if (!arg) return null;
  const values = arg
    .slice(prefix.length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? new Set(values) : null;
}

function parseStringFlag(argv: readonly string[], prefix: string): string | null {
  const arg = argv.find((a) => a.startsWith(prefix));
  const value = arg?.slice(prefix.length).trim();
  return value ? value : null;
}

function resolveProvider(argv: readonly string[]): EventCrawlerProvider {
  const providerArg = argv.find((a) => a.startsWith("--provider="));
  const requested =
    providerArg?.slice("--provider=".length) ?? env.EVENT_CRAWLER_PROVIDER;
  if (requested) {
    if (requested !== "gemini" && requested !== "openai") {
      throw new Error("--provider must be gemini or openai");
    }
    return requested;
  }
  return env.GEMINI_API_KEY ? "gemini" : "openai";
}

function providerModel(
  provider: EventCrawlerProvider,
  phase: "discovery" | "translation",
): string {
  if (provider === "gemini") {
    return phase === "discovery" ? env.GEMINI_SEARCH_MODEL : env.GEMINI_MODEL;
  }
  return phase === "discovery" ? env.OPENAI_SEARCH_MODEL : env.OPENAI_MODEL;
}

function batchKey(market: HotMarket, category: EventCategory): string {
  return `${market.id}/${category.id}`;
}

function newCheckpoint({
  provider,
  horizonMonths,
}: {
  provider: EventCrawlerProvider;
  horizonMonths: number;
}): CrawlCheckpoint {
  return {
    version: CRAWL_VERSION,
    provider,
    horizonMonths,
    completed: [],
    updated_at: new Date().toISOString(),
  };
}

async function loadCheckpoint({
  checkpointFile,
  provider,
  horizonMonths,
}: {
  checkpointFile: string;
  provider: EventCrawlerProvider;
  horizonMonths: number;
}): Promise<CrawlCheckpoint> {
  try {
    const parsed = JSON.parse(
      await readFile(checkpointFile, "utf8"),
    ) as Partial<CrawlCheckpoint>;
    if (
      parsed.version !== CRAWL_VERSION ||
      parsed.provider !== provider ||
      parsed.horizonMonths !== horizonMonths ||
      !Array.isArray(parsed.completed)
    ) {
      return newCheckpoint({ provider, horizonMonths });
    }
    return {
      version: CRAWL_VERSION,
      provider,
      horizonMonths,
      completed: parsed.completed.filter(
        (value): value is string => typeof value === "string",
      ),
      updated_at:
        typeof parsed.updated_at === "string"
          ? parsed.updated_at
          : new Date().toISOString(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return newCheckpoint({ provider, horizonMonths });
    }
    throw err;
  }
}

async function saveCheckpoint({
  checkpointFile,
  checkpoint,
}: {
  checkpointFile: string;
  checkpoint: CrawlCheckpoint;
}): Promise<void> {
  await mkdir(dirname(checkpointFile), { recursive: true });
  await writeFile(
    checkpointFile,
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    "utf8",
  );
}

async function resetCheckpointFile(checkpointFile: string): Promise<void> {
  await rm(checkpointFile, { force: true });
}

function filterById<T extends { id: string }>(
  items: readonly T[],
  selected: Set<string> | null,
  label: string,
): readonly T[] {
  if (!selected) return items;
  const out = items.filter((item) => selected.has(item.id));
  const known = new Set(items.map((item) => item.id));
  const unknown = [...selected].filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown ${label}: ${unknown.join(", ")}. Known values: ${[...known].join(", ")}`,
    );
  }
  return out;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function fetchWithRetry(
  provider: "Gemini" | "OpenAI",
  run: () => Promise<Response>,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await run();
    if (!isRetryableStatus(res.status)) return res;

    const text = await res.text().catch(() => "");
    if (attempt >= env.EVENT_CRAWLER_MAX_RETRIES) {
      throw new Error(`${provider} ${res.status}: ${text.slice(0, 300)}`);
    }

    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const backoffMs =
      retryAfterMs ?? Math.min(60_000 * 2 ** attempt, 8 * 60_000);
    console.warn(
      `[crawl-events] ${provider} ${res.status}; retry ${attempt + 1}/${env.EVENT_CRAWLER_MAX_RETRIES} in ${Math.round(
        backoffMs / 1000,
      )}s`,
    );
    await sleep(backoffMs);
    attempt += 1;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

async function paceRequests(): Promise<void> {
  const delayMs = env.EVENT_CRAWLER_REQUEST_DELAY_MS;
  if (delayMs <= 0) return;
  const elapsed = Date.now() - lastRequestAt;
  const waitMs = delayMs - elapsed;
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonContent<T>(content: string, label: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = /\{[\s\S]*\}/.exec(content);
    if (!match) {
      throw new Error(`${label} returned non-JSON content: ${content.slice(0, 200)}`);
    }
    try {
      return JSON.parse(match[0]) as T;
    } catch (err) {
      throw new Error(
        `${label} returned invalid JSON: ${(err as Error).message}; ${content.slice(0, 200)}`,
      );
    }
  }
}

function normalizeGeminiModel(model: string): string {
  return model.replace(/^models\//, "");
}

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== "object") return value;

  const input = value as Record<string, unknown>;
  if (Array.isArray(input.anyOf)) {
    const variants = input.anyOf as Array<Record<string, unknown>>;
    const nullVariant = variants.find((variant) => variant.type === "null");
    const typedVariant = variants.find((variant) => variant.type !== "null");
    if (nullVariant && typedVariant?.type) {
      const next = toGeminiSchema(typedVariant) as Record<string, unknown>;
      return { ...next, type: [typedVariant.type, "null"] };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    out[key] = toGeminiSchema(nested);
  }
  return out;
}

function normalizeSlug(slug: string, marketId: string, fallback: string): string {
  const base = slugify(slug) || slugify(fallback) || "event";
  return base.startsWith(`${marketId}-`) ? base : `${marketId}-${base}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function dedupeKey(event: DiscoveredEvent): string {
  const source = normalizeSourceUrl(event.source_url);
  if (source) return `source:${source}`;
  return [
    event.region_slug,
    event.country_code ?? "",
    slugify(event.canonical_name),
    event.start_date ?? "",
    event.end_date ?? "",
    event.recurring_month_start ?? "",
    event.recurring_month_end ?? "",
  ].join(":");
}

function normalizeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function scoreEvent(event: DiscoveredEvent): number {
  return (
    (event.source_url ? 3 : 0) +
    (event.start_date && event.end_date ? 2 : 0) +
    (event.summary ? 1 : 0)
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("[crawl-events] FAILED:", err);
    process.exit(1);
  });
}
