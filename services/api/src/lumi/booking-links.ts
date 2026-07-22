import { env } from "../env.js";
import type { LumiDay } from "./openai.js";

const BOOKABLE_TYPES = new Set([
  "ticket",
  "reservation",
  "booking",
  "flight",
  "transit",
  "stay",
]);

interface SearchResponse {
  url?: string | null;
  confidence?: "high" | "medium" | "low";
  reason?: string;
}

export async function enrichAttachmentUrls({
  days,
}: {
  days: LumiDay[];
}): Promise<LumiDay[]> {
  if (!env.OPENAI_API_KEY) return validateExistingUrls(days);

  const next = cloneDays(days);
  let searched = 0;
  for (const day of next) {
    for (const stop of day.stops ?? []) {
      for (const attachment of stop.attachments ?? []) {
        const type = attachment.type ?? "ticket";
        if (!BOOKABLE_TYPES.has(type)) continue;

        if (attachment.url) {
          attachment.url = (await validateUrl(attachment.url))
            ? attachment.url
            : null;
          if (attachment.url) continue;
        }
        if (searched >= 4) continue;
        searched += 1;

        const resolved = await resolveOfficialUrl({
          stopName: stop.name,
          city: day.city,
          label: attachment.label,
          type,
        });
        if (resolved) attachment.url = resolved;
      }
    }
  }
  return next;
}

async function validateExistingUrls(days: LumiDay[]): Promise<LumiDay[]> {
  const next = cloneDays(days);
  for (const day of next) {
    for (const stop of day.stops ?? []) {
      for (const attachment of stop.attachments ?? []) {
        if (!attachment.url) continue;
        attachment.url = (await validateUrl(attachment.url))
          ? attachment.url
          : null;
      }
    }
  }
  return next;
}

async function resolveOfficialUrl(input: {
  stopName: string;
  city: string;
  label: string;
  type: string;
}): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_SEARCH_MODEL,
      web_search_options: { search_context_size: "low" },
      messages: [
        {
          role: "system",
          content:
            "Find the official booking, ticket, reservation, airline, train, museum, venue, or restaurant URL for a travel activity. Return only compact JSON: {\"url\": string|null, \"confidence\":\"high\"|\"medium\"|\"low\", \"reason\": string}. Prefer official domains over aggregators. Use null when unsure.",
        },
        {
          role: "user",
          content: `${input.stopName} ${input.city} official ${input.type} ${input.label} booking tickets`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[] }
    | null;
  const parsed = parseSearchJson(json?.choices?.[0]?.message?.content ?? "");
  const url = normalizeUrl(parsed?.url);
  if (!url || parsed?.confidence === "low") return null;
  return (await validateUrl(url)) ? url : null;
}

function parseSearchJson(content: string): SearchResponse | null {
  try {
    return JSON.parse(content) as SearchResponse;
  } catch {
    const match = /\{[\s\S]*\}/.exec(content);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as SearchResponse;
    } catch {
      return null;
    }
  }
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    if (await requestUrl(url, "HEAD")) return true;
    return requestUrl(url, "GET");
  } catch {
    return false;
  }
}

async function requestUrl(url: string, method: "GET" | "HEAD"): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "RoamApp/0.1 link-verifier" },
    });
    return res.status >= 200 && res.status < 400;
  } finally {
    clearTimeout(timeout);
  }
}

function cloneDays(days: LumiDay[]): LumiDay[] {
  return days.map((day) => ({
    ...day,
    stops: (day.stops ?? []).map((stop) => ({
      ...stop,
      attachments: (stop.attachments ?? []).map((attachment) => ({
        ...attachment,
      })),
    })),
  }));
}
