import type {
  OpenAIChatMessage,
  OpenAIChatToolCall,
  OpenAIToolDefinition,
} from "./openai.js";

export type ToolLoopDecision<T> =
  | { status: "accept"; value: T }
  | {
      status: "retry";
      correction: OpenAIChatMessage;
      forcedToolName?: string | null;
    };

export interface ToolLoopResult<T> {
  value: T;
  finalToolCall: OpenAIChatToolCall | null;
}

export const MAX_LUMI_TOOL_ITERATIONS = 6;

interface ToolLoopInput<T, TToolResult> {
  messages: OpenAIChatMessage[];
  tools: OpenAIToolDefinition[];
  maxIterations?: number;
  finalToolName: string;
  requestCompletion: (input: {
    messages: OpenAIChatMessage[];
    tools: OpenAIToolDefinition[];
    forceFinal: boolean;
    forcedToolName?: string | null;
    iteration: number;
  }) => Promise<{
    content?: string | null;
    tool_calls?: OpenAIChatToolCall[];
  } | null>;
  dispatchTool: (
    toolCall: OpenAIChatToolCall,
    iteration: number,
  ) => Promise<TToolResult>;
  onToolResult?: (
    toolCall: OpenAIChatToolCall,
    result: TToolResult,
    iteration: number,
  ) => void | Promise<void>;
  validateFinal: (
    rawArguments: string,
    context: { iteration: number; isLastIteration: boolean },
  ) => ToolLoopDecision<T>;
  validatePlainText: (
    content: string,
    context: { iteration: number; isLastIteration: boolean },
  ) => ToolLoopDecision<T>;
  finalError: () => Error;
}

/**
 * Provider-neutral bounded tool orchestration. Domain authorization and
 * validation are supplied by the compatibility layer; this loop owns retry
 * bookkeeping and guarantees every dispatched action gets a tool result.
 */
export async function runOpenAiToolLoop<T, TToolResult>(
  input: ToolLoopInput<T, TToolResult>,
): Promise<ToolLoopResult<T>> {
  const maxIterations =
    input.maxIterations ?? MAX_LUMI_TOOL_ITERATIONS;
  let forcedToolName: string | null = null;

  for (let index = 0; index < maxIterations; index += 1) {
    const iteration = index + 1;
    const isLastIteration = iteration === maxIterations;
    const availableForcedTool =
      forcedToolName &&
      input.tools.some((tool) => tool.function.name === forcedToolName)
        ? forcedToolName
        : null;
    forcedToolName = null;

    const message = await input.requestCompletion({
      messages: input.messages,
      tools: input.tools,
      forceFinal: !availableForcedTool && isLastIteration,
      forcedToolName: availableForcedTool,
      iteration,
    });
    const toolCalls = message?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      const content = message?.content?.trim();
      if (!content) throw new Error("OpenAI returned no Lumi tool call");
      const decision = input.validatePlainText(content, {
        iteration,
        isLastIteration,
      });
      if (decision.status === "accept") {
        return { value: decision.value, finalToolCall: null };
      }
      input.messages.push({ role: "assistant", content });
      input.messages.push(decision.correction);
      forcedToolName = decision.forcedToolName ?? null;
      continue;
    }

    const assistantMessageIndex = input.messages.length;
    input.messages.push({
      role: "assistant",
      content: message?.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls.filter(
      (candidate) => candidate.function?.name !== input.finalToolName,
    )) {
      const result = await input.dispatchTool(call, iteration);
      await input.onToolResult?.(call, result, iteration);
      input.messages.push({
        role: "tool",
        tool_call_id: call.id ?? `tool_${index}`,
        content: JSON.stringify(result),
      });
    }

    const finalToolCall = toolCalls.find(
      (call) => call.function?.name === input.finalToolName,
    );
    if (!finalToolCall) continue;
    const rawArguments = finalToolCall.function?.arguments;
    if (!rawArguments) {
      throw new Error("OpenAI returned an empty lumi_response tool call");
    }
    const decision = input.validateFinal(rawArguments, {
      iteration,
      isLastIteration,
    });
    if (decision.status === "accept") {
      return { value: decision.value, finalToolCall };
    }

    input.messages.splice(assistantMessageIndex);
    input.messages.push(decision.correction);
    forcedToolName = decision.forcedToolName ?? null;
  }

  throw input.finalError();
}
