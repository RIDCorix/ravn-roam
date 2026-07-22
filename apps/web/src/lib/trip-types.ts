export interface ConsumerUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  joined: string;
  tier: string;
  homeCity: string;
}

export interface ActiveESIM {
  id: string;
  country: string;
  countryName: string;
  plan: string;
  used: number;
  total: number;
  daysLeft: number;
  daysTotal: number;
  installedAt: string;
  network: string;
  signal: 1 | 2 | 3 | 4;
  speed: string;
}

export type TripStatus = "active" | "upcoming" | "past";

export interface TripStopAttachment {
  id: string;
  type: string;
  label: string;
  url?: string | null;
  amount?: string | null;
  actionLabel?: string | null;
  checklistItemId?: string | null;
  checklistText?: string | null;
  checklistKind?: string | null;
  imageName?: string | null;
  imageDataUrl?: string | null;
  status: "required" | "completed" | "uploaded";
  done: boolean;
}

export interface TripPlaceSuggestion {
  id: string;
  placeId?: string | null;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  primaryType?: string | null;
  types: string[];
  rating?: number | null;
  userRatingCount?: number | null;
  mapsUrl?: string | null;
  selected?: boolean;
}

export interface TripStop {
  id?: string;
  name: string;
  anchorMode?: "exact_place" | "regional" | "suggested_places";
  placeName?: string | null;
  placeId?: string | null;
  placeAddress?: string | null;
  areaName?: string | null;
  searchQuery?: string | null;
  countryCode?: string | null;
  placeTypes?: string[];
  suggestionCount?: number;
  placeSuggestions?: TripPlaceSuggestion[];
  suggestionsStatus?: string;
  kind: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
  attachments?: TripStopAttachment[];
  lat?: number | null;
  lng?: number | null;
}

export type TripStopAnchorMode = NonNullable<TripStop["anchorMode"]>;

export function normalizeTripStopAnchorMode(
  value: TripStopAnchorMode | string | null | undefined,
): Exclude<TripStopAnchorMode, "suggested_places"> {
  return value === "regional" || value === "suggested_places"
    ? "regional"
    : "exact_place";
}

export function isRegionalTripStop(
  stop: Pick<TripStop, "anchorMode"> | null | undefined,
): boolean {
  return normalizeTripStopAnchorMode(stop?.anchorMode) === "regional";
}

export type TripDaySegmentPart = "morning" | "afternoon" | "evening" | "full_day";

export interface TripDaySegment {
  city: string;
  start_part: TripDaySegmentPart;
  end_part: TripDaySegmentPart;
  note: string;
}

export interface TripDay {
  d: string;
  city: string;
  cities?: string[];
  segments?: TripDaySegment[];
  note: string;
  stops?: TripStop[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  description?: string | null;
  done: boolean;
  kind:
    | "esim"
    | "money"
    | "flight"
    | "stay"
    | "ticket"
    | "visa"
    | "doc"
    | "transit"
    | "gear"
    | "insurance";
  start?: string | null;
  phase?: string | null;
  groupLabel?: string | null;
  subtasks?: {
    text: string;
    done: boolean;
    imageName?: string | null;
    imageDataUrl?: string | null;
  }[];
  shortcut?: "shop";
  shopFilter?: { country: string; days?: number; gb?: number };
  esimOrder?: {
    orderId: string;
    orderNumber: string;
    status: "pending" | "ready" | "shared";
    profileCount: number;
    assignedCount: number;
  } | null;
  due?: string;
  suggested?: boolean;
  suggestedBy?: "Lumi";
  assignedCompanionId?: string | null;
}

export interface Trip {
  id: string;
  title: string;
  cover: string;
  start: string;
  end: string;
  status: TripStatus;
  metadata?: Record<string, unknown>;
  days: TripDay[];
  checklist: ChecklistItem[];
}

export function uniqueTripCities(trip: Trip): string[] {
  return Array.from(
    new Set(
      trip.days
        .flatMap((day) =>
          day.segments?.length
            ? day.segments.map((segment) => segment.city)
            : day.cities?.length
              ? day.cities
              : [day.city],
        )
        .filter(Boolean),
    ),
  );
}
