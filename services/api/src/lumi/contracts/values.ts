export interface LumiStopAttachment {
  id?: string | null;
  type?: string;
  label: string;
  url?: string | null;
  amount?: string | null;
  action_label?: string | null;
  checklist_text?: string | null;
  checklist_description?: string | null;
  checklist_kind?: string | null;
  checklist_item_id?: string | null;
  status?: "required" | "completed" | "uploaded";
}

export interface LumiStop {
  stop_id?: string;
  name: string;
  anchor_mode?: "exact_place" | "regional" | "suggested_places";
  place_name?: string | null;
  place_id?: string | null;
  place_address?: string | null;
  area_name?: string | null;
  search_query?: string | null;
  country_code?: string | null;
  place_types?: string[];
  suggestion_count?: number | null;
  kind?: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
  attachments?: LumiStopAttachment[];
  lat?: number | null;
  lng?: number | null;
}

export interface LumiCity {
  name: string;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
}

export interface LumiCompanion {
  id: string;
  display_name: string;
  color: string;
  user_id: string | null;
  accepted_at: string | null;
}
