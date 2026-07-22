import type { LumiRequestMode } from "./contracts/request.js";

export type { LumiRequestMode } from "./contracts/request.js";

export interface LumiAuthorizationContext {
  mode: LumiRequestMode | null;
  tripId: string | null;
}

export type LumiCapability =
  | "read:context"
  | "read:places"
  | "read:esim"
  | "draft:stage-day"
  | "draft:finalize"
  | "trip:update-day"
  | "trip:create-day"
  | "trip:update-flight"
  | "trip:edit-companion"
  | "trip:edit-attachment";

export function authorizationForInput<TEditableTrip extends object>(input: {
  requestedSkill?: LumiRequestMode;
  editableTrip?: TEditableTrip;
}): LumiAuthorizationContext {
  const persistedTripId = input.editableTrip
    ? (input.editableTrip as { trip_id?: string }).trip_id
    : undefined;
  return {
    mode: input.requestedSkill ?? null,
    tripId: persistedTripId ?? null,
  };
}

export function capabilitiesForTurn(
  context: LumiAuthorizationContext,
): ReadonlySet<LumiCapability> {
  if (
    (context.mode === "plan-trip" || context.mode === "edit-trip") &&
    !context.tripId
  ) {
    throw new Error(`${context.mode} requires an owned current trip`);
  }

  switch (context.mode) {
    case null:
      return new Set(["read:context", "read:places", "read:esim"]);
    case "inspiration":
      return new Set(["read:context", "read:places"]);
    case "create-trip":
      return new Set([
        "read:context",
        "read:places",
        "draft:stage-day",
        "draft:finalize",
      ]);
    case "plan-trip":
      return new Set([
        "read:context",
        "read:places",
        "trip:update-day",
        "trip:create-day",
      ]);
    case "edit-trip":
      return new Set([
        "read:context",
        "read:places",
        "trip:update-day",
        "trip:create-day",
        "trip:update-flight",
        "trip:edit-companion",
        "trip:edit-attachment",
      ]);
  }
}
