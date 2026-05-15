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
  days?: Array<{ d: string; city: string; note?: string }>;
}

interface LumiRequest {
  messages: IncomingMessage[];
  trip?: TripContext;
  lang?: string;
}

const SYSTEM_PROMPT = `You are Lumi, a friendly travel assistant inside the Roam eSIM app. You help users plan trips and recommend eSIM data plans for the countries they visit.

Style:
- Keep replies short and concrete (max 3 short paragraphs).
- Reply in the user's language (zh-TW or English) based on their last message.
- Match the user's tone — casual, warm, no marketing fluff.

Capabilities:
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

function buildTripContext(trip: TripContext | undefined): string | null {
  if (!trip) return null;
  const lines: string[] = [];
  if (trip.title) lines.push(`Trip: ${trip.title}`);
  if (trip.start && trip.end) lines.push(`Dates: ${trip.start} → ${trip.end}`);
  if (trip.days && trip.days.length > 0) {
    const summary = trip.days
      .slice(0, 14)
      .map((d) => `${d.d} ${d.city}${d.note ? ` (${d.note})` : ""}`)
      .join("; ");
    lines.push(`Planned days: ${summary}`);
  }
  return lines.length > 0 ? `Current trip context:\n${lines.join("\n")}` : null;
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

  const tripContext = buildTripContext(body.trip);
  const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  if (tripContext) {
    systemMessages.push({ role: "system", content: tripContext });
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
