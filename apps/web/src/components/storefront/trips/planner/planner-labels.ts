// Label surface for the R-301 planner. Mirrors
// `storefront.trips.planner` in both dictionaries; every user-visible
// string on the planning surface flows through here.

export interface PlannerOverviewLabels {
  title: string;
  day_range: string;
  day_range_single: string;
  day_summary: string;
  travel_day: string;
  travel_route: string;
  legend_selected: string;
  legend_neutral: string;
}

export interface PlannerDayLabels {
  label: string;
  empty: string;
  select_aria: string;
}

export interface PlannerSheetLabels {
  region: string;
  handle_aria: string;
  detent_map: string;
  detent_plan: string;
  detent_full: string;
}

export interface PlannerItemLabels {
  types: {
    place: string;
    transport: string;
    flight: string;
    stay: string;
  };
  date: string;
  start_time: string;
  duration: string;
  duration_value: string;
  more: string;
  back: string;
  select_aria: string;
  full_title: string;
  save: string;
  saved: string;
  type_section: string;
}

export interface PlannerTicketLabels {
  title: string;
  missing: string;
  needed: string;
  attached: string;
  state_label: string;
}

export interface PlannerFieldLabels {
  placeName: string;
  admission: string;
  bookingReference: string;
  mode: string;
  origin: string;
  destination: string;
  ticketReference: string;
  airline: string;
  flightNumber: string;
  property: string;
  checkIn: string;
  checkOut: string;
}

export interface PlannerLabels {
  trip_meta: string;
  overview: PlannerOverviewLabels;
  day: PlannerDayLabels;
  sheet: PlannerSheetLabels;
  item: PlannerItemLabels;
  ticket: PlannerTicketLabels;
  fields: PlannerFieldLabels;
  lumi: {
    title: string;
    body: string;
    cta: string;
  };
  checklist: {
    title: string;
    esim_cta: string;
  };
}

/** Minimal `{token}` interpolation, matching the other storefront labels. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
