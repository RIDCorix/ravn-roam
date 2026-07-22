import type { LumiRequestMode } from "./contracts/request.js";

type LoadedTrip<T> = T | "forbidden" | null;

export function validateMutationContext<T>(
  mode: LumiRequestMode | undefined,
  tripId: string | undefined,
  loadedTrip: LoadedTrip<T>,
): { ok: true; trip: T | null } | { ok: false; status: 400 | 403; error: string } {
  const mutating = mode === "plan-trip" || mode === "edit-trip";
  if (mutating && !tripId) {
    return { ok: false, status: 400, error: "current_trip_required" };
  }
  if (mutating && loadedTrip === "forbidden") {
    return { ok: false, status: 403, error: "current_trip_forbidden" };
  }
  return { ok: true, trip: loadedTrip === "forbidden" ? null : loadedTrip };
}

export async function preflightMutationRequest({ mode, tripId, loadOwnedTrip }: {
  mode: LumiRequestMode | undefined;
  tripId: string | undefined;
  loadOwnedTrip: (tripId: string) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; status: 400 | 403; error: string }> {
  if (mode !== "plan-trip" && mode !== "edit-trip") return { ok: true };
  if (!tripId) return { ok: false, status: 400, error: "current_trip_required" };
  if (!(await loadOwnedTrip(tripId))) return { ok: false, status: 403, error: "current_trip_forbidden" };
  return { ok: true };
}
