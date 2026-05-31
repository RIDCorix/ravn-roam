import { describe, expect, test } from "vitest";

import {
  buildDiscoveryPrompt,
  buildGeminiRequestBody,
  buildTranslationPrompt,
  dedupeDiscoveredEvents,
  EVENT_CATEGORIES,
  HOT_MARKETS,
  parseArgs,
} from "./crawl-shop-events.js";

const japan = HOT_MARKETS.find((market) => market.id === "japan")!;
const italy = HOT_MARKETS.find((market) => market.id === "italy")!;
const seasonal = EVENT_CATEGORIES.find(
  (category) => category.id === "seasonal",
)!;
const music = EVENT_CATEGORIES.find((category) => category.id === "music")!;

describe("buildDiscoveryPrompt", () => {
  test("scopes discovery to one market and one event category", () => {
    const prompt = buildDiscoveryPrompt({
      market: japan,
      category: seasonal,
      horizonMonths: 3,
      now: new Date("2026-05-30T00:00:00.000Z"),
    });

    expect(prompt).toContain("Japan");
    expect(prompt).toContain("seasonal plants");
    expect(prompt).toContain('region_slug MUST be "japan"');
    expect(prompt).toContain("between 2026-05-30 and 2026-08-30");
    expect(prompt).toContain("2-6 events");
  });

  test("supports country-level European intro markets", () => {
    const prompt = buildDiscoveryPrompt({
      market: italy,
      category: seasonal,
      horizonMonths: 3,
      now: new Date("2026-05-30T00:00:00.000Z"),
    });

    expect(prompt).toContain("Italy");
    expect(prompt).toContain('region_slug MUST be "italy"');
    expect(prompt).toContain("country_code should be one of IT");
  });
});

describe("buildTranslationPrompt", () => {
  test("keeps translation separate from canonical event discovery", () => {
    const prompt = buildTranslationPrompt([
      {
        slug: "japan-sakura",
        canonical_name: "Cherry blossom season",
        city: "Tokyo",
        country_code: "JP",
        summary: "Peak flower viewing season across Tokyo parks.",
        event_type: "seasonal",
        region_slug: "japan",
        suggested_days: 5,
        suggested_gb: 8,
        start_date: null,
        end_date: null,
        recurring_month_start: 3,
        recurring_month_end: 4,
        tint: "spring",
        badge_hint: "March-April",
        source_url: "https://example.com/sakura",
        market_id: "japan",
        market_zh: "日本",
        market_en: "Japan",
        category_id: "seasonal",
        category_zh: "季節（植物、作物）",
        category_en: "seasonal plants, harvests, and natural phenomena",
      },
    ]);

    expect(prompt).toContain("Translate archived travel-event facts");
    expect(prompt).toContain("zh-TW MUST use Traditional Chinese");
    expect(prompt).toContain("japan-sakura");
    expect(prompt).toContain("Cherry blossom season");
  });
});

describe("buildGeminiRequestBody", () => {
  test("uses Google Search grounding for discovery and JSON structured output", () => {
    const body = buildGeminiRequestBody({
      prompt: "Find seasonal events in Japan.",
      schema: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tint: {
                  anyOf: [
                    { type: "null" },
                    { type: "string", enum: ["spring", "cool"] },
                  ],
                },
              },
              required: ["tint"],
            },
          },
        },
        required: ["events"],
      },
      useSearch: true,
      structuredOutput: true,
    });

    expect(body).toMatchObject({
      tools: [{ googleSearch: {} }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    expect(
      body.generationConfig as {
        responseJsonSchema: { properties: { events: unknown } };
      },
    ).toBeTruthy();
    expect(JSON.stringify(body)).toContain('"type":["string","null"]');
  });

  test("omits JSON mime type when Google Search grounding is used without structured output", () => {
    const body = buildGeminiRequestBody({
      prompt: "Find seasonal events in Japan.",
      schema: { type: "object", properties: {}, required: [] },
      useSearch: true,
      structuredOutput: false,
    });

    expect(body).toMatchObject({
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.2 },
    });
    expect(JSON.stringify(body)).not.toContain("responseMimeType");
  });
});

describe("dedupeDiscoveredEvents", () => {
  test("dedupes same source URL and keeps the richer event", () => {
    const base = {
      slug: "sakura",
      canonical_name: "Cherry blossom season",
      city: "Tokyo",
      country_code: "JP",
      summary: null,
      event_type: "seasonal" as const,
      region_slug: "japan" as const,
      suggested_days: 5,
      suggested_gb: 8,
      start_date: null,
      end_date: null,
      recurring_month_start: 3,
      recurring_month_end: 4,
      tint: "spring" as const,
      badge_hint: "March-April",
      source_url: "https://example.com/sakura?utm=1",
      market_id: "japan",
      market_zh: "日本",
      market_en: "Japan",
      category_id: "seasonal",
      category_zh: "季節（植物、作物）",
      category_en: "seasonal plants, harvests, and natural phenomena",
    };

    const deduped = dedupeDiscoveredEvents([
      base,
      {
        ...base,
        slug: "jp-sakura-2026",
        summary: "Peak flower viewing season across Tokyo parks.",
        source_url: "https://example.com/sakura",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("japan-jp-sakura-2026");
    expect(deduped[0]?.summary).toContain("Peak flower");
  });
});

describe("parseArgs", () => {
  test("filters markets and categories for focused dry runs", () => {
    const parsed = parseArgs([
      "--dry-run",
      "--horizon-months=4",
      "--market=japan,korea",
      "--category=seasonal,music",
      "--limit-batches=2",
      "--checkpoint-file=.tmp/events.json",
    ]);

    expect(parsed.dryRun).toBe(true);
    expect(parsed.horizon).toBe(4);
    expect(parsed.markets.map((market) => market.id)).toEqual([
      "japan",
      "korea",
    ]);
    expect(parsed.categories.map((category) => category.id)).toEqual([
      seasonal.id,
      music.id,
    ]);
    expect(parsed.limitBatches).toBe(2);
    expect(parsed.checkpointFile).toContain(".tmp/events.json");
  });

  test("rejects unknown filters instead of silently running the full crawl", () => {
    expect(() => parseArgs(["--market=moon"])).toThrow("Unknown market");
    expect(() => parseArgs(["--category=weather"])).toThrow("Unknown category");
    expect(() => parseArgs(["--limit-batches=0"])).toThrow(
      "--limit-batches must be a positive integer",
    );
  });

  test("allows explicit provider selection", () => {
    expect(parseArgs(["--provider=gemini"]).provider).toBe("gemini");
    expect(parseArgs(["--provider=openai"]).provider).toBe("openai");
    expect(() => parseArgs(["--provider=anthropic"])).toThrow(
      "--provider must be gemini or openai",
    );
  });

  test("supports checkpoint controls for resumable crawls", () => {
    const parsed = parseArgs([
      "--provider=gemini",
      "--reset-checkpoint",
      "--no-checkpoint",
    ]);

    expect(parsed.resetCheckpoint).toBe(true);
    expect(parsed.noCheckpoint).toBe(true);
    expect(parsed.checkpointFile).toContain(
      ".cache/shop-events-crawler-checkpoint.json",
    );
  });
});
