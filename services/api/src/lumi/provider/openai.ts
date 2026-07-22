export type OpenAIChatToolCall = {
  id?: string | null;
  type?: string;
  function?: { name?: string; arguments?: string };
};

export type OpenAIChatMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: OpenAIChatToolCall[];
    }
  | { role: "tool"; content: string; tool_call_id: string };

export type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    strict: true;
    parameters: unknown;
  };
};

export type OpenAITransportProgress =
  | { event: "status"; status: "analyzing" | "finalizing"; label: string; iteration: number }
  | { event: "tool_call"; tool_name: string; label: string; iteration: number };

const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;

export async function requestOpenAiChatCompletion({
  apiKey,
  model,
  messages,
  tools,
  forceFinal,
  forcedToolName,
  iteration,
  onProgress,
  labelForToolName,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  apiKey: string;
  model: string;
  messages: OpenAIChatMessage[];
  tools: OpenAIToolDefinition[];
  forceFinal: boolean;
  forcedToolName?: string | null;
  iteration: number;
  onProgress?: (event: OpenAITransportProgress) => void | Promise<void>;
  labelForToolName?: (name: string) => string;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  const refreshTimeout = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(
      () => controller.abort(),
      timeoutMs,
    );
  };
  refreshTimeout();
  let res: Response;
  try {
    await onProgress?.({
      event: "status",
      status: forceFinal ? "finalizing" : "analyzing",
      label: forceFinal ? "Finalizing Lumi response" : "Analyzing itinerary",
      iteration,
    });
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        /* Reasoning models (gpt-5*, o*) reject explicit temperature. */
        ...(/^(gpt-5|o\d)/i.test(model) ? {} : { temperature: 0.2 }),
        tools,
        tool_choice: forcedToolName
          ? {
              type: "function",
              function: { name: forcedToolName },
            }
          : forceFinal
          ? {
              type: "function",
              function: { name: "lumi_response" },
            }
          : "auto",
        stream: true,
        messages,
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("OpenAI request timed out");
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const json = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: OpenAIChatToolCall[];
        };
      }[];
    };
    return json.choices?.[0]?.message ?? null;
  }

  if (!res.body) {
    throw new Error("OpenAI returned an empty stream");
  }

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  const content: string[] = [];
  const toolCalls = new Map<number, OpenAIChatToolCall>();
  const announcedToolCalls = new Set<number>();
  let buffer = "";

  const appendToolCallDelta = async (delta: {
    index?: number;
    id?: string | null;
    type?: string;
    function?: { name?: string; arguments?: string };
  }) => {
    const index = delta.index ?? 0;
    const existing = toolCalls.get(index) ?? {
      id: null,
      type: "function",
      function: { name: "", arguments: "" },
    };
    existing.id = existing.id ?? delta.id ?? null;
    existing.type = existing.type ?? delta.type ?? "function";
    existing.function = {
      name:
        (existing.function?.name ?? "") +
        (delta.function?.name ?? ""),
      arguments:
        (existing.function?.arguments ?? "") +
        (delta.function?.arguments ?? ""),
    };
    toolCalls.set(index, existing);

    const name = existing.function.name;
    if (name && !announcedToolCalls.has(index)) {
      announcedToolCalls.add(index);
      await onProgress?.({
        event: "tool_call",
        tool_name: name,
        label: labelForToolName?.(name) ?? name,
        iteration,
      });
    }
  };

  const handleDataLine = async (line: string) => {
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") return;
    let json: {
      choices?: {
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string | null;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }[];
    };
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const delta = json.choices?.[0]?.delta;
    if (!delta) return;
    if (delta.content) content.push(delta.content);
    for (const toolCall of delta.tool_calls ?? []) {
      await appendToolCallDelta(toolCall);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      refreshTimeout();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data:")) {
          await handleDataLine(line);
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith("data:")) {
      await handleDataLine(buffer);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("OpenAI request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  return {
    content: content.join("") || null,
    tool_calls: Array.from(toolCalls.entries())
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call),
  };
}
