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

export interface TripStop {
  id?: string;
  name: string;
  kind: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
  attachments?: TripStopAttachment[];
  lat?: number | null;
  lng?: number | null;
}

export interface TripDay {
  d: string;
  city: string;
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
  return Array.from(new Set(trip.days.map((day) => day.city).filter(Boolean)));
}
