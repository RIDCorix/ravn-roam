import { describe, expect, it } from "vitest";

import { buildPlannerFixtureTrip } from "@/app/[lang]/dev/trip-planner/fixture-trip";

import {
  COMPACT_SHEET_FIELDS,
  DEFAULT_PLANNER_DETENT,
  MAP_SHARE_RANGE,
  PLANNER_ITEM_TYPES,
  TYPE_SPECIFIC_FIELDS,
  buildOverviewRows,
  compactFieldsFor,
  detentHeights,
  dragHeight,
  fullViewFieldsFor,
  nearestDetent,
  plannerLayout,
  plannerShopFilter,
  projectRelease,
  resolveReleaseDetent,
  type PlannerDay,
} from "./planner-model";

function day(
  date: string,
  placeKey: string,
  itemCount: number,
  travel?: { from: string; to: string },
): PlannerDay {
  return {
    date,
    placeKey,
    place: placeKey,
    travel,
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `${date}-${index}`,
      type: "place" as const,
      title: `Item ${index}`,
      date,
      startTime: "09:00",
      durationMin: 60,
      ticket: { state: "missing" as const, label: "" },
      lat: index === 0 ? 1 : undefined,
      lng: index === 0 ? 1 : undefined,
      fields: { placeName: "", admission: "", bookingReference: "" },
    })),
  };
}

describe("stay segments and travel days", () => {
  const days = [
    day("2026-11-10", "tokyo", 2),
    day("2026-11-11", "tokyo", 1),
    day("2026-11-12", "tokyo", 0),
    day("2026-11-13", "kyoto", 1, { from: "tokyo", to: "kyoto" }),
    day("2026-11-14", "kyoto", 2),
    day("2026-11-15", "osaka", 1, { from: "kyoto", to: "osaka" }),
    day("2026-11-16", "osaka", 1),
  ];

  it("collapses consecutive days in one place into a single segment", () => {
    const rows = buildOverviewRows(days);
    expect(rows.map((row) => row.kind)).toEqual([
      "stay",
      "travel",
      "stay",
      "travel",
      "stay",
    ]);
    const first = rows[0];
    expect(first.kind).toBe("stay");
    if (first.kind !== "stay") throw new Error("expected a stay row");
    expect(first.place).toBe("tokyo");
    expect(first.dayNumbers).toEqual([1, 2, 3]);
    expect(first.startDate).toBe("2026-11-10");
    expect(first.endDate).toBe("2026-11-12");
  });

  it("represents every relocation with exactly one travel day and nothing else", () => {
    const rows = buildOverviewRows(days);
    const relocations = days.filter((entry) => entry.travel).length;
    const travelRows = rows.filter((row) => row.kind === "travel");
    expect(travelRows).toHaveLength(relocations);
    expect(travelRows.map((row) => row.kind === "travel" && row.dayNumber)).toEqual([
      4, 6,
    ]);
    // No stay segment may span two places — that is the swimlane the spec
    // rejected sneaking back in.
    for (const row of rows) {
      if (row.kind !== "stay") continue;
      const places = new Set(
        row.dayNumbers.map((dayNumber) => days[dayNumber - 1]!.placeKey),
      );
      expect(places.size).toBe(1);
    }
  });

  it("counts local activity and mappable stops per day", () => {
    const rows = buildOverviewRows(days);
    const tokyo = rows[0];
    if (tokyo.kind !== "stay") throw new Error("expected a stay row");
    expect(tokyo.days.map((entry) => entry.itemCount)).toEqual([2, 1, 0]);
    expect(tokyo.days.map((entry) => entry.stopCount)).toEqual([1, 1, 0]);
  });
});

describe("compact sheet vs type-specific full view", () => {
  it("keeps the compact sheet universal", () => {
    expect([...COMPACT_SHEET_FIELDS]).toEqual([
      "date",
      "startTime",
      "durationMin",
      "ticket",
    ]);
    for (const type of PLANNER_ITEM_TYPES) {
      expect([...compactFieldsFor(type)]).toEqual([...COMPACT_SHEET_FIELDS]);
    }
  });

  it("maps each item type to exactly its own fields", () => {
    expect(TYPE_SPECIFIC_FIELDS.place).toEqual([
      "placeName",
      "admission",
      "bookingReference",
    ]);
    expect(TYPE_SPECIFIC_FIELDS.transport).toEqual([
      "mode",
      "origin",
      "destination",
      "ticketReference",
    ]);
    expect(TYPE_SPECIFIC_FIELDS.flight).toEqual([
      "airline",
      "flightNumber",
      "origin",
      "destination",
      "ticketReference",
    ]);
    expect(TYPE_SPECIFIC_FIELDS.stay).toEqual([
      "property",
      "checkIn",
      "checkOut",
      "bookingReference",
    ]);
  });

  it("never leaks a type-specific field into the compact sheet", () => {
    for (const type of PLANNER_ITEM_TYPES) {
      for (const field of TYPE_SPECIFIC_FIELDS[type]) {
        expect(COMPACT_SHEET_FIELDS).not.toContain(field);
      }
      expect(fullViewFieldsFor(type)).toEqual([
        ...COMPACT_SHEET_FIELDS,
        ...TYPE_SPECIFIC_FIELDS[type],
      ]);
    }
  });
});

describe("D-1 geometry", () => {
  const phone = {
    viewportHeight: 844,
    topChromeHeight: 88,
    bottomNavReserved: 96,
  };

  it("leaves the map 35-41% of the planning space at the default detent", () => {
    const layout = plannerLayout({ ...phone, detent: DEFAULT_PLANNER_DETENT });
    expect(layout.planningSpace).toBe(660);
    expect(layout.mapShare).toBeGreaterThanOrEqual(MAP_SHARE_RANGE.min);
    expect(layout.mapShare).toBeLessThanOrEqual(MAP_SHARE_RANGE.max);
    expect(layout.mapHeight + layout.sheetHeight).toBe(layout.planningSpace);
  });

  it("never lets the sheet reach into the navigation", () => {
    for (const detent of ["map", "plan", "full"] as const) {
      const layout = plannerLayout({ ...phone, detent });
      expect(layout.sheetBottom).toBeLessThanOrEqual(
        phone.viewportHeight - phone.bottomNavReserved,
      );
      expect(layout.sheetTop).toBeGreaterThanOrEqual(phone.topChromeHeight);
    }
  });
});

describe("gesture math", () => {
  it("tracks the pointer 1:1 and keeps the grab offset", () => {
    const height = dragHeight({
      startHeight: 400,
      startPointerY: 500,
      pointerY: 440,
      minHeight: 100,
      maxHeight: 700,
    });
    expect(height).toBe(460);
    expect(
      dragHeight({
        startHeight: 400,
        startPointerY: 500,
        pointerY: 560,
        minHeight: 100,
        maxHeight: 700,
      }),
    ).toBe(340);
  });

  it("clamps at the outer detents", () => {
    expect(
      dragHeight({
        startHeight: 400,
        startPointerY: 500,
        pointerY: -2000,
        minHeight: 100,
        maxHeight: 700,
      }),
    ).toBe(700);
    expect(
      dragHeight({
        startHeight: 400,
        startPointerY: 500,
        pointerY: 3000,
        minHeight: 100,
        maxHeight: 700,
      }),
    ).toBe(100);
  });

  it("carries the release velocity into the landing detent", () => {
    const planningSpace = 660;
    const heights = detentHeights(planningSpace);
    expect(projectRelease(heights.plan, 0)).toBe(heights.plan);
    // A flick upward lands full; the same height released downward lands low.
    expect(
      resolveReleaseDetent({ height: heights.plan, velocity: 0.6, planningSpace }),
    ).toBe("full");
    expect(
      resolveReleaseDetent({ height: heights.plan, velocity: -0.6, planningSpace }),
    ).toBe("map");
    // Released without momentum it stays where it was let go.
    expect(
      resolveReleaseDetent({ height: heights.plan, velocity: 0, planningSpace }),
    ).toBe("plan");
    expect(nearestDetent(heights.full - 4, heights)).toBe("full");
  });
});

describe("the fixture the acceptance run drives", () => {
  const trip = buildPlannerFixtureTrip("en");

  it("covers all four item types", () => {
    const types = new Set(
      trip.days.flatMap((entry) => entry.items.map((item) => item.type)),
    );
    expect([...types].sort()).toEqual(["flight", "place", "stay", "transport"]);
  });

  it("carries a country and a day count into the shop prefilter", () => {
    expect(plannerShopFilter(trip)).toEqual({ country: "JP", days: 8 });
  });

  it("localizes every day, item and checklist string", () => {
    const zh = buildPlannerFixtureTrip("zh-TW");
    expect(zh.title).not.toBe(trip.title);
    expect(zh.days.map((entry) => entry.date)).toEqual(
      trip.days.map((entry) => entry.date),
    );
    for (let index = 0; index < zh.days.length; index += 1) {
      expect(zh.days[index]!.items).toHaveLength(trip.days[index]!.items.length);
    }
    expect(zh.checklist.map((item) => item.text)).not.toEqual(
      trip.checklist.map((item) => item.text),
    );
  });
});
