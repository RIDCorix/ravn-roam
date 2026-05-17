"use client";

// Trip Detail body. Tabs are: 概覽 / 清單 / Day 1 / Day 2 / …
// The tab bar scrolls horizontally so long trips don't break the layout.
// Lumi itself lives at the storefront shell level — when she edits the
// itinerary, she calls router.refresh() and the new trip.days arrive as
// fresh props here.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Image as ImageIcon,
  List,
  Plane,
  Ticket,
  Upload,
} from "lucide-react";

import {
  getUnreadDays,
  markDayRead,
  UNREAD_CHANGED_EVENT,
} from "@/lib/lumi-unread";
import type { ChecklistItem, Trip, TripDay, TripStop } from "@/lib/mock/consumer";
import { refreshTrip } from "@/lib/trip-cache";
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

  // Unread day indices — set by LumiAssistant via localStorage when Lumi
  // edits the itinerary. Reading here renders the yellow dot indicator.
  const [unreadDays, setUnreadDays] = useState<Set<number>>(new Set());
  useEffect(() => {
    setUnreadDays(getUnreadDays(trip.id));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tripId?: string }>).detail;
      if (detail?.tripId && detail.tripId !== trip.id) return;
      setUnreadDays(getUnreadDays(trip.id));
    };
    window.addEventListener(UNREAD_CHANGED_EVENT, handler);
    return () => window.removeEventListener(UNREAD_CHANGED_EVENT, handler);
  }, [trip.id]);

  const selectTab = (next: TabId) => {
    setTab(next);
    const idx = dayIndexFromTab(next);
    if (idx != null && unreadDays.has(idx)) {
      markDayRead(trip.id, idx);
    }
  };

  // When Lumi adds or removes a day, trip.days arrives changed via
  // router.refresh(). Auto-jump to the newly-added tail day; clamp out of
  // a now-invalid day tab.
  const prevLengthRef = useRef(trip.days.length);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const next = trip.days.length;
    if (next > prev) {
      selectTab(`day:${next - 1}`);
    } else if (next < prev) {
      const idx = dayIndexFromTab(tab);
      if (idx != null && idx >= next) setTab("overview");
    }
    prevLengthRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.days.length]);

  return (
    <div>
      <div className="border-b border-divider">
        <div className="flex gap-0 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabButton
            active={tab === "overview"}
            onClick={() => selectTab("overview")}
            label={labels.tabs.overview}
          />
          <TabButton
            active={tab === "checklist"}
            onClick={() => selectTab("checklist")}
            label={labels.tabs.checklist}
            count={pendingCount}
          />
          {trip.days.map((d, i) => (
            <TabButton
              key={i}
              active={tab === `day:${i}`}
              onClick={() => selectTab(`day:${i}`)}
              label={dayShortTemplate.replace("{n}", String(i + 1))}
              count={d.stops?.length ?? 0}
              tone="compact"
              unread={unreadDays.has(i)}
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
            tripId={trip.id}
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
  tripId,
  day,
  prevDay,
  index,
  dayLabelTemplate,
  cities,
}: {
  tripId: string;
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
        {/* Headline = Lumi-written `note` when present; falls back to city
            for unplanned days. City is then shown as a small caption when
            it adds info (i.e. note isn't just the city name). */}
        {(() => {
          const note = day.note?.trim();
          const headline = note || day.city;
          const showCity = note && note !== day.city;
          return (
            <>
              <div className="text-[22px] font-semibold tracking-[-0.01em] text-fg">
                {headline}
              </div>
              {showCity && (
                <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                  {day.city}
                </div>
              )}
            </>
          );
        })()}
        {day.stops && day.stops.length > 0 && (
          <StopsTimeline tripId={tripId} stops={day.stops} />
        )}
      </div>
    </div>
  );
}

type StopsView = "list" | "calendar";
const STOPS_VIEW_KEY = "roam-trip-stops-view";

/* Day stops, in either of two flavors:
     • list — time on the LEFT in a fixed column so each row aligns,
       name + chips on the right. Reads quickly.
     • calendar — Google Calendar-style proportional timeline: hours
       run vertically on the y-axis and each stop is a positioned
       block sized by its real duration.
   Stops missing arrival_time still render in the list flavor and
   appear in an "unscheduled" group at the bottom of the calendar
   flavor — they shouldn't disappear just because Lumi forgot a time. */
function StopsTimeline({
  tripId,
  stops,
}: {
  tripId: string;
  stops: NonNullable<TripDay["stops"]>;
}) {
  const [view, setView] = useState<StopsView>("list");
  // Hydrate the toggle from localStorage after mount so SSR markup
  // stays stable; flip is then persisted across day switches.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STOPS_VIEW_KEY);
    if (saved === "calendar" || saved === "list") setView(saved);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STOPS_VIEW_KEY, view);
  }, [view]);

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === "list" ? (
        <StopsList tripId={tripId} stops={stops} />
      ) : (
        <StopsCalendar tripId={tripId} stops={stops} />
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: StopsView;
  onChange: (v: StopsView) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-full border border-divider bg-white p-0.5 text-fg-muted shadow-xs"
    >
      <ToggleButton
        active={view === "list"}
        onClick={() => onChange("list")}
        label="清單"
        icon={<List className="h-3 w-3" />}
      />
      <ToggleButton
        active={view === "calendar"}
        onClick={() => onChange("calendar")}
        label="行事曆"
        icon={<CalendarClock className="h-3 w-3" />}
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-accent text-white shadow-xs" : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StopsList({
  tripId,
  stops,
}: {
  tripId: string;
  stops: NonNullable<TripDay["stops"]>;
}) {
  return (
    <ol className="relative flex flex-col">
      {/* Rail sits under the bullets, which are at left:64px (after the
          fixed-width time column). */}
      <span className="absolute bottom-3 left-[64px] top-3 w-px bg-divider" />
      {stops.map((s, i) => {
        const startEnd = computeStartEnd(s.arrival_time, s.duration_min);
        return (
          <li key={i} className="relative flex items-start gap-3 py-2">
            {/* Time column — fixed width so every row's bullet lines up. */}
            <div
              className="w-12 shrink-0 pt-1 text-right"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {s.arrival_time ? (
                <>
                  <div className="text-[12px] font-semibold leading-tight text-fg">
                    {startEnd?.start ?? s.arrival_time}
                  </div>
                  {startEnd?.end && (
                    <div className="text-[10.5px] leading-tight text-fg-muted">
                      {startEnd.end}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10.5px] text-fg-muted">—</div>
              )}
            </div>
            <span
              className="relative z-10 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-accent"
              style={{
                boxShadow:
                  "inset 0 0 0 1.5px var(--accent), 0 1px 3px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  <span className="text-[15px] font-semibold leading-tight text-fg">
                    {s.name}
                  </span>
                  <KindChip kind={s.kind} />
                  {s.duration_min ? (
                    <span className="text-[11px] text-fg-muted">
                      · {formatDuration(s.duration_min)}
                    </span>
                  ) : null}
                </div>
                <AttachmentBadges
                  tripId={tripId}
                  stop={s}
                  attachments={s.attachments ?? []}
                />
              </div>
              {s.note ? (
                <div className="text-[13px] leading-relaxed text-fg-secondary">
                  {s.note}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* Proportional day-column. Time axis on the left (one tick per hour),
   stops drawn as positioned blocks whose top + height come from real
   arrival_time + duration_min. Looks like Google Calendar's day view. */
function StopsCalendar({
  tripId,
  stops,
}: {
  tripId: string;
  stops: NonNullable<TripDay["stops"]>;
}) {
  const PX_PER_MIN = 1.2; // → 1 hour = 72px, ~17h visible window ≈ 1224px tall
  const HOUR_PX = PX_PER_MIN * 60;

  type Scheduled = {
    stop: NonNullable<TripDay["stops"]>[number];
    start: number;
    end: number;
    index: number;
  };
  const scheduled: Scheduled[] = [];
  const unscheduled: { stop: NonNullable<TripDay["stops"]>[number]; index: number }[] = [];
  stops.forEach((s, index) => {
    const start = parseMinutes(s.arrival_time);
    if (start == null) {
      unscheduled.push({ stop: s, index });
      return;
    }
    const dur = s.duration_min && s.duration_min > 0 ? s.duration_min : 30;
    scheduled.push({ stop: s, start, end: start + dur, index });
  });

  if (scheduled.length === 0) {
    // Nothing has a real time — fall back to the list view rather than
    // an empty grid.
    return <StopsList tripId={tripId} stops={stops} />;
  }

  const earliest = Math.min(...scheduled.map((s) => s.start));
  const latest = Math.max(...scheduled.map((s) => s.end));
  const startHour = Math.floor(earliest / 60);
  const endHour = Math.ceil(latest / 60);
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  const totalMin = Math.max(60, endMin - startMin);
  const totalPx = totalMin * PX_PER_MIN;
  const hours = endHour - startHour;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative ml-1 overflow-hidden rounded-xl border border-divider bg-surface"
        style={{ height: totalPx + 16 }}
      >
        {/* Hour rows */}
        {Array.from({ length: hours + 1 }).map((_, h) => {
          const top = h * HOUR_PX + 8;
          const label = `${pad2(startHour + h)}:00`;
          return (
            <div
              key={`h-${h}`}
              className="pointer-events-none absolute inset-x-0 flex items-start"
              style={{ top }}
            >
              <span
                className="w-12 shrink-0 pr-2 text-right text-[10.5px] text-fg-muted"
                style={{
                  fontFamily: "var(--font-mono)",
                  transform: "translateY(-6px)",
                }}
              >
                {label}
              </span>
              <span className="mt-0 flex-1 border-t border-divider/70" />
            </div>
          );
        })}
        {/* Stop blocks */}
        {scheduled.map(({ stop, start, end, index }) => {
          const top = (start - startMin) * PX_PER_MIN + 8;
          const height = Math.max(28, (end - start) * PX_PER_MIN - 2);
          return (
            <div
              key={`s-${index}`}
              className="absolute right-2 overflow-hidden rounded-lg border border-accent/40 bg-[rgba(15,184,180,0.08)] px-2 py-1.5"
              style={{ top, height, left: 56 }}
            >
              <div className="flex items-start gap-1.5">
                <span
                  className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-accent"
                  style={{
                    boxShadow: "inset 0 0 0 1.25px var(--accent)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold leading-tight text-fg">
                    {stop.name}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[10.5px] text-fg-muted"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatTimeRange(stop.arrival_time, stop.duration_min) ??
                      stop.arrival_time}
                  </div>
                  <div className="mt-1">
                    <AttachmentBadges
                      tripId={tripId}
                      stop={stop}
                      attachments={stop.attachments ?? []}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="px-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-muted">
            未排定時間
          </div>
          <StopsList tripId={tripId} stops={unscheduled.map((u) => u.stop)} />
        </div>
      )}
    </div>
  );
}

function parseMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const mm = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function computeStartEnd(
  arrival: string | null | undefined,
  durationMin: number | null | undefined,
): { start: string; end: string | null } | null {
  if (!arrival) return null;
  const start = parseMinutes(arrival);
  if (start == null) return { start: arrival, end: null };
  if (!durationMin || durationMin <= 0) {
    return { start: `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`, end: null };
  }
  const total = start + durationMin;
  const eH = Math.floor((total / 60) % 24);
  const eM = total % 60;
  return {
    start: `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`,
    end: `${pad2(eH)}:${pad2(eM)}`,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
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

function AttachmentBadges({
  tripId,
  stop,
  attachments,
  compact,
}: {
  tripId: string;
  stop: TripStop;
  attachments: NonNullable<TripStop["attachments"]>;
  compact?: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {attachments.map((attachment) => (
        <AttachmentIconButton
          key={attachment.id}
          tripId={tripId}
          stop={stop}
          attachment={attachment}
          compact={compact}
        />
      ))}
    </div>
  );
}

function AttachmentIconButton({
  tripId,
  stop,
  attachment,
  compact,
}: {
  tripId: string;
  stop: TripStop;
  attachment: NonNullable<TripStop["attachments"]>[number];
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const done = attachment.done || attachment.status === "uploaded";
  const Icon = ATTACHMENT_ICONS[attachment.type] ?? Ticket;
  const stopId = stop.id;

  function upload(file: File | null) {
    if (!file || !stopId || busy) return;
    startTransition(async () => {
      const imageDataUrl = await readFileAsDataUrl(file);
      const res = await fetch(
        `/api/trips/${tripId}/stops/${stopId}/attachments/${encodeURIComponent(
          attachment.id,
        )}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "uploaded",
            image_name: file.name,
            image_data_url: imageDataUrl,
          }),
        },
      );
      if (res.ok) await refreshTrip(tripId);
    });
  }

  return (
    <label
      title={done ? `${attachment.label}已上傳` : `上傳${attachment.label}`}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border bg-white transition-colors",
        compact ? "h-7 w-7" : "h-8 w-8",
        done
          ? "border-[rgba(22,163,74,0.35)] text-[#15803d]"
          : "border-[rgba(217,119,6,0.36)] text-[#b45309] hover:bg-[rgba(217,119,6,0.08)]",
        busy && "cursor-wait opacity-70",
      )}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {done && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-[0_0_0_2px_white]">
          <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy || !stopId}
        onChange={(e) => {
          upload(e.target.files?.[0] ?? null);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

const ATTACHMENT_ICONS: Record<string, typeof Ticket> = {
  ticket: Ticket,
  reservation: CalendarCheck,
  booking: CalendarCheck,
  flight: Plane,
  transit: Plane,
  upload: Upload,
  document: ImageIcon,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

/* Render a stop's time window. When both arrival + duration are
   concrete we show "09:30 → 11:00"; bare arrival falls back to the
   raw label so legacy data ("morning") still surfaces something. */
function formatTimeRange(
  arrival: string | null | undefined,
  durationMin: number | null | undefined,
): string | null {
  if (!arrival) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(arrival.trim());
  if (!match || !durationMin || durationMin <= 0) return arrival;
  const startH = Number.parseInt(match[1]!, 10);
  const startM = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(startH) || !Number.isFinite(startM)) return arrival;
  const total = startH * 60 + startM + durationMin;
  const endH = Math.floor((total / 60) % 24);
  const endM = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(startH)}:${pad(startM)} → ${pad(endH)}:${pad(endM)}`;
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
  unread,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "compact";
  unread?: boolean;
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
      {unread && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#facc15] shadow-[0_0_0_2px_rgba(250,204,21,0.25)]"
        />
      )}
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
