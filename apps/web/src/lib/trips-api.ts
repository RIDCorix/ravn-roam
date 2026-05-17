// Server-side trip fetchers. Forward the Supabase access token from the
// current request's session as a Bearer header so @roam/api's requireAuth
// middleware can resolve the user.

import { createSupabaseServerClient } from "@roam/shared";

export interface ApiTrip {
  id: string;
  user_id: string;
  title: string;
  cover: string | null;
  start_date: string;
  end_date: string;
  status: "upcoming" | "active" | "past" | "cancelled";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiTripStop {
  id: string;
  day_id: string;
  sort_order: number;
  name: string;
  kind: string;
  arrival_time: string | null;
  duration_min: number | null;
  note: string;
  attachments: ApiTripStopAttachment[];
  lat: number | null;
  lng: number | null;
}

export interface ApiTripStopAttachment {
  id: string;
  type: string;
  label: string;
  action_label: string | null;
  checklist_item_id: string | null;
  checklist_text: string | null;
  checklist_kind: string | null;
  image_name: string | null;
  image_data_url: string | null;
  status: "required" | "completed" | "uploaded";
  done: boolean;
}

export interface ApiTripDay {
  id: string;
  trip_id: string;
  sort_order: number;
  day_date: string;
  city: string;
  note: string;
  /* Optional for backwards-compat with pre-stops backend responses. New
     code paths always materialize at least one stop. */
  stops?: ApiTripStop[];
}

export interface ApiChecklistItem {
  id: string;
  trip_id: string;
  text: string;
  kind: string;
  done: boolean;
  suggested: boolean;
  suggested_by: string | null;
  shortcut: string | null;
  shop_filter: Record<string, unknown> | null;
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
  return process.env.ROAM_API_URL ?? "http://localhost:3001";
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

  const res = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
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

export async function createTrip(input: {
  title: string;
  cover?: string | null;
  start_date: string;
  end_date: string;
  status?: ApiTrip["status"];
  days?: {
    day_date: string;
    city: string;
    note: string;
    stops?: {
      name: string;
      kind?: string;
      arrival_time?: string | null;
      duration_min?: number | null;
      note?: string;
      attachments?: {
        id?: string | null;
        type?: string;
        label: string;
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
    kind: string;
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
