// Server-side resolver that assembles "what does Lumi need to know about
// the user right now". Computed once per storefront layout render and
// passed down to the floating LumiAssistant so every turn — on every
// tab — carries the same situational awareness.
//
// Sources today:
//   * active_trip  — first trip whose [start_date, end_date] covers today
//   * today_tasks  — that active trip's checklist (done + open + due dates)
//   * active_esim  — mock data from consumer.ts; the real eSIM activation
//                    flow doesn't exist yet, so this is curated for the
//                    seeded user. Drop to `null` if no real session info
//                    is available.

import { ACTIVE_ESIM, USER } from "@/lib/mock/consumer";
import { isoDate } from "@/lib/date";
import { getTrip, listTrips, TripApiError } from "@/lib/trips-api";

export interface LumiContextActiveTrip {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  days_total: number;
  today_index: number | null;
  today_city: string | null;
  today_note: string | null;
}

export interface LumiContextESIM {
  country_name: string;
  plan: string;
  used_gb: number;
  total_gb: number;
  days_left: number;
  days_total: number;
  network: string;
  signal: number;
  speed: string;
}

export interface LumiContextTaskItem {
  text: string;
  done: boolean;
  kind: string;
  due_date: string | null;
  suggested: boolean;
}

export interface LumiContextTodayTasks {
  trip_id: string;
  total: number;
  done: number;
  items: LumiContextTaskItem[];
}

export interface LumiContext {
  current_date: string;
  user_name: string | null;
  active_trip: LumiContextActiveTrip | null;
  active_esim: LumiContextESIM | null;
  today_tasks: LumiContextTodayTasks | null;
}

export async function getLumiContext(): Promise<LumiContext> {
  const today = isoDate(new Date());
  const ctx: LumiContext = {
    current_date: today,
    user_name: USER.name,
    active_trip: null,
    active_esim: null,
    today_tasks: null,
  };

  try {
    const trips = await listTrips();
    const active =
      trips.find((t) => t.start_date <= today && today <= t.end_date) ?? null;
    if (active) {
      const detail = await getTrip(active.id);
      const sortedDays = [...detail.days].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      const todayIdx = sortedDays.findIndex((d) => d.day_date === today);
      ctx.active_trip = {
        id: active.id,
        title: active.title,
        start_date: active.start_date,
        end_date: active.end_date,
        days_total: sortedDays.length,
        today_index: todayIdx >= 0 ? todayIdx : null,
        today_city: todayIdx >= 0 ? sortedDays[todayIdx]!.city : null,
        today_note: todayIdx >= 0 ? sortedDays[todayIdx]!.note : null,
      };
      ctx.today_tasks = {
        trip_id: active.id,
        total: detail.checklist.length,
        done: detail.checklist.filter((c) => c.done).length,
        items: detail.checklist.map((c) => ({
          text: c.text,
          done: c.done,
          kind: c.kind,
          due_date: c.due_date,
          suggested: c.suggested,
        })),
      };

      // Mock eSIM: only surface it if the active trip is in Japan, since
      // that's what the seeded ACTIVE_ESIM describes. Real activation
      // state will replace this once the eSIM flow is built.
      const looksJP =
        active.title.includes("東京") ||
        active.title.includes("京都") ||
        active.title.includes("日本") ||
        active.title.toLowerCase().includes("jp");
      if (looksJP) {
        ctx.active_esim = {
          country_name: ACTIVE_ESIM.countryName,
          plan: ACTIVE_ESIM.plan,
          used_gb: ACTIVE_ESIM.used,
          total_gb: ACTIVE_ESIM.total,
          days_left: ACTIVE_ESIM.daysLeft,
          days_total: ACTIVE_ESIM.daysTotal,
          network: ACTIVE_ESIM.network,
          signal: ACTIVE_ESIM.signal,
          speed: ACTIVE_ESIM.speed,
        };
      }
    }
  } catch (err) {
    // Unauthenticated, network blip, etc. — best-effort context, never
    // block the page render.
    if (!(err instanceof TripApiError)) {
      console.error("[lumi-context] failed to assemble", err);
    }
  }

  return ctx;
}
