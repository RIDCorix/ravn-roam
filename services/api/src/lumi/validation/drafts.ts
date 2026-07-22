import type { LumiDay, LumiTripDraft } from "../contracts/result.js";
import { isRealIsoDate } from "../contracts/date.js";
import { normalizeLumiDayCities } from "../domain/itinerary-values.js";

function dateRange(start: string, end: string): string[] | null {
  if (!isRealIsoDate(start) || !isRealIsoDate(end)) return null;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (endDate < startDate) return null;
  const dates: string[] = [];
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > 60) return null;
  }
  return dates;
}

function hasContent(day: LumiDay): boolean {
  return Boolean(day.city.trim() || normalizeLumiDayCities(day).length || day.note.trim() || (day.stops ?? []).some((stop) => stop.name.trim() || stop.place_name?.trim() || stop.area_name?.trim() || stop.search_query?.trim()));
}

export function normalizeTripDraftCalendar(draft: LumiTripDraft): LumiTripDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      cities: normalizeLumiDayCities(day),
      stops: day.stops ?? [],
    })).sort((a, b) => a.day_date.localeCompare(b.day_date)),
  };
}

export function stagedDraftIssue(draft: LumiTripDraft | null | undefined, stagedDays: LumiDay[]): string | null {
  if (!draft && stagedDays.length === 0) return "No structured trip draft days were staged.";
  const days = stagedDays.length > 0 ? stagedDays : draft?.days ?? [];
  if (!days.every((day) => isRealIsoDate(day.day_date) && hasContent(day))) {
    return "One or more structured trip draft days are empty or invalid.";
  }
  const start = draft?.start_date ?? days[0]?.day_date ?? "";
  const end = draft?.end_date ?? days.at(-1)?.day_date ?? "";
  const requiredDates = dateRange(start, end);
  if (!requiredDates) return "The structured draft calendar range is invalid.";
  const dates = days.map((day) => day.day_date);
  if (new Set(dates).size !== dates.length || requiredDates.length !== dates.length || requiredDates.some((date) => !dates.includes(date))) {
    return "Structured draft days must provide complete contiguous calendar coverage.";
  }
  return null;
}
