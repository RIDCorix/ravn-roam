/**
 * R-301 D-2 — how one itinerary item is layered across compact sheet and full view.
 *
 * The decision, settled in the spec walkthrough: edit ONE item at a time; the outer
 * compact sheet stays universal, and only the full view expands by item type.
 *
 * This module is the normative half of that decision expressed as data rather than
 * as JSX, for one reason: `trip-planning-depth-map.test.ts` (c-3) can assert against
 * data. It cannot assert against a field that a component decided to render inside a
 * conditional. R-276 shipped an acceptance criterion about clamping names on a card
 * that never rendered a name — a field list nobody can enumerate is how that happens.
 *
 * Adding a field to a sheet WITHOUT adding it here does not just skip the test, it
 * contradicts it: c-3 asserts the compact sheet contains exactly `COMPACT_CORE_FIELDS`.
 */

/**
 * The four item types the full view branches on. Every `TripStop.kind` the app stores
 * normalises into one of these — see `itemTypeForStopKind`.
 */
export type TripItemType = "place" | "transit" | "flight" | "stay";

export const TRIP_ITEM_TYPES: readonly TripItemType[] = [
  "place",
  "transit",
  "flight",
  "stay",
] as const;

/**
 * Compact sheet fields. Universal on purpose — these three read the same whether the
 * item is a museum, a train, a flight or a hotel, which is what lets the outer layer
 * stay one component instead of four.
 *
 * `ticket_booking` is NOT behind More. The spec is explicit: it shows its status
 * inline (nothing attached / needs upload / one attached) so a museum ticket, a
 * booking screenshot and a rail pass all have a visible entry point.
 */
export const COMPACT_CORE_FIELDS = [
  "datetime",
  "duration",
  "ticket_booking",
] as const;

export type CompactCoreField = (typeof COMPACT_CORE_FIELDS)[number];

/**
 * Ticket & booking is a status, not a boolean — the compact row renders the state
 * itself, so "needs upload" is reachable without opening the full view.
 */
export type TicketBookingStatus = "none" | "required" | "attached";

/**
 * Full-view fields per item type. `ticket_booking` repeats here deliberately: the
 * full view owns the detail (reference codes, the attachment list), the compact row
 * owns the status. They are two renderings of one thing, not two things.
 */
export const FULL_VIEW_FIELDS: Readonly<Record<TripItemType, readonly string[]>> = {
  place: ["datetime", "duration", "place_anchor", "note", "ticket_booking"],
  transit: [
    "datetime",
    "duration",
    "origin",
    "destination",
    "transit_mode",
    "note",
    "ticket_booking",
  ],
  flight: [
    "datetime",
    "duration",
    "airline",
    "flight_number",
    "origin",
    "destination",
    "booking_reference",
    "ticket_booking",
  ],
  stay: [
    "check_in",
    "check_out",
    "place_anchor",
    "booking_reference",
    "note",
    "ticket_booking",
  ],
} as const;

/**
 * Stored `TripStop.kind` values, normalised. The stored vocabulary grew organically
 * (`sight`, `sights`, `meal`, `food`, `coffee`, ...) and D-2 branches on four types,
 * so the mapping is explicit rather than a prefix match — an unrecognised kind is a
 * `place`, which is the type whose full view carries the fewest type-specific claims.
 */
const STOP_KIND_TO_ITEM_TYPE: Readonly<Record<string, TripItemType>> = {
  sight: "place",
  sights: "place",
  meal: "place",
  food: "place",
  coffee: "place",
  other: "place",
  stay: "stay",
  flight: "flight",
  transport: "transit",
  transit: "transit",
  intercity: "transit",
  airport_transfer: "transit",
};

export function itemTypeForStopKind(kind: string | null | undefined): TripItemType {
  if (!kind) return "place";
  return STOP_KIND_TO_ITEM_TYPE[kind] ?? "place";
}

export function fullViewFieldsFor(type: TripItemType): readonly string[] {
  return FULL_VIEW_FIELDS[type];
}

/**
 * Every field the compact sheet may render, in order. Exported as a function rather
 * than reusing the const so a caller cannot mutate the contract array in place.
 */
export function compactFieldsFor(_type: TripItemType): readonly CompactCoreField[] {
  // Intentionally ignores the type. That IS D-2: the outer layer is universal, and a
  // type-dependent compact sheet is the thing the decision rejected.
  return COMPACT_CORE_FIELDS;
}

export function ticketBookingStatus(attachmentCount: number, required: boolean): TicketBookingStatus {
  if (attachmentCount > 0) return "attached";
  return required ? "required" : "none";
}
