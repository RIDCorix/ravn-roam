export type LocaleKey = "zh-TW" | "en";

export function eventDateLabel(
  event: {
    start_date: string | null;
    end_date: string | null;
    recurring_month_start: number | null;
    recurring_month_end: number | null;
  },
  localeKey: LocaleKey,
): string {
  const start = parseDateOnly(event.start_date);
  const end = parseDateOnly(event.end_date);
  if (start) {
    const safeEnd = end && end >= start ? end : start;
    if (sameDay(start, safeEnd)) return shortDate(start, localeKey);
    if (
      start.getFullYear() === safeEnd.getFullYear() &&
      start.getMonth() === safeEnd.getMonth()
    ) {
      return `${shortDate(start, localeKey)} – ${safeEnd.getDate()}`;
    }
    return `${shortDate(start, localeKey)} – ${shortDate(safeEnd, localeKey)}`;
  }

  if (event.recurring_month_start && event.recurring_month_end) {
    if (event.recurring_month_start === event.recurring_month_end) {
      return localeKey === "en"
        ? monthName(event.recurring_month_start, "en")
        : `${event.recurring_month_start}月`;
    }
    return localeKey === "en"
      ? `${monthName(event.recurring_month_start, "en")} – ${monthName(event.recurring_month_end, "en")}`
      : `${event.recurring_month_start} – ${event.recurring_month_end}月`;
  }

  return localeKey === "en" ? "Seasonal" : "季節";
}

export function deriveBadge(
  event: {
    start_date: string | null;
    recurring_month_start: number | null;
    recurring_month_end: number | null;
  },
  localeKey: LocaleKey,
): string | null {
  if (event.start_date) {
    const d = new Date(event.start_date);
    if (!Number.isNaN(d.getTime())) {
      const m = d.getMonth() + 1;
      return localeKey === "en" ? monthName(m, "en") : `${m} 月`;
    }
  }
  if (event.recurring_month_start && event.recurring_month_end) {
    if (event.recurring_month_start === event.recurring_month_end) {
      return localeKey === "en"
        ? monthName(event.recurring_month_start, "en")
        : `${event.recurring_month_start} 月`;
    }
    return localeKey === "en"
      ? `${monthName(event.recurring_month_start, "en")}–${monthName(event.recurring_month_end, "en")}`
      : `${event.recurring_month_start}-${event.recurring_month_end} 月`;
  }
  return null;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function shortDate(date: Date, localeKey: LocaleKey): string {
  if (localeKey === "en") return `${date.getMonth() + 1}/${date.getDate()}`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function monthName(m: number, locale: LocaleKey): string {
  if (locale === "en") {
    return new Date(2000, m - 1, 1).toLocaleString("en", { month: "short" });
  }
  return `${m}月`;
}

export function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
