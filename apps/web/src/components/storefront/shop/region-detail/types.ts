export interface ApiEvent {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  subtitle_i18n: Record<string, string>;
  event_type: string;
  region_slug: string;
  suggested_days: number | null;
  suggested_gb: number | null;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  cover_image: string | null;
  tint: string | null;
  badge_override: string | null;
}

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

export interface EventTypeLabels {
  event_types: Record<string, string>;
}
