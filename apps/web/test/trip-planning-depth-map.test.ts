/**
 * c-3 — "Compact sheet 只含 universal core 與 ticket／booking entry；full view 依
 * item type 映射欄位."
 *
 * The criterion has two halves and both are asserted here as exact set equality
 * rather than containment. Containment would pass while a fourth field crept into the
 * compact sheet, which is precisely the drift D-2 was decided to prevent.
 */
import { describe, expect, it } from "vitest";

import {
  COMPACT_CORE_FIELDS,
  FULL_VIEW_FIELDS,
  TRIP_ITEM_TYPES,
  compactFieldsFor,
  fullViewFieldsFor,
  itemTypeForStopKind,
  ticketBookingStatus,
} from "@/lib/trip-planning-depth";

describe("compact sheet stays universal", () => {
  it("carries exactly the three universal core fields", () => {
    expect([...COMPACT_CORE_FIELDS]).toEqual(["datetime", "duration", "ticket_booking"]);
  });

  it("renders the same fields for every item type", () => {
    for (const type of TRIP_ITEM_TYPES) {
      expect([...compactFieldsFor(type)]).toEqual([...COMPACT_CORE_FIELDS]);
    }
  });

  it("keeps ticket & booking on the outer layer, not behind More", () => {
    // The spec calls this out by name: museum tickets, booking screenshots and rail
    // passes all need an entry point without opening the full view.
    expect(COMPACT_CORE_FIELDS).toContain("ticket_booking");
  });

  it("reports ticket & booking as a status, so the compact row can show it", () => {
    expect(ticketBookingStatus(0, false)).toBe("none");
    expect(ticketBookingStatus(0, true)).toBe("required");
    expect(ticketBookingStatus(1, true)).toBe("attached");
    expect(ticketBookingStatus(2, false)).toBe("attached");
  });
});

describe("full view maps fields by item type", () => {
  it("gives every item type a distinct field list", () => {
    const serialised = TRIP_ITEM_TYPES.map((type) => fullViewFieldsFor(type).join(","));
    expect(new Set(serialised).size).toBe(TRIP_ITEM_TYPES.length);
  });

  it("expands a flight into airline, flight number, endpoints and booking detail", () => {
    expect([...fullViewFieldsFor("flight")]).toEqual([
      "datetime",
      "duration",
      "airline",
      "flight_number",
      "origin",
      "destination",
      "booking_reference",
      "ticket_booking",
    ]);
  });

  it("expands a stay into check-in, check-out and booking detail", () => {
    const fields = fullViewFieldsFor("stay");
    expect(fields).toContain("check_in");
    expect(fields).toContain("check_out");
    expect(fields).toContain("booking_reference");
  });

  it("keeps ticket & booking evidence reachable in every full view", () => {
    for (const type of TRIP_ITEM_TYPES) {
      expect(fullViewFieldsFor(type)).toContain("ticket_booking");
    }
  });

  it("never lists a field twice within one type", () => {
    for (const type of TRIP_ITEM_TYPES) {
      const fields = fullViewFieldsFor(type);
      expect(new Set(fields).size).toBe(fields.length);
    }
  });
});

describe("stored stop kinds normalise onto the four D-2 item types", () => {
  it("maps the kinds the app actually stores", () => {
    expect(itemTypeForStopKind("sight")).toBe("place");
    expect(itemTypeForStopKind("meal")).toBe("place");
    expect(itemTypeForStopKind("coffee")).toBe("place");
    expect(itemTypeForStopKind("stay")).toBe("stay");
    expect(itemTypeForStopKind("flight")).toBe("flight");
    expect(itemTypeForStopKind("transport")).toBe("transit");
    expect(itemTypeForStopKind("intercity")).toBe("transit");
    expect(itemTypeForStopKind("airport_transfer")).toBe("transit");
  });

  it("falls back to place for an unknown or missing kind", () => {
    // Not an arbitrary default: place is the type whose full view makes the fewest
    // type-specific claims, so an unmapped kind degrades to the least wrong screen.
    expect(itemTypeForStopKind("something-new")).toBe("place");
    expect(itemTypeForStopKind(null)).toBe("place");
    expect(itemTypeForStopKind(undefined)).toBe("place");
    expect(itemTypeForStopKind("")).toBe("place");
  });

  it("resolves every mapped kind to a type the full view knows", () => {
    for (const kind of ["sight", "sights", "meal", "food", "coffee", "other", "stay", "flight", "transport", "transit", "intercity", "airport_transfer"]) {
      expect(Object.keys(FULL_VIEW_FIELDS)).toContain(itemTypeForStopKind(kind));
    }
  });
});
