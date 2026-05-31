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
export const GANTT_MONTH_HEADER_HEIGHT = 54;
export const GANTT_SEASON_HEADER_HEIGHT = 0;
export const GANTT_HEADER_HEIGHT =
  GANTT_MONTH_HEADER_HEIGHT + GANTT_SEASON_HEADER_HEIGHT;
export const GANTT_ROW_HEIGHT = 56;
export const TIMELINE_MONTH_COUNT = 13;

export interface EventTimelineData {
  months: TimelineMonth[];
  events: TimelineEvent[];
  totalWidth: number;
  chartWidth: number;
  rowCount: number;
  startYear: number;
  startMonth: number;
  todayX: number | null;
}

interface TimelineMonth {
  key: string;
  label: string;
  season: SeasonKey;
  left: number;
  width: number;
  tickLabels: TimelineTickLabel[];
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

interface TimelineTickLabel {
  key: string;
  label: string;
  left: number;
  edge: "start" | "middle" | "end";
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
  now = new Date(),
): EventTimelineData | null {
  const timelineStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const timelineEnd = endOfMonth(
    new Date(timelineStart.getFullYear(), timelineStart.getMonth() + 12, 1),
  );
  const sourceEvents = events
    .map((event) =>
      toTimelineSourceEvent(event, localeKey, eventTypes, timelineStart),
    )
    .filter((event): event is TimelineSourceEvent => event !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (sourceEvents.length === 0) return null;

  const chartWidth = GANTT_MONTH_WIDTH * TIMELINE_MONTH_COUNT;
  const timelineEvents: TimelineEvent[] = [];

  sourceEvents.forEach((event) => {
    if (event.end < timelineStart || event.start > timelineEnd) return;
    const start = clampDate(event.start, timelineStart, timelineEnd);
    const end = clampDate(event.end, timelineStart, timelineEnd);
    const left = dateToTimelineX(start, timelineStart);
    const actualWidth = dateToTimelineEndX(end, timelineStart) - left;
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
    months: buildTimelineMonths(timelineStart, localeKey),
    events: timelineEvents,
    totalWidth: chartWidth,
    chartWidth,
    rowCount: timelineEvents.length,
    startYear: timelineStart.getFullYear(),
    startMonth: timelineStart.getMonth() + 1,
    todayX: now >= timelineStart && now <= timelineEnd
      ? dateToTimelineX(now, timelineStart)
      : null,
  };
}

function buildTimelineMonths(
  timelineStart: Date,
  localeKey: LocaleKey,
): TimelineMonth[] {
  return Array.from({ length: TIMELINE_MONTH_COUNT }, (_, index) => {
    const date = new Date(
      timelineStart.getFullYear(),
      timelineStart.getMonth() + index,
      1,
    );
    const month = date.getMonth() + 1;
    return {
      key: `${date.getFullYear()}-${month}`,
      label: monthName(month, localeKey),
      season: seasonForMonth(month),
      left: index * GANTT_MONTH_WIDTH,
      width: GANTT_MONTH_WIDTH,
      tickLabels: buildTickLabels(date),
    };
  });
}

function buildTickLabels(monthDate: Date): TimelineTickLabel[] {
  const days = daysInMonth(monthDate.getFullYear(), monthDate.getMonth());
  const anchors = [1, 10, 20, days];
  return anchors.map((day) => ({
    key: `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}-${day}`,
    label: String(day),
    left:
      day === days
        ? GANTT_MONTH_WIDTH - 10
        : ((day - 1) / days) * GANTT_MONTH_WIDTH,
    edge: day === 1 ? "start" : day === days ? "end" : "middle",
  }));
}

function dateToTimelineX(date: Date, timelineStart: Date): number {
  const monthOffset = monthDiff(timelineStart, date);
  const month = date.getMonth();
  const days = daysInMonth(date.getFullYear(), month);
  return (
    monthOffset * GANTT_MONTH_WIDTH +
    ((date.getDate() - 1) / days) * GANTT_MONTH_WIDTH
  );
}

function dateToTimelineEndX(date: Date, timelineStart: Date): number {
  const monthOffset = monthDiff(timelineStart, date);
  const month = date.getMonth();
  const days = daysInMonth(date.getFullYear(), month);
  return (
    monthOffset * GANTT_MONTH_WIDTH +
    (date.getDate() / days) * GANTT_MONTH_WIDTH
  );
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function monthDiff(start: Date, date: Date): number {
  return (
    (date.getFullYear() - start.getFullYear()) * 12 +
    (date.getMonth() - start.getMonth())
  );
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
  timelineStart: Date,
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
    let year = timelineStart.getFullYear();
    const start = new Date(year, event.recurring_month_start - 1, 1);
    const endYear =
      event.recurring_month_end < event.recurring_month_start ? year + 1 : year;
    let end = endOfMonth(new Date(endYear, event.recurring_month_end - 1, 1));
    if (end < timelineStart) {
      year += 1;
      start.setFullYear(year);
      end = endOfMonth(
        new Date(
          event.recurring_month_end < event.recurring_month_start
            ? year + 1
            : year,
          event.recurring_month_end - 1,
          1,
        ),
      );
    }
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
