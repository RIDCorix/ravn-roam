import type { ExecutedLumiCommand } from "./execution/itinerary.js";
import type { RejectedLumiCommandAttempt } from "./contracts/commands.js";

type SuccessfulLumiMutation = Extract<
  ExecutedLumiCommand,
  { status: "success" }
>;

type LumiResponseToolEvent = {
  tool_name: ExecutedLumiCommand["type"] | "set_flight_details";
  status: "success" | "error";
  target_id?: string | null;
  label: string;
};

type AssemblyInput = {
  proposedSummary: string;
  executions: ExecutedLumiCommand[];
  rejectedAttempts?: RejectedLumiCommandAttempt[];
  proposedToolEvents?: LumiResponseToolEvent[];
  flightDetailsApplied?: boolean;
};

export type AssembledLumiResponse = {
  summary: string;
  mutations: SuccessfulLumiMutation[];
  audit: {
    executions: ExecutedLumiCommand[];
    rejected_attempts: RejectedLumiCommandAttempt[];
  };
  toolEvents: LumiResponseToolEvent[];
};

const FAILURE_SUMMARIES = {
  invalid_reference: {
    noneApplied:
      "I couldn't apply that change because the trip changed. Reload and try again.",
    partial:
      "I applied some changes, but another change couldn't be applied because the trip changed. Reload and try again.",
  },
  conflict: {
    noneApplied:
      "I couldn't apply that change because it conflicts with the current trip. Reload and try again.",
    partial:
      "I applied some changes, but another change conflicts with the current trip. Reload and try again.",
  },
  execution_failed: {
    noneApplied: "I couldn't apply that change. Try again in a moment.",
    partial:
      "I applied some changes, but another change couldn't be applied. Try again in a moment.",
  },
  unauthorized_command: {
    noneApplied:
      "I couldn't apply that change because it wasn't allowed. Review the trip and try again.",
    partial:
      "I applied some changes, but another change wasn't allowed. Review the trip and try again.",
  },
  invalid_command: {
    noneApplied:
      "I couldn't apply that change. Review the trip and try again.",
    partial:
      "I applied some changes, but another change couldn't be applied. Review the trip and try again.",
  },
} as const;

export function assembleLumiResponse({
  proposedSummary,
  executions,
  rejectedAttempts = [],
  proposedToolEvents = [],
  flightDetailsApplied = false,
}: AssemblyInput): AssembledLumiResponse {
  const mutations = executions.filter(
    (execution): execution is SuccessfulLumiMutation =>
      execution.status === "success",
  );
  const failures = executions.filter(
    (execution): execution is Extract<
      ExecutedLumiCommand,
      { status: "error" }
    > => execution.status === "error",
  );
  const successfulAttemptKeys = new Set(
    mutations.flatMap((mutation) => mutation.attempt_id ? [`${mutation.type}:${mutation.attempt_id}`] : []),
  );
  const successfulLegacyKeys = new Set(
    mutations.flatMap((mutation) => mutation.attempt_id
      ? []
      : [`${mutation.type}:${mutation.request_target_id ?? mutation.target_id}`]),
  );
  const terminalRejectedAttempts = rejectedAttempts.filter(
    (attempt) => attempt.attempt_id
      ? !successfulAttemptKeys.has(`${attempt.type}:${attempt.attempt_id}`)
      : !successfulLegacyKeys.has(`${attempt.type}:${attempt.target_id}`),
  );
  const allFailures = [...failures, ...terminalRejectedAttempts];
  const orderedOutcomes = new Map<string, ExecutedLumiCommand[]>();
  for (const execution of executions) {
    const key = `${execution.type}:${execution.target_id}`;
    const queue = orderedOutcomes.get(key) ?? [];
    queue.push(execution);
    orderedOutcomes.set(key, queue);
  }
  const toolEvents = proposedToolEvents.filter((event) => {
    if (event.status !== "success") return false;
    if (event.tool_name === "set_flight_details") {
      return flightDetailsApplied;
    }
    if (!event.target_id) return false;
    const key = `${event.tool_name}:${event.target_id}`;
    const outcome = orderedOutcomes.get(key)?.shift();
    return outcome?.status === "success";
  });

  if (allFailures.length === 0) {
    return {
      summary: proposedSummary,
      mutations,
      audit: { executions, rejected_attempts: rejectedAttempts },
      toolEvents,
    };
  }

  const failure =
    allFailures.find((outcome) => outcome.code === "invalid_reference") ??
    failures.find((execution) => execution.code === "conflict") ??
    terminalRejectedAttempts.find(
      (attempt) => attempt.code === "unauthorized_command",
    ) ??
    allFailures[0]!;
  const anyApplied = mutations.length > 0 || flightDetailsApplied;
  const summary =
    anyApplied
      ? FAILURE_SUMMARIES[failure.code].partial
      : FAILURE_SUMMARIES[failure.code].noneApplied;

  return {
    summary,
    mutations,
    audit: { executions, rejected_attempts: rejectedAttempts },
    toolEvents,
  };
}
