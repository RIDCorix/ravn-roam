import {
  endOfMonth,
  monthName,
  parseDateOnly,
  sameDay,
  shortDate,
  type LocaleKey,
} from "./date";
import type { ApiEvent, SeasonKey } from "./types";

export const GANTT_MONTH_WIDTH = 128;
export const GANTT_MONTH_HEADER_HEIGHT = 34;
export const GANTT_SEASON_HEADER_HEIGHT = 40;
export const GANTT_HEADER_HEIGHT =
  GANTT_MONTH_HEADER_HEIGHT + GANTT_SEASON_HEADER_HEIGHT;
export const GANTT_ROW_HEIGHT = 62;

export interface EventTimelineData {
  months: TimelineMonth[];
  seasonBands: TimelineSeasonBand[];
  events: TimelineEvent[];
  totalWidth: number;
  chartWidth: number;
  rowCount: number;
  year: number;
}

interface TimelineMonth {
  key: string;
  label: string;
  season: SeasonKey;
  left: number;
  width: number;
}

interface TimelineSeasonBand {
  key: SeasonKey;
  left: number;
  width: number;
  showLabel?: boolean;
}

interface TimelineEvent {
  slug: string;
  title: string;
  eventType: string;
  typeLabel: string;
  left: number;
  width: number;
  row: number;
  dateLabel: string;
}

interface TimelineSourceEvent {
  slug: string;
  title: string;
  eventType: string;
  typeLabel: string;
  start: Date;
  end: Date;
}

export function buildEventTimeline(
  events: ApiEvent[],
  localeKey: LocaleKey,
  eventTypes: Record<string, string>,
): EventTimelineData | null {
  const sourceEvents = events
    .map((event) => toTimelineSourceEvent(event, localeKey, eventTypes))
    .filter((event): event is TimelineSourceEvent => event !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (sourceEvents.length === 0) return null;

  const year = sourceEvents[0].start.getFullYear();
  const timelineStart = new Date(year, 0, 1);
  const timelineEnd = new Date(year, 11, 31);
  const chartWidth = GANTT_MONTH_WIDTH * 12;
  const timelineEvents: TimelineEvent[] = [];

  sourceEvents.forEach((event) => {
    if (event.end < timelineStart || event.start > timelineEnd) return;
    const start = clampDate(event.start, timelineStart, timelineEnd);
    const end = clampDate(event.end, timelineStart, timelineEnd);
    const left = dateToTimelineX(start);
    const actualWidth = dateToTimelineEndX(end) - left;
    const width = Math.min(Math.max(168, actualWidth), chartWidth - left);
    const row = timelineEvents.length;

    timelineEvents.push({
      slug: event.slug,
      title: event.title,
      eventType: event.eventType,
      typeLabel: event.typeLabel,
      left,
      width,
      row,
      dateLabel: timelineDateLabel(event.start, event.end, localeKey),
    });
  });

  return {
    months: buildTimelineMonths(year, localeKey),
    seasonBands: buildTimelineSeasonBands(),
    events: timelineEvents,
    totalWidth: chartWidth,
    chartWidth,
    rowCount: timelineEvents.length,
    year,
  };
}

function buildTimelineMonths(year: number, localeKey: LocaleKey): TimelineMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      key: `${year}-${month}`,
      label: monthName(month, localeKey),
      season: seasonForMonth(month),
      left: index * GANTT_MONTH_WIDTH,
      width: GANTT_MONTH_WIDTH,
    };
  });
}

function buildTimelineSeasonBands(): TimelineSeasonBand[] {
  return [
    { key: "winter", left: 0, width: GANTT_MONTH_WIDTH * 2 },
    { key: "spring", left: GANTT_MONTH_WIDTH * 2, width: GANTT_MONTH_WIDTH * 3 },
    { key: "summer", left: GANTT_MONTH_WIDTH * 5, width: GANTT_MONTH_WIDTH * 3 },
    { key: "autumn", left: GANTT_MONTH_WIDTH * 8, width: GANTT_MONTH_WIDTH * 3 },
    {
      key: "winter",
      left: GANTT_MONTH_WIDTH * 11,
      width: GANTT_MONTH_WIDTH,
      showLabel: false,
    },
  ];
}

function dateToTimelineX(date: Date): number {
  const month = date.getMonth();
  const days = daysInMonth(date.getFullYear(), month);
  return month * GANTT_MONTH_WIDTH + ((date.getDate() - 1) / days) * GANTT_MONTH_WIDTH;
}

function dateToTimelineEndX(date: Date): number {
  const month = date.getMonth();
  const days = daysInMonth(date.getFullYear(), month);
  return month * GANTT_MONTH_WIDTH + (date.getDate() / days) * GANTT_MONTH_WIDTH;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function timelineDateLabel(start: Date, end: Date, localeKey: LocaleKey): string {
  if (sameDay(start, end)) return shortDate(start, localeKey);
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${shortDate(start, localeKey)}-${end.getDate()}`;
  }
  return `${shortDate(start, localeKey)}-${shortDate(end, localeKey)}`;
}

function toTimelineSourceEvent(
  event: ApiEvent,
  localeKey: LocaleKey,
  eventTypes: Record<string, string>,
): TimelineSourceEvent | null {
  const title =
    event.title_i18n?.[localeKey] ?? event.title_i18n?.["zh-TW"] ?? event.slug;
  const typeLabel = eventTypes[event.event_type] ?? event.event_type;
  const explicitStart = parseDateOnly(event.start_date);
  const explicitEnd = parseDateOnly(event.end_date);

  if (explicitStart) {
    const end = explicitEnd && explicitEnd >= explicitStart
      ? explicitEnd
      : explicitStart;
    return {
      slug: event.slug,
      title,
      eventType: event.event_type,
      typeLabel,
      start: explicitStart,
      end,
    };
  }

  if (event.recurring_month_start && event.recurring_month_end) {
    const year = new Date().getFullYear();
    const start = new Date(year, event.recurring_month_start - 1, 1);
    const endYear =
      event.recurring_month_end < event.recurring_month_start ? year + 1 : year;
    const end = endOfMonth(new Date(endYear, event.recurring_month_end - 1, 1));
    return {
      slug: event.slug,
      title,
      eventType: event.event_type,
      typeLabel,
      start,
      end,
    };
  }

  return null;
}

function seasonForMonth(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}
