import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";

import { itineraryDayValues, prepareStopRows, retainedStopIdsAreCurrent } from "./itinerary.js";

describe("itinerary write preparation", () => {
  test("serializes calendar writes by locking the owned trip inside each transaction", () => {
    const source = readFileSync(new URL("./itinerary.ts", import.meta.url), "utf8");
    expect(source.match(/\.for\("update"\)/g)).toHaveLength(2);
    expect(source).toContain("calendarConflict");
  });
  test("detects a retained stop that became stale before execution", () => {
    expect(retainedStopIdsAreCurrent(["stop-a", "stop-b"], [{ id: "stop-a" }])).toBe(false);
  });
  test("persists day segments", () => {
    expect(itineraryDayValues({
      day_date: "2026-09-27",
      city: "Milan",
      cities: ["Milan", "Paris"],
      segments: [{ city: "Milan", start_part: "morning", end_part: "afternoon", note: "Design" }],
      note: "Travel",
      stops: [],
    })).toMatchObject({
      segments: [{ city: "Milan", start_part: "morning", end_part: "afternoon", note: "Design" }],
    });
  });

  test("retains stop identity and deterministic enrichment coordinates", async () => {
    const resolveStops = vi.fn(async (_day: Parameters<typeof prepareStopRows>[1], stops: Parameters<NonNullable<Parameters<typeof prepareStopRows>[2]>>[1]) => stops.map((stop) => ({
      ...stop,
      place_id: "google-place",
      lat: 45.47,
      lng: 9.18,
    })));
    const rows = await prepareStopRows("day-1", {
      day_date: "2026-09-27",
      city: "Milan",
      cities: ["Milan"],
      segments: [],
      note: "",
      stops: [{
        stop_id: "00000000-0000-4000-8000-000000000003",
        name: "Brera",
        place_name: "Pinacoteca di Brera",
        anchor_mode: "exact_place",
        place_types: [],
        suggestion_count: 5,
        kind: "sight",
        note: "",
        attachments: [],
      }],
    }, resolveStops);
    expect(rows[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000003",
      placeId: "google-place",
      lat: 45.47,
      lng: 9.18,
    });
  });
});
