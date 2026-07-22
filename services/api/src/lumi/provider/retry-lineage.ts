import { randomUUID } from "node:crypto";

import type { LumiCommand } from "../contracts/commands.js";

export type PendingLumiRejection = {
  attempt_id: string;
  type: LumiCommand["type"];
  target_id: string | null;
  rejected_iteration: number;
};

export function serverAttemptId(): string {
  return `lumi-attempt-${randomUUID()}`;
}

export function registerPendingRejection(
  pending: PendingLumiRejection[],
  rejection: PendingLumiRejection,
): void {
  pending.push(rejection);
}

export function consumePendingRetry(
  pending: PendingLumiRejection[],
  claim: {
    claimed_attempt_id?: string | null;
    type: LumiCommand["type"];
    target_id: string | null;
    iteration: number;
  },
): string | null {
  if (claim.target_id == null) return null;

  const eligible = pending.filter(
    (candidate) =>
      candidate.type === claim.type &&
      candidate.target_id === claim.target_id &&
      candidate.rejected_iteration + 1 === claim.iteration,
  );
  if (eligible.length !== 1) return null;

  const index = pending.indexOf(eligible[0]!);
  pending.splice(index, 1);
  return eligible[0]!.attempt_id;
}
