// Extract Lumi card payloads from a streamed assistant message. The model
// is prompted to emit ```json``` fences alongside its natural-language reply
// (see apps/web/src/app/api/lumi/route.ts). We strip those fences from the
// rendered prose so the user sees clean text, and parse them into typed
// cards rendered separately below the bubble.

import type { LumiCard } from "./types";

const FENCE_RE = /```json\s*([\s\S]*?)```/g;

export interface ParsedMessage {
  prose: string;
  cards: LumiCard[];
}

export function parseAssistantMessage(raw: string): ParsedMessage {
  const cards: LumiCard[] = [];
  const prose = raw
    .replace(FENCE_RE, (_match, jsonText: string) => {
      const card = tryParseCard(jsonText);
      if (card) cards.push(card);
      return "";
    })
    .trim();
  return { prose, cards };
}

function tryParseCard(jsonText: string): LumiCard | null {
  try {
    const parsed = JSON.parse(jsonText.trim()) as Record<string, unknown>;
    if (parsed.type === "itinerary" && Array.isArray(parsed.days)) {
      const days = (parsed.days as Array<Record<string, unknown>>)
        .filter((d) => typeof d.city === "string" && typeof d.date === "string")
        .map((d) => ({
          date: String(d.date),
          city: String(d.city),
          sub: typeof d.sub === "string" ? d.sub : undefined,
        }));
      if (days.length > 0) return { type: "itinerary", days };
    }
    if (parsed.type === "esim_cta" && typeof parsed.country === "string") {
      return {
        type: "esim_cta",
        country: parsed.country,
        days: typeof parsed.days === "number" ? parsed.days : undefined,
        gb: typeof parsed.gb === "number" ? parsed.gb : undefined,
        label: typeof parsed.label === "string" ? parsed.label : undefined,
      };
    }
  } catch {
    // Streaming may surface partial JSON; ignore until the fence closes.
  }
  return null;
}
