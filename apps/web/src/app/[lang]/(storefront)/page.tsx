import Image from "next/image";
import { notFound } from "next/navigation";
import { Bell } from "lucide-react";

import { createSupabaseServerClient } from "@roam/shared";

import {
  ListCard,
  SectionHeader,
  TripRow,
  TripTodoCard,
  UserHeader,
} from "@/components/storefront/home-sections";
import {
  HomeSearchPill,
  HomeSearchProvider,
  HomeTrendingCarousel,
} from "@/components/storefront/home/home-search-discovery";
import { PopularDestinationsRail } from "@/components/storefront/home/popular-destinations-rail";
import { SHOP_REGIONS } from "@/lib/storefront-regions";
import { apiToTrip } from "@/lib/trip-mapping";
import { tripCoverUrl } from "@/lib/trip-cover";
import { listChecklists, listTrips, TripApiError } from "@/lib/trips-api";
import type { ApiChecklistItem } from "@/lib/trips-api";

interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

// "Near-term" window for the home-screen todo list. Items due within
// this many days from today are surfaced; everything else (no due
// date, or due far in the future) is hidden from the home preview but
// still visible on the trip detail page.
const TODO_HORIZON_DAYS = 14;

import { getDictionary, hasLocale } from "../dictionaries";

export const dynamic = "force-dynamic";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.home;
  const shopLabels = dict.storefront.shop;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    t.default_name;

  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";
  const [trips, regionStats] = await Promise.all([
    loadRealTrips(),
    loadRegionStats(),
  ]);
  const today = isoDate(new Date());
  const horizonISO = isoDate(
    new Date(Date.now() + TODO_HORIZON_DAYS * 86_400_000),
  );
  const activeTrip =
    trips.find((trip) => trip.start <= today && today <= trip.end) ??
    trips.find((trip) => trip.status === "active") ??
    null;
  const upcoming =
    trips
      .filter((trip) => trip.start > today || trip.status === "upcoming")
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  // Trips with **near-term** incomplete tasks (due within TODO_HORIZON_DAYS).
  // Items without a due date are intentionally excluded from the home
  // preview — they remain visible on the trip detail page. Trips with no
  // qualifying items drop out entirely.
  const tripsWithTodos = trips
    .map((trip) => ({
      ...trip,
      checklist: trip.checklist.filter(
        (item) => !item.done && item.due && item.due <= horizonISO,
      ),
    }))
    .filter((trip) => trip.checklist.length > 0)
    .sort((a, b) => {
      const aActive = activeTrip?.id === a.id ? 0 : 1;
      const bActive = activeTrip?.id === b.id ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.start.localeCompare(b.start);
    });
  return (
    <div className="min-h-full">
      <UserHeader
        name={displayName}
        level={1}
        levelTitle={t.level_title}
        xp={120}
        xpToNext={500}
        right={
          <button
            type="button"
            aria-label={t.notifications_aria}
            className="relative ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-surface-hover"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
              style={{
                background: "var(--accent)",
                boxShadow: "0 0 0 3px var(--bg)",
              }}
            />
          </button>
        }
      />

      <HomeSearchProvider>
      <div className="flex flex-col gap-5 px-5 pt-1 pb-6">
        <HomeSearchPill
          lang={lang}
          localeKey={localeKey}
          stats={regionStats}
          labels={shopLabels}
          placeholder={t.search_placeholder}
          badgeLabel={t.quick_actions.ask_lumi}
        />

        {(activeTrip || upcoming) && (
          <div className="flex flex-col gap-3">
            <SectionHeader title={t.continue_planning} />
            <ListCard>
              {activeTrip && (
                <TripRow
                  href={`/${lang}/trips/${activeTrip.id}`}
                  imageSrc={tripCoverUrl({
                    title: activeTrip.title,
                    cities: activeTrip.days.map((d) => d.city),
                  })}
                  title={activeTrip.title}
                  subtitle={format(t.current_trip_meta, {
                    date: `${activeTrip.start.slice(5)} – ${activeTrip.end.slice(5)}`,
                    tasks: String(
                      activeTrip.checklist.filter((item) => !item.done).length,
                    ),
                  })}
                />
              )}
              {upcoming && (
                <TripRow
                  href={`/${lang}/trips/${upcoming.id}`}
                  imageSrc={tripCoverUrl({
                    title: upcoming.title,
                    cities: upcoming.days.map((d) => d.city),
                  })}
                  title={upcoming.title}
                  subtitle={`${upcoming.start.slice(5)} – ${upcoming.end.slice(5)} · ${format(
                    t.next_trip.label_with_countdown,
                    { days: String(daysUntil(upcoming.start, today)) },
                  )}`}
                />
              )}
            </ListCard>
          </div>
        )}

        {tripsWithTodos.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeader title={t.upcoming_tasks} />
            <div className="flex flex-col gap-3">
              {tripsWithTodos.map((trip) => {
                const incomplete = trip.checklist.filter((item) => !item.done);
                return (
                  <TripTodoCard
                    key={trip.id}
                    trip={trip}
                    lang={lang}
                    href={`/${lang}/trips/${trip.id}`}
                    coverSrc={tripCoverUrl({
                      title: trip.title,
                      cities: trip.days.map((d) => d.city),
                    })}
                    countLabel={format(t.task_count, { count: String(incomplete.length) })}
                    viewAllLabel={format(t.view_all_tasks, {
                      count: String(incomplete.length),
                    })}
                  />
                );
              })}
            </div>
          </div>
        )}

        <HomeTrendingCarousel
          lang={lang}
          localeKey={localeKey}
          labels={shopLabels}
        />

        <PopularDestinationsRail
          lang={lang}
          localeKey={localeKey}
          stats={regionStats}
        />

        {trips.length === 0 && !activeTrip && !upcoming && (
          <div
            className="flex flex-col items-center rounded-2xl bg-surface px-5 pt-4 pb-6 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Image
              src="/illustrations/trip-empty.png"
              alt=""
              width={180}
              height={180}
              className="h-[180px] w-[180px]"
              priority
            />
            <div className="mt-2 text-[16px] font-semibold text-fg">
              {t.empty_primary}
            </div>
            <div className="mt-1 max-w-[260px] text-[13px] text-fg-secondary">
              {t.empty_secondary}
            </div>
          </div>
        )}
      </div>
      </HomeSearchProvider>
    </div>
  );
}

async function loadRegionStats(): Promise<Record<string, RegionStat>> {
  const base = process.env.ROAM_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/storefront/region-stats`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      stats: Array<{ iso: string; plan_count: number; min_retail: number | null }>;
    };
    const byIso = new Map(data.stats.map((s) => [s.iso, s]));
    const out: Record<string, RegionStat> = {};
    for (const region of SHOP_REGIONS) {
      let count = 0;
      let min: number | null = null;
      for (const iso of region.destinations) {
        const s = byIso.get(iso);
        if (!s) continue;
        count = Math.max(count, s.plan_count);
        if (s.min_retail != null) {
          min = min == null ? s.min_retail : Math.min(min, s.min_retail);
        }
      }
      out[region.slug] = { plan_count: count, min_retail: min };
    }
    return out;
  } catch {
    return {};
  }
}

async function loadRealTrips() {
  try {
    const [summaries, checklistItems] = await Promise.all([
      listTrips(),
      listChecklists().catch((err) => {
        // If only the new endpoint fails (e.g. older API), still render
        // summaries — we just lose task text on the home screen.
        if (err instanceof TripApiError && err.status === 404) return [];
        throw err;
      }),
    ]);
    const itemsByTrip = new Map<string, ApiChecklistItem[]>();
    for (const item of checklistItems) {
      const arr = itemsByTrip.get(item.trip_id);
      if (arr) arr.push(item);
      else itemsByTrip.set(item.trip_id, [item]);
    }
    return summaries.map((summary) =>
      apiToTrip(summary, [], itemsByTrip.get(summary.id) ?? []),
    );
  } catch (err) {
    if (err instanceof TripApiError && err.status === 401) return [];
    throw err;
  }
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysUntil(dateISO: string, fromISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${dateISO}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// Tiny i18n templating: replace {key} tokens. Keeps Phase B free of a
// runtime dep; revisit when we need plurals / ICU.
function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
