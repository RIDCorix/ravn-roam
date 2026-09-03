// R-301 trip planner model.
//
// Pure data, geometry and gesture math for the planning surface. No React,
// no DOM, no framework imports — the layout numbers the spec argues about
// (map share of the planning space, detent heights, release projection) are
// decided here so the UI and the tests read the same source.

export type PlannerItemType = "place" | "transport" | "flight" | "stay";

/** Ticket & booking is a universal row: every item type shows its state. */
export type TicketState = "missing" | "needed" | "attached";

export interface PlannerTicket {
  state: TicketState;
  /** Short evidence label, e.g. a file name or a reference. */
  label: string;
}

interface PlannerItemBase {
  id: string;
  title: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** 24h local time, HH:MM. */
  startTime: string;
  durationMin: number;
  ticket: PlannerTicket;
  /** Map anchor. Items without one never draw a pin. */
  lat?: number;
  lng?: number;
}

export interface PlannerPlaceFields {
  placeName: string;
  admission: string;
  bookingReference: string;
}

export interface PlannerTransportFields {
  mode: string;
  origin: string;
  destination: string;
  ticketReference: string;
}

export interface PlannerFlightFields {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  ticketReference: string;
}

export interface PlannerStayFields {
  property: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string;
}

export type PlannerItem =
  | (PlannerItemBase & { type: "place"; fields: PlannerPlaceFields })
  | (PlannerItemBase & { type: "transport"; fields: PlannerTransportFields })
  | (PlannerItemBase & { type: "flight"; fields: PlannerFlightFields })
  | (PlannerItemBase & { type: "stay"; fields: PlannerStayFields });

export type PlannerItemFields =
  | PlannerPlaceFields
  | PlannerTransportFields
  | PlannerFlightFields
  | PlannerStayFields;

export const PLANNER_ITEM_TYPES: readonly PlannerItemType[] = [
  "place",
  "transport",
  "flight",
  "stay",
];

// ----------------------------------------------------------------------
// D-2 · what lives in the compact sheet and what only the full view shows
// ----------------------------------------------------------------------

/** Understood by every item type, so it can stay in the compact sheet. */
export const UNIVERSAL_CORE_FIELDS = [
  "date",
  "startTime",
  "durationMin",
] as const;

/** Compact sheet = universal core + an always-visible Ticket & booking row. */
export const COMPACT_SHEET_FIELDS = [
  ...UNIVERSAL_CORE_FIELDS,
  "ticket",
] as const;

/** Exact per-type mapping for the full view. Order is the render order. */
export const TYPE_SPECIFIC_FIELDS: Record<
  PlannerItemType,
  readonly string[]
> = {
  place: ["placeName", "admission", "bookingReference"],
  transport: ["mode", "origin", "destination", "ticketReference"],
  flight: [
    "airline",
    "flightNumber",
    "origin",
    "destination",
    "ticketReference",
  ],
  stay: ["property", "checkIn", "checkOut", "bookingReference"],
};

/**
 * The compact sheet is deliberately type-independent: every type maps to the
 * same universal core, which is what lets one card serve all four.
 */
const COMPACT_FIELDS_BY_TYPE: Record<PlannerItemType, readonly string[]> = {
  place: COMPACT_SHEET_FIELDS,
  transport: COMPACT_SHEET_FIELDS,
  flight: COMPACT_SHEET_FIELDS,
  stay: COMPACT_SHEET_FIELDS,
};

export function compactFieldsFor(type: PlannerItemType): readonly string[] {
  return COMPACT_FIELDS_BY_TYPE[type];
}

export function fullViewFieldsFor(type: PlannerItemType): readonly string[] {
  return [...COMPACT_SHEET_FIELDS, ...TYPE_SPECIFIC_FIELDS[type]];
}

// ----------------------------------------------------------------------
// Days, stay segments and travel days
// ----------------------------------------------------------------------

export interface PlannerDay {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Stable identity of the place, independent of the display locale. */
  placeKey: string;
  /** The place the traveller is in on this day, as shown. */
  place: string;
  /** Set only when the day is a relocation between two places. */
  travel?: { from: string; to: string };
  items: PlannerItem[];
}

export interface PlannerStaySegmentDay {
  date: string;
  dayNumber: number;
  /** Everything planned that day. */
  itemCount: number;
  /** Items that drop a pin on the map. */
  stopCount: number;
}

export interface PlannerStayRow {
  kind: "stay";
  id: string;
  placeKey: string;
  place: string;
  startDate: string;
  endDate: string;
  dayNumbers: number[];
  days: PlannerStaySegmentDay[];
}

export interface PlannerTravelRow {
  kind: "travel";
  id: string;
  date: string;
  dayNumber: number;
  from: string;
  to: string;
}

export type PlannerOverviewRow = PlannerStayRow | PlannerTravelRow;

function isMapAnchored(item: PlannerItem): boolean {
  return typeof item.lat === "number" && typeof item.lng === "number";
}

/**
 * Group the trip the way the spec settled it: consecutive days in the same
 * place collapse into one stay segment, and a relocation is represented
 * only by a travel day row. Nothing else encodes movement between places.
 */
export function buildOverviewRows(days: PlannerDay[]): PlannerOverviewRow[] {
  const rows: PlannerOverviewRow[] = [];
  let current: PlannerStayRow | null = null;

  days.forEach((day, index) => {
    const dayNumber = index + 1;

    if (day.travel) {
      current = null;
      rows.push({
        kind: "travel",
        id: `travel-${day.date}`,
        date: day.date,
        dayNumber,
        from: day.travel.from,
        to: day.travel.to,
      });
      return;
    }

    if (!current || current.placeKey !== day.placeKey) {
      current = {
        kind: "stay",
        id: `stay-${day.date}`,
        placeKey: day.placeKey,
        place: day.place,
        startDate: day.date,
        endDate: day.date,
        dayNumbers: [],
        days: [],
      };
      rows.push(current);
    }

    current.endDate = day.date;
    current.dayNumbers.push(dayNumber);
    current.days.push({
      date: day.date,
      dayNumber,
      itemCount: day.items.length,
      stopCount: day.items.filter(isMapAnchored).length,
    });
  });

  return rows;
}

/** Distinct places in visiting order — the map draws one area per entry. */
export function stayPlaceKeys(rows: PlannerOverviewRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    if (row.kind === "stay" && !keys.includes(row.placeKey)) {
      keys.push(row.placeKey);
    }
  }
  return keys;
}

/** The stay segment a given day index belongs to, or null on a travel day. */
export function stayRowForDay(
  rows: PlannerOverviewRow[],
  dayNumber: number,
): PlannerStayRow | null {
  for (const row of rows) {
    if (row.kind === "stay" && row.dayNumbers.includes(dayNumber)) return row;
  }
  return null;
}

// ----------------------------------------------------------------------
// D-1 · sheet detents and the map share of the planning space
// ----------------------------------------------------------------------

export type PlannerDetent = "map" | "plan" | "full";

export const PLANNER_DETENTS: readonly PlannerDetent[] = ["map", "plan", "full"];

/** D-1 = A: the phone opens itinerary-first, at the middle detent. */
export const DEFAULT_PLANNER_DETENT: PlannerDetent = "plan";

/**
 * Share of the planning space the sheet occupies at each detent. The middle
 * detent leaves 38% for the map, the number D-1 argues for.
 */
export const DETENT_SHEET_FRACTION: Record<PlannerDetent, number> = {
  map: 0.24,
  plan: 0.62,
  full: 0.94,
};

/** Acceptable band for the map share at the default detent (c-2). */
export const MAP_SHARE_RANGE = { min: 0.35, max: 0.41 } as const;

export interface PlannerLayoutInput {
  viewportHeight: number;
  /** Height of the planner's own top chrome. */
  topChromeHeight: number;
  /** Space the bottom navigation reserves, including its offset from the edge. */
  bottomNavReserved: number;
  detent: PlannerDetent;
}

export interface PlannerLayout {
  /** Denominator for every share in this spec. */
  planningSpace: number;
  sheetHeight: number;
  mapHeight: number;
  mapShare: number;
  /** Distance from the top of the viewport to the top of the sheet. */
  sheetTop: number;
  /** Distance from the top of the viewport to the bottom of the sheet. */
  sheetBottom: number;
}

export function plannerLayout(input: PlannerLayoutInput): PlannerLayout {
  const planningSpace = Math.max(
    0,
    input.viewportHeight - input.topChromeHeight - input.bottomNavReserved,
  );
  const sheetHeight = Math.round(
    planningSpace * DETENT_SHEET_FRACTION[input.detent],
  );
  const mapHeight = planningSpace - sheetHeight;
  return {
    planningSpace,
    sheetHeight,
    mapHeight,
    mapShare: planningSpace === 0 ? 0 : mapHeight / planningSpace,
    sheetTop: input.topChromeHeight + mapHeight,
    sheetBottom: input.viewportHeight - input.bottomNavReserved,
  };
}

export function detentHeights(
  planningSpace: number,
): Record<PlannerDetent, number> {
  return {
    map: Math.round(planningSpace * DETENT_SHEET_FRACTION.map),
    plan: Math.round(planningSpace * DETENT_SHEET_FRACTION.plan),
    full: Math.round(planningSpace * DETENT_SHEET_FRACTION.full),
  };
}

// ----------------------------------------------------------------------
// Gesture math: 1:1 tracking, interruptible, release velocity carries over
// ----------------------------------------------------------------------

/**
 * Sheet height while dragging. The grab offset is preserved because the
 * height is derived from where the pointer started, not from the sheet's
 * current animated value.
 */
export function dragHeight({
  startHeight,
  startPointerY,
  pointerY,
  minHeight,
  maxHeight,
}: {
  startHeight: number;
  startPointerY: number;
  pointerY: number;
  minHeight: number;
  maxHeight: number;
}): number {
  const next = startHeight + (startPointerY - pointerY);
  return Math.min(maxHeight, Math.max(minHeight, next));
}

/** UIScrollView-style deceleration, velocity in px/ms. */
export const DECELERATION_RATE = 0.998;

export function projectRelease(
  height: number,
  velocity: number,
  decelerationRate: number = DECELERATION_RATE,
): number {
  return height + (velocity * decelerationRate) / (1 - decelerationRate);
}

export function nearestDetent(
  projectedHeight: number,
  heights: Record<PlannerDetent, number>,
): PlannerDetent {
  let best: PlannerDetent = "plan";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const detent of PLANNER_DETENTS) {
    const distance = Math.abs(heights[detent] - projectedHeight);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = detent;
    }
  }
  return best;
}

/** Where a release lands: project with the release velocity, then snap. */
export function resolveReleaseDetent({
  height,
  velocity,
  planningSpace,
}: {
  height: number;
  /** px/ms, positive means the sheet is growing (pointer moving up). */
  velocity: number;
  planningSpace: number;
}): PlannerDetent {
  const heights = detentHeights(planningSpace);
  return nearestDetent(projectRelease(height, velocity), heights);
}

// ----------------------------------------------------------------------
// Trip shape used by the planner surface
// ----------------------------------------------------------------------

export interface PlannerChecklistItem {
  id: string;
  text: string;
  done: boolean;
  kind: string;
  shopFilter?: { country: string; days?: number; gb?: number };
}

export interface PlannerPlace {
  key: string;
  name: string;
  lat: number;
  lng: number;
}

export interface PlannerTrip {
  id: string;
  title: string;
  countryCode: string;
  countryName: string;
  places: PlannerPlace[];
  days: PlannerDay[];
  checklist: PlannerChecklistItem[];
}

/** country + days prefilter used by both the Lumi and checklist CTAs. */
export function plannerShopFilter(trip: PlannerTrip): {
  country: string;
  days: number;
} {
  return { country: trip.countryCode, days: trip.days.length };
}

export function findDayIndex(trip: PlannerTrip, date: string): number {
  const index = trip.days.findIndex((day) => day.date === date);
  return index === -1 ? 0 : index;
}

export function findItem(
  trip: PlannerTrip,
  itemId: string | null,
): PlannerItem | null {
  if (!itemId) return null;
  for (const day of trip.days) {
    const found = day.items.find((item) => item.id === itemId);
    if (found) return found;
  }
  return null;
}
