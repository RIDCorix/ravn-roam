export interface LumiPageContext {
  current_date?: string;
  user_name?: string | null;
  known_trips?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
    days_count: number | null;
    cities: string[];
    updated_at: string;
  }[];
  active_trip?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    days_total: number;
    today_index: number | null;
    today_city: string | null;
    today_note: string | null;
  } | null;
  active_esim?: {
    country_name: string;
    plan: string;
    used_gb: number;
    total_gb: number;
    days_left: number;
    days_total: number;
    network: string;
    signal: number;
    speed: string;
  } | null;
  today_tasks?: {
    trip_id: string;
    total: number;
    done: number;
    items: {
      text: string;
      done: boolean;
      kind: string;
      due_date: string | null;
      suggested: boolean;
    }[];
  } | null;
}

export interface LumiContextSnapshot {
  trip_id: string;
  title: string;
  start_date: string;
  end_date: string;
  days: {
    day_id: string;
    stops: { stop_id: string }[];
  }[];
  cities: unknown[];
  companions: unknown[];
  flight_legs?: unknown[];
}

export interface LumiContextInput {
  snapshot?: LumiContextSnapshot | null;
  page?: LumiPageContext;
}

/**
 * Serializes model-visible state only. This module deliberately accepts no
 * authorization or capability input; IDs in context are references, not
 * permission to mutate them.
 */
export function serializeLumiContext(
  input: LumiContextInput | LumiContextSnapshot,
): string {
  const { snapshot, page } = "trip_id" in input
    ? { snapshot: input, page: undefined }
    : input;
  const lines: string[] = [];

  if (page?.current_date) lines.push(`Today's date: ${page.current_date}`);
  if (page?.user_name) lines.push(`User name: ${page.user_name}`);

  if (page?.active_trip) {
    lines.push(
      "",
      "User's currently-active trip (today falls inside its window):",
      JSON.stringify(page.active_trip, null, 2),
    );
  } else {
    lines.push("", "User has no trip in progress right now.");
  }

  if (page?.known_trips?.length) {
    lines.push(
      "",
      "Known trips visible to the user:",
      JSON.stringify(page.known_trips, null, 2),
    );
  }

  if (page?.active_esim) {
    lines.push(
      "",
      "User's currently-active eSIM (real-time data, treat as ground truth):",
      JSON.stringify(page.active_esim, null, 2),
    );
  }

  if (page?.today_tasks) {
    lines.push(
      "",
      `Tasks on the active trip (${page.today_tasks.done}/${page.today_tasks.total} done):`,
      JSON.stringify(page.today_tasks.items, null, 2),
    );
  }

  if (snapshot) {
    lines.unshift(
      ">>> EDITOR MODE — user is on the trip detail page for:",
      `  trip_id: ${snapshot.trip_id}`,
      `  title:      ${snapshot.title}`,
      `  start_date: ${snapshot.start_date}`,
      `  end_date:   ${snapshot.end_date}`,
      `  day_count:  ${snapshot.days.length}`,
      "When the user refers to the current trip without naming another",
      "trip, they mean THIS trip.",
      "",
    );
    lines.push(
      "",
      "Current itinerary:",
      JSON.stringify(snapshot.days, null, 2),
      "",
      "Cities currently pinned on the map (geocoded; null means we couldn't",
      "resolve). If a city's country_code looks wrong for this trip, say so",
      "honestly instead of claiming the map is correct.",
      JSON.stringify(snapshot.cities, null, 2),
      "",
      "Trip companions (each row's id is the canonical reference).",
      "user_id != null means a real Supabase user has claimed",
      "the slot via invite link.",
      JSON.stringify(snapshot.companions, null, 2),
      "",
      "Flight legs (leg_id is the canonical reference for updates).",
      JSON.stringify(snapshot.flight_legs ?? [], null, 2),
    );
  } else {
    lines.push(
      "",
      "No editable trip is present in this view.",
    );
  }

  return lines.join("\n");
}
