import type { CorrelatedLumiCommand, LumiCommand, RejectedLumiCommandAttempt } from "./commands.js";
import type { LumiRequestMode } from "./request.js";
import type { EditableTripSnapshot } from "./snapshot.js";
import type { LumiPageContext } from "../context.js";
import type { LumiStop } from "./values.js";

export interface LumiDay {
  day_date: string;
  city: string;
  cities?: string[];
  segments?: { city: string; start_part: "morning" | "afternoon" | "evening" | "full_day"; end_part: "morning" | "afternoon" | "evening" | "full_day"; note: string }[];
  note: string;
  stops?: LumiStop[];
}
export interface LumiTurn { role: "user" | "assistant"; content: string }
export type LumiRequestedSkill = LumiRequestMode;
export interface LumiCompanionEdit { id?: string | null; display_name?: string; color?: string; delete?: boolean }
export interface LumiInput {
  prompt: string;
  history?: LumiTurn[];
  editableTrip?: EditableTripSnapshot;
  context?: LumiPageContext;
  requestedSkill?: LumiRequestedSkill;
  onProgress?: (event: LumiProgressEvent) => void | Promise<void>;
}
export type LumiProgressEvent =
  | { event: "status"; status: "analyzing" | "finalizing"; label: string; iteration?: number }
  | { event: "tool_call"; tool_name: string; label: string; iteration?: number }
  | { event: "tool_result"; tool_name: string; status: "success" | "error"; label: string; iteration?: number; staged_days?: number | null; days_preview?: LumiStagedDayPreview[] | null };
export interface LumiStagedDayPreview { day_date: string; city: string; cities: string[]; stop_names: string[]; stop_count: number }
export interface LumiFlightDetailsPatch { leg_key: string; departure_date?: string | null; departure_time?: string | null; flight_number?: string | null; terminal?: string | null; gate?: string | null }
export interface LumiTripDraft {
  title: string; start_date: string; end_date: string; cover?: string | null; days: LumiDay[]; flight_details?: LumiFlightDetailsPatch[] | null;
  checklist?: { text: string; description?: string | null; kind: string; start_date?: string | null; phase?: string | null; group_label?: string | null; subtasks?: { text: string; done?: boolean | null }[] | null; suggested?: boolean | null; shop_filter?: { country: string; days?: number | null; gb?: number | null } | null }[] | null;
}
export interface LumiResult {
  summary: string; commands?: CorrelatedLumiCommand[]; rejected_commands?: RejectedLumiCommandAttempt[]; days?: LumiDay[]; day_creates?: LumiDay[]; companions?: LumiCompanionEdit[]; flight_details?: LumiFlightDetailsPatch[]; trip_draft?: LumiTripDraft;
  esim_suggestion?: { plans: Array<{ country: string; days?: number; gb?: number; label?: string }>; rationale?: string };
  tool_call?: { id?: string | null; name: "lumi_response"; arguments: unknown };
  tool_events?: LumiToolEvent[];
}
export interface LumiToolEvent {
  event: "tool_result";
  tool_name: LumiCommand["type"] | "set_flight_details";
  tool_call_id?: string | null; status: "success" | "error"; target_id?: string | null; day_date?: string | null; day_index?: number | null; day_count?: number | null; flight_count?: number | null; label: string;
}
