// First-time user setup: if the auth'd user has no trips in the DB,
// create the same set the design mocks ship with so the storefront has
// something visible the moment they log in. Idempotent — running again
// is a no-op once trips exist.

import { TRIPS as MOCK_TRIPS } from "@/lib/mock/consumer";
import { addDays, isoDate } from "@/lib/date";
import { createTrip, listTrips, type ApiTrip } from "@/lib/trips-api";

export async function ensureSeededTrips(): Promise<ApiTrip[]> {
  const existing = await listTrips();
  if (existing.length > 0) return existing;

  // Rebase mock dates so the "active" trip overlaps today — without this
  // every seeded trip looks like ancient history when seeded in 2026.
  const today = isoDate(new Date());

  const created: ApiTrip[] = [];
  for (const mock of MOCK_TRIPS) {
    const rebasedDays =
      mock.status === "active"
        ? rebaseActive(mock.days, today)
        : mock.status === "upcoming"
          ? rebaseUpcoming(mock.days, today, mock.id)
          : mock.days;

    const start =
      rebasedDays[0]?.d ?? rebaseStart(mock.start, mock.status, today, mock.id);
    const end =
      rebasedDays[rebasedDays.length - 1]?.d ??
      rebaseEnd(mock.end, mock.status, today, mock.id);

    const trip = await createTrip({
      title: mock.title,
      cover: mock.cover,
      start_date: start,
      end_date: end,
      status: mock.status === "active" ? "active" : mock.status,
      days: rebasedDays.map((d) => ({
        day_date: d.d,
        city: d.city,
        note: d.note,
      })),
      checklist: mock.checklist.map((c) => ({
        text: c.text,
        kind: c.kind,
        done: c.done,
        suggested: c.suggested ?? false,
        suggested_by: c.suggestedBy ?? null,
        shortcut: c.shortcut ?? null,
        shop_filter:
          (c.shopFilter as Record<string, unknown> | undefined) ?? null,
        due_date: c.due ?? null,
      })),
    });
    created.push(trip);
  }

  return created;
}

function rebaseActive(
  days: { d: string; city: string; note: string }[],
  today: string,
): { d: string; city: string; note: string }[] {
  // Place the trip so today lands ~halfway through it.
  const total = days.length;
  if (total === 0) return days;
  const todayIdx = Math.floor(total / 2);
  const newStart = addDays(today, -todayIdx);
  return days.map((d, i) => ({ ...d, d: addDays(newStart, i) }));
}

function rebaseUpcoming(
  days: { d: string; city: string; note: string }[],
  today: string,
  tripId: string,
): { d: string; city: string; note: string }[] {
  // First upcoming trip starts in ~2 weeks; second in ~6 weeks.
  const offset = tripId.includes("seoul") ? 45 : 14;
  const newStart = addDays(today, offset);
  return days.map((d, i) => ({ ...d, d: addDays(newStart, i) }));
}

function rebaseStart(
  fallback: string,
  status: string,
  today: string,
  tripId: string,
): string {
  if (status === "active") return today;
  if (status === "upcoming")
    return addDays(today, tripId.includes("seoul") ? 45 : 14);
  return fallback;
}

function rebaseEnd(
  fallback: string,
  status: string,
  today: string,
  _tripId: string,
): string {
  if (status === "active") return addDays(today, 3);
  return fallback;
}
