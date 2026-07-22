// Server-side trip fetchers. Forward the Supabase access token from the
// current request's session as a Bearer header so @roam/api's requireAuth
// middleware can resolve the user.

import { createSupabaseServerClient } from "@roam/shared";
import { serverApiBase } from "@/lib/server-api-base";

export interface ApiTrip {
  id: string;
  user_id: string;
  title: string;
  cover: string | null;
  start_date: string;
  end_date: string;
  status: "upcoming" | "active" | "past" | "cancelled";
  metadata: Record<string, unknown>;
  days_count?: number;
  cities?: string[];
  checklist_total?: number;
  checklist_done?: number;
  created_at: string;
  updated_at: string;
}

export interface ApiTripStop {
  id: string;
  day_id: string;
  sort_order: number;
  name: string;
  anchor_mode: "exact_place" | "regional" | "suggested_places";
  place_name: string | null;
  place_id: string | null;
  place_address: string | null;
  area_name: string | null;
  search_query: string | null;
  country_code: string | null;
  place_types: string[];
  suggestion_count: number;
  place_suggestions: ApiTripPlaceSuggestion[];
  suggestions_status: string;
  kind: string;
  arrival_time: string | null;
  duration_min: number | null;
  note: string;
  attachments: ApiTripStopAttachment[];
  lat: number | null;
  lng: number | null;
}

export interface ApiTripPlaceSuggestion {
  id: string;
  place_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  primary_type: string | null;
  types: string[];
  rating: number | null;
  user_rating_count: number | null;
  maps_url: string | null;
  selected?: boolean;
}

export interface ApiTripStopAttachment {
  id: string;
  type: string;
  label: string;
  url: string | null;
  amount: string | null;
  action_label: string | null;
  checklist_item_id: string | null;
  checklist_text: string | null;
  checklist_kind: string | null;
  image_name: string | null;
  image_data_url: string | null;
  status: "required" | "completed" | "uploaded";
  done: boolean;
}

export type ApiTripDaySegmentPart = "morning" | "afternoon" | "evening" | "full_day";

export interface ApiTripDaySegment {
  city: string;
  start_part: ApiTripDaySegmentPart;
  end_part: ApiTripDaySegmentPart;
  note: string;
}

export interface ApiTripDay {
  id: string;
  trip_id: string;
  sort_order: number;
  day_date: string;
  city: string;
  cities: string[];
  segments: ApiTripDaySegment[];
  note: string;
  /* Optional for backwards-compat with pre-stops backend responses. New
     code paths always materialize at least one stop. */
  stops?: ApiTripStop[];
}

export interface ApiChecklistItem {
  id: string;
  trip_id: string;
  text: string;
  description: string | null;
  kind: string;
  start_date: string | null;
  phase: string | null;
  group_label: string | null;
  subtasks: {
    text: string;
    done: boolean;
    image_name?: string | null;
    image_data_url?: string | null;
  }[];
  done: boolean;
  suggested: boolean;
  suggested_by: string | null;
  shortcut: string | null;
  shop_filter: Record<string, unknown> | null;
  esim_order: {
    order_id: string;
    order_number: string;
    status: "pending" | "ready" | "shared";
    profile_count: number;
    assigned_count: number;
  } | null;
  due_date: string | null;
  assigned_companion_id: string | null;
}

export interface ApiCity {
  name: string;
  lat: number | null;
  lng: number | null;
}

export interface ApiCompanion {
  id: string;
  trip_id: string;
  display_name: string;
  color: string;
  sort_order: number;
  user_id: string | null;
  invite_token: string | null;
  accepted_at: string | null;
  role?: "owner" | "companion";
}

export interface TripDetailPayload {
  trip: ApiTrip;
  days: ApiTripDay[];
  checklist: ApiChecklistItem[];
  cities: ApiCity[];
  companions: ApiCompanion[];
}

export class TripApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "TripApiError";
  }
}

function apiBase(): string {
  return serverApiBase();
}

async function authedFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new TripApiError(401, "no_session");

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (err) {
    throw new TripApiError(
      503,
      err instanceof Error ? err.message : "api_unreachable",
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TripApiError(res.status, text);
  }
  return (await res.json()) as T;
}

export async function listTrips(): Promise<ApiTrip[]> {
  const { trips } = await authedFetch<{ trips: ApiTrip[] }>(`/trips`);
  return trips;
}

export async function getTrip(id: string): Promise<TripDetailPayload> {
  return authedFetch<TripDetailPayload>(`/trips/${id}`);
}

/** Flat list of the user's checklist items across all trips. Each item
 *  carries `trip_id` so callers can group client-side. Defaults to
 *  incomplete-only; pass `{ includeDone: true }` to fetch everything. */
export async function listChecklists(
  opts: { includeDone?: boolean } = {},
): Promise<ApiChecklistItem[]> {
  const qs = opts.includeDone ? "?done=any" : "";
  const { items } = await authedFetch<{ items: ApiChecklistItem[] }>(
    `/trips/checklists${qs}`,
  );
  return items;
}

export async function createTrip(input: {
  title: string;
  cover?: string | null;
  start_date: string;
  end_date: string;
  status?: ApiTrip["status"];
  metadata?: Record<string, unknown>;
  days?: {
    day_date: string;
    city: string;
    cities?: string[];
    segments?: ApiTripDaySegment[];
    note: string;
    stops?: {
      name: string;
      anchor_mode?: "exact_place" | "regional" | "suggested_places";
      place_name?: string | null;
      place_id?: string | null;
      place_address?: string | null;
      area_name?: string | null;
      search_query?: string | null;
      country_code?: string | null;
      place_types?: string[];
      suggestion_count?: number;
      place_suggestions?: ApiTripPlaceSuggestion[];
      suggestions_status?: string;
      kind?: string;
      arrival_time?: string | null;
      duration_min?: number | null;
      note?: string;
      attachments?: {
        id?: string | null;
        type?: string;
        label: string;
        url?: string | null;
        amount?: string | null;
        action_label?: string | null;
        checklist_text?: string | null;
        checklist_kind?: string | null;
        checklist_item_id?: string | null;
        status?: "required" | "completed" | "uploaded";
      }[];
    }[];
  }[];
  checklist?: {
    text: string;
    description?: string | null;
    kind: string;
    start_date?: string | null;
    phase?: string | null;
    group_label?: string | null;
    subtasks?: {
      text: string;
      done?: boolean;
      image_name?: string | null;
      image_data_url?: string | null;
    }[];
    done?: boolean;
    suggested?: boolean;
    suggested_by?: string | null;
    shortcut?: string | null;
    shop_filter?: Record<string, unknown> | null;
    due_date?: string | null;
  }[];
}): Promise<ApiTrip> {
  const { trip } = await authedFetch<{ trip: ApiTrip }>(`/trips`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return trip;
}
