"use client";

// Trip Detail body. Tabs are: 概覽 / 清單 / Day 1 / Day 2 / …
// The tab bar scrolls horizontally so long trips don't break the layout.
// Lumi itself lives at the storefront shell level — when she edits the
// itinerary, she calls router.refresh() and the new trip.days arrive as
// fresh props here.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { ChecklistItem, Trip, TripDay, TripStop } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

import type { ApiCompanion } from "@/lib/trips-api";

import { ChecklistRow } from "./checklist-row";
import { DailyTimeline } from "./daily-timeline";
import type { TripMapCity } from "./trip-map";

/* Same dynamic import path as DailyTimeline → Next.js dedupes the chunk,
   so the Day-N map shares one bundle with the overview map. */
const TripMap = dynamic(() => import("./trip-map").then((m) => m.TripMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-40 rounded-2xl"
      style={{ background: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)" }}
    />
  ),
});

type TabId = "overview" | "checklist" | `day:${number}`;

export interface TripDetailLabels {
  tabs: {
    overview: string;
    checklist: string;
    // Used for both the tab pill ("Day 1") and the grey caption inside
    // the day view; "{n}" is replaced with the 1-based day number.
    day_short?: string;
  };
  timelineSection: string;
  todayBadge: string;
  dayLabelTemplate: string;
  checklistGroups: {
    suggested: string;
    pending: string;
    done: string;
  };
  shopCta: string;
  emptyChecklist: string;
  assigneeLabels: {
    assign: string;
    assigned_to: string;
    unassigned: string;
  };
}

export function TripDetailTabs({
  trip,
  cities,
  companions,
  lang,
  labels,
}: {
  trip: Trip;
  cities: TripMapCity[];
  companions: ApiCompanion[];
  lang: string;
  labels: TripDetailLabels;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const pendingCount = trip.checklist.filter((t) => !t.done).length;
  const dayShortTemplate = labels.tabs.day_short ?? labels.dayLabelTemplate;

  // When Lumi adds or removes a day, trip.days arrives changed via
  // router.refresh(). Auto-jump to the newly-added tail day; clamp out of
  // a now-invalid day tab.
  const prevLengthRef = useRef(trip.days.length);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const next = trip.days.length;
    if (next > prev) {
      setTab(`day:${next - 1}`);
    } else if (next < prev) {
      const idx = dayIndexFromTab(tab);
      if (idx != null && idx >= next) setTab("overview");
    }
    prevLengthRef.current = next;
  }, [trip.days.length, tab]);

  return (
    <div>
      <div className="border-b border-divider">
        <div className="flex gap-0 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabButton
            active={tab === "overview"}
            onClick={() => setTab("overview")}
            label={labels.tabs.overview}
          />
          <TabButton
            active={tab === "checklist"}
            onClick={() => setTab("checklist")}
            label={labels.tabs.checklist}
            count={pendingCount}
          />
          {trip.days.map((d, i) => (
            <TabButton
              key={i}
              active={tab === `day:${i}`}
              onClick={() => setTab(`day:${i}`)}
              label={dayShortTemplate.replace("{n}", String(i + 1))}
              count={d.stops?.length ?? 0}
              tone="compact"
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 pt-4">
        {tab === "overview" ? (
          <DailyTimeline
            trip={trip}
            cities={cities}
            sectionLabel={labels.timelineSection}
            todayLabel={labels.todayBadge}
            dayLabelTemplate={labels.dayLabelTemplate}
          />
        ) : tab === "checklist" ? (
          <ChecklistView
            items={trip.checklist}
            tripId={trip.id}
            companions={companions}
            lang={lang}
            labels={labels}
          />
        ) : (
          <DayView
            day={trip.days[dayIndexFromTab(tab) ?? 0]}
            prevDay={trip.days[(dayIndexFromTab(tab) ?? 0) - 1]}
            index={dayIndexFromTab(tab) ?? 0}
            dayLabelTemplate={dayShortTemplate}
            cities={cities}
          />
        )}
      </div>
    </div>
  );
}

// ─── Day view ──────────────────────────────────────────────────────────

function DayView({
  day,
  prevDay,
  index,
  dayLabelTemplate,
  cities,
}: {
  day: TripDay | undefined;
  /* Previous day in the itinerary, if any. Used to draw "today's move"
     as a solid segment on the map when prevDay.city !== day.city. */
  prevDay: TripDay | undefined;
  index: number;
  dayLabelTemplate: string;
  cities: TripMapCity[];
}) {
  if (!day) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        ✕
      </div>
    );
  }
  /* Materialize the day's stops for the map. The API always seeds at least
     one stop named after `city` (see migration 0009), but legacy mock data
     might still have undefined — fall back to the city as a single stop. */
  const stops: TripStop[] =
    day.stops && day.stops.length > 0
      ? day.stops
      : [{ name: day.city, kind: "other", lat: null, lng: null }];
  const dayStops: TripMapCity[] = stops.map((s) => ({
    name: s.name,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <TripMap
        cities={cities}
        activeCity={day.city}
        activeLegFrom={prevDay?.city ?? null}
        dayStops={dayStops}
      />
      <div className="flex flex-col gap-3 px-1">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {dayLabelTemplate.replace("{n}", String(index + 1))} · {day.d.slice(5)}
        </div>
        <div className="text-[22px] font-semibold tracking-[-0.01em] text-fg">
          {day.city}
        </div>
        {day.note && (
          <div className="text-[14px] leading-relaxed text-fg-secondary">
            {day.note}
          </div>
        )}
        {day.stops && day.stops.length > 0 && (
          <StopsTimeline stops={day.stops} />
        )}
      </div>
    </div>
  );
}

/* Vertical timeline of stops within a day. Each row: time/kind chip,
   numbered rail bullet, name + duration + note. Mirrors the visual
   language of the trip-overview DailyTimeline but at stop granularity. */
function StopsTimeline({
  stops,
}: {
  stops: NonNullable<TripDay["stops"]>;
}) {
  return (
    <ol className="relative mt-2 flex flex-col gap-3">
      <span className="absolute bottom-2 left-[14px] top-2 w-px bg-divider" />
      {stops.map((s, i) => (
        <li key={i} className="relative flex items-start gap-3">
          <span
            className="relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-accent"
            style={{
              boxShadow:
                "inset 0 0 0 1.5px var(--accent), 0 1px 3px rgba(0,0,0,0.06)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[15px] font-semibold leading-tight text-fg">
                {s.name}
              </span>
              {s.arrival_time ? (
                <span
                  className="rounded-full bg-[rgba(15,184,180,0.10)] px-2 py-[1px] text-[10.5px] font-medium text-accent"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s.arrival_time}
                </span>
              ) : null}
              <KindChip kind={s.kind} />
              {s.duration_min ? (
                <span className="text-[11px] text-fg-muted">
                  · {formatDuration(s.duration_min)}
                </span>
              ) : null}
            </div>
            {s.note ? (
              <div className="text-[13px] leading-relaxed text-fg-secondary">
                {s.note}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  sight: { label: "景點", color: "#2563eb" },
  meal: { label: "用餐", color: "#d97706" },
  transit: { label: "交通", color: "#6b7280" },
  stay: { label: "住宿", color: "#7c3aed" },
  shop: { label: "購物", color: "#db2777" },
  other: { label: "其他", color: "#0fb8b4" },
};

function KindChip({ kind }: { kind: string }) {
  const meta = KIND_LABELS[kind] ?? KIND_LABELS.other!;
  return (
    <span
      className="rounded-full px-2 py-[1px] text-[10px] font-medium"
      style={{
        background: `${meta.color}15`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function dayIndexFromTab(tab: TabId): number | null {
  if (!tab.startsWith("day:")) return null;
  const n = Number.parseInt(tab.slice(4), 10);
  return Number.isFinite(n) ? n : null;
}

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "compact";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 transition-colors duration-150",
        tone === "compact" ? "px-3 text-[12.5px]" : "px-4 text-[13px]",
        active
          ? "border-accent font-semibold text-fg"
          : "border-transparent font-medium text-fg-muted hover:text-fg",
      )}
    >
      {label}
      {count != null && count > 0 && (
        <span
          className={cn(
            "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            active
              ? "bg-accent text-white"
              : "bg-[rgba(0,0,0,0.06)] text-fg-secondary",
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ChecklistView({
  items,
  tripId,
  companions,
  lang,
  labels,
}: {
  items: ChecklistItem[];
  tripId: string;
  companions: ApiCompanion[];
  lang: string;
  labels: TripDetailLabels;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        {labels.emptyChecklist}
      </div>
    );
  }

  const grouped = {
    suggested: items.filter((t) => !t.done && t.suggested),
    pending: items.filter((t) => !t.done && !t.suggested),
    done: items.filter((t) => t.done),
  };

  return (
    <div className="flex flex-col gap-5">
      {grouped.suggested.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.suggested}
          items={grouped.suggested}
          tripId={tripId}
          companions={companions}
          assigneeLabels={labels.assigneeLabels}
          lang={lang}
          shopCta={labels.shopCta}
          tint
        />
      )}
      {grouped.pending.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.pending}
          items={grouped.pending}
          tripId={tripId}
          companions={companions}
          assigneeLabels={labels.assigneeLabels}
          lang={lang}
          shopCta={labels.shopCta}
        />
      )}
      {grouped.done.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.done}
          items={grouped.done}
          tripId={tripId}
          companions={companions}
          assigneeLabels={labels.assigneeLabels}
          lang={lang}
          shopCta={labels.shopCta}
        />
      )}
    </div>
  );
}

function ChecklistGroup({
  label,
  items,
  tripId,
  companions,
  assigneeLabels,
  lang,
  shopCta,
  tint,
}: {
  label: string;
  items: ChecklistItem[];
  tripId: string;
  companions: ApiCompanion[];
  assigneeLabels: TripDetailLabels["assigneeLabels"];
  lang: string;
  shopCta: string;
  tint?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span
          className={cn(
            "text-[12px] font-semibold uppercase tracking-[0.04em]",
            tint ? "text-accent" : "text-fg-secondary",
          )}
        >
          {label}
        </span>
        <span
          className="text-[11px] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            tripId={tripId}
            companions={companions}
            assigneeLabels={assigneeLabels}
            lang={lang}
            tint={tint}
            shopCtaLabel={shopCta}
          />
        ))}
      </div>
    </section>
  );
}
