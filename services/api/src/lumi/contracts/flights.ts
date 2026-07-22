import { createHash } from "node:crypto";

import type { LumiFlightLeg } from "./snapshot.js";

function stableLegId(tripId: string, key: string): string {
  const hex = createHash("sha256").update(`${tripId}:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16]!, 16) % 4]!;
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function flightLegsFromMetadata(tripId: string, metadata: Record<string, unknown>): LumiFlightLeg[] {
  const planning = record(metadata.planning);
  const canonical = record(planning.flight_legs);
  const legacy = record(planning.exploration_flight_details);
  return Object.entries({ ...legacy, ...canonical }).map(([key, value]) => {
    const leg = record(value);
    return {
      leg_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key) ? key : stableLegId(tripId, key),
      departure_date: typeof leg.departureDate === "string" ? leg.departureDate : null,
      departure_time: typeof leg.departureTime === "string" ? leg.departureTime : null,
      flight_number: typeof leg.flightNumber === "string" ? leg.flightNumber : null,
      terminal: typeof leg.terminal === "string" ? leg.terminal : null,
      gate: typeof leg.gate === "string" ? leg.gate : null,
    };
  });
}

export function flightLegStorageKey(tripId: string, metadata: Record<string, unknown>, legId: string): string | null {
  const planning = record(metadata.planning);
  const keys = [...Object.keys(record(planning.exploration_flight_details)), ...Object.keys(record(planning.flight_legs))];
  return keys.find((key) => (key === legId || stableLegId(tripId, key) === legId)) ?? null;
}
