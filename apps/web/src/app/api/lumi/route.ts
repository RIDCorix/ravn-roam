// Streaming chat endpoint for the Lumi trip-assistant.
//
// Wraps the OpenAI Chat Completions API with a system prompt that nudges the
// model to emit itinerary cards and eSIM CTAs as inline ```json``` fences so
// the client can parse them without function calling. Token cost is kept low
// by capping max_tokens at 600 and keeping the system prompt under ~500
// tokens.
//
// Model is chosen via OPENAI_MODEL env (default: gpt-4o-mini — the cheapest
// chat-capable OpenAI model at the time of writing). Override in env if a
// cheaper equivalent ships.

import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 600;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface TripContext {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  status?: string;
  days?: Array<{ d: string; city: string; note?: string }>;
}

interface LumiRequest {
  messages: IncomingMessage[];
  trips?: TripContext[];
  currentTripId?: string;
  lang?: string;
}

const SYSTEM_PROMPT = `You are Lumi, a friendly travel assistant inside the Roam eSIM app. You are summoned from a floating launcher that follows the user across every screen. You know about all of the user's planned trips and can answer cross-trip questions.

Style:
- Keep replies short and concrete (max 3 short paragraphs).
- Match the user's tone — casual, warm, no marketing fluff.
- Reply language is dictated by the separate RESPONSE LANGUAGE system message — never override it based on what language the user typed in.

Capabilities:
- Answer questions about the user's existing trips (next trip, total trips, dates).
- Suggest itineraries when the user describes destinations + dates.
- Recommend an eSIM plan when the trip crosses borders or the user asks about connectivity.

When you propose a multi-day itinerary, append a fenced JSON block:
\`\`\`json
{"type":"itinerary","days":[{"date":"10/05","city":"Paris","sub":"CDG arrival"},{"date":"10/06","city":"Paris","sub":""}]}
\`\`\`

When you recommend an eSIM plan, append a fenced JSON block:
\`\`\`json
{"type":"esim_cta","country":"EU+UK","days":14,"gb":15,"label":"See eSIM plans"}
\`\`\`

Country codes: JP, KR, TH, US, SG, MY, VN, ID, PH, HK, CN, GB, FR, DE, EU, EU+UK, AU, NZ, IN, AE, GLOB. Use EU+UK if the trip mixes Schengen and UK.

Only emit JSON when it adds value — never duplicate the same card twice in a row. The natural-language reply still goes before the JSON. Keep JSON minimal and on a single line.`;

function localeDirective(lang: string | undefined): string {
  if (lang === "zh-TW") {
    return "RESPONSE LANGUAGE: Reply ONLY in Traditional Chinese (繁體中文 / zh-TW). Use Taiwan-style vocabulary and phrasing. Never use Simplified Chinese (简体) characters. This overrides the language of the user's message — even if the user writes in English or 简体, you reply in 繁體中文.";
  }
  if (lang === "en") {
    return "RESPONSE LANGUAGE: Reply ONLY in English. This overrides the language of the user's message — even if the user writes in Chinese, you reply in English.";
  }
  return "RESPONSE LANGUAGE: Reply ONLY in English (default).";
}

function buildTripsContext(
  trips: TripContext[] | undefined,
  currentTripId: string | undefined,
): string | null {
  if (!trips || trips.length === 0) return null;

  const lines: string[] = ["User's trips:"];
  for (const trip of trips) {
    const isCurrent = trip.id && trip.id === currentTripId;
    const dates =
      trip.start && trip.end ? ` (${trip.start} → ${trip.end})` : "";
    const status = trip.status ? ` [${trip.status}]` : "";
    const marker = isCurrent ? " ← user is viewing this trip now" : "";
    lines.push(`- ${trip.title ?? trip.id ?? "(unnamed)"}${dates}${status}${marker}`);

    if (isCurrent && trip.days && trip.days.length > 0) {
      const summary = trip.days
        .slice(0, 14)
        .map((d) => `${d.d} ${d.city}${d.note ? ` (${d.note})` : ""}`)
        .join("; ");
      lines.push(`  Planned days: ${summary}`);
    }
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  let body: LumiRequest;
  try {
    body = (await req.json()) as LumiRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const tripsContext = buildTripsContext(body.trips, body.currentTripId);
  const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: localeDirective(body.lang),
    },
  ];
  if (tripsContext) {
    systemMessages.push({ role: "system", content: tripsContext });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          stream: true,
          max_tokens: MAX_TOKENS,
          messages: [
            ...systemMessages,
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "OpenAI error";
        controller.enqueue(encoder.encode(`\n[error: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
