"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  MapPin,
  MoreHorizontal,
  Plane,
  Plus,
  Share2,
  Sparkles,
  TrainFront,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  StorefrontTabs,
  StorefrontTabsList,
  StorefrontTabsTrigger,
} from "@/components/storefront/storefront-tabs";
import { cn } from "@/lib/utils";
import type { TripMapCity } from "./trip-map";

const LOCAL_TRIP_KEY = "roam.localTripDraft.v1";

type LocalTripDraft = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  progress: number;
  cover: string;
  sourcePrompt?: string;
  lumiDraft?: LocalLumiDraft | null;
};

type LocalLumiDraft = {
  title: string;
  start_date: string;
  end_date: string;
  cover?: string | null;
  days: LocalLumiDay[];
  checklist?: LocalChecklistItem[];
};

type LocalLumiDay = {
  day_date: string;
  city: string;
  note: string;
  stops?: LocalStop[];
};

type LocalStop = {
  name: string;
  kind?: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
};

type LocalChecklistItem = {
  text: string;
  description?: string | null;
  kind: string;
  start_date?: string | null;
  phase?: string | null;
  group_label?: string | null;
  suggested?: boolean | null;
};

export type LocalTripDetailLabels = {
  not_found_title: string;
  not_found_body: string;
  back_to_trips: string;
  share: string;
  export_trip: string;
  collaborative: string;
  route_preview: string;
  route_budget: string;
  daily_itinerary: string;
  overview_label: string;
  fly_to: string;
  stay_in: string;
  day_label: string;
  day_unit: string;
  no_stops: string;
  edit_title: string;
  more: string;
  tabs: {
    todos: string;
    notes: string;
    budget: string;
    lumi: string;
  };
  add_item: string;
  todo_count: string;
  sections: {
    preparation: string;
    transport: string;
    stay: string;
    sights: string;
  };
  fallback_items: {
    passport: string;
    esim: string;
    stay: string;
    places: string;
  };
  kind: Record<string, string>;
  notes_empty: string;
  budget_empty: string;
  lumi_prompt: string;
};

type ActiveItineraryView = "overview" | number;

const STOP_IMAGES = [
  "/illustrations/cities/paris.jpg",
  "/illustrations/cities/taipei.jpg",
  "/illustrations/cities/kyoto.jpg",
  "/illustrations/cities/singapore.jpg",
  "/illustrations/cities/new-york.jpg",
  "/illustrations/cities/rome.jpg",
];

const LeafletTripMap = dynamic(
  () => import("./trip-map").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[linear-gradient(135deg,#dff4f2,#efe7d9)]" />
    ),
  },
);

export function LocalTripDetailPage({
  lang,
  tripId,
  labels,
}: {
  lang: string;
  tripId: string;
  labels: LocalTripDetailLabels;
}) {
  const [draft, setDraft] = useState<LocalTripDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<ActiveItineraryView>("overview");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const local = readLocalDraft();
      setDraft(local && (local.id === tripId || tripId === "local") ? local : null);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const model = useMemo(
    () => (draft ? buildTripModel(draft, labels) : null),
    [draft, labels],
  );

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#fbfaf7] px-5 pt-28 sm:px-8">
        <div className="mx-auto h-[620px] max-w-[1500px] animate-pulse rounded-[28px] bg-white/70" />
      </div>
    );
  }

  if (!draft || !model) {
    return (
      <div className="min-h-screen bg-[#fbfaf7] px-5 pt-28 text-fg sm:px-8">
        <div className="mx-auto max-w-[720px] rounded-[28px] border border-divider bg-white p-8 text-center shadow-[0_24px_70px_-48px_rgba(32,41,46,0.55)]">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em]">
            {labels.not_found_title}
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-fg-muted">
            {labels.not_found_body}
          </p>
          <Button asChild className="mt-6 rounded-xl bg-fg text-white">
            <Link href={`/${lang}/trips`}>{labels.back_to_trips}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeDayIndex = typeof activeView === "number"
    ? Math.min(activeView, model.days.length - 1)
    : null;
  const selectedDay = activeDayIndex == null ? null : model.days[activeDayIndex];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfaf7_0%,#f6f3ed_100%)] px-5 pb-10 pt-28 text-fg sm:px-8">
      <div className="mx-auto grid max-w-[1540px] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0">
          <TripHeader
            lang={lang}
            model={model}
            labels={labels}
          />
          <RouteMap days={model.days} activeView={activeView} labels={labels} />
          <DailyItinerary
            days={model.days}
            activeView={activeView}
            onActiveViewChange={setActiveView}
            selectedDay={selectedDay}
            labels={labels}
          />
        </main>

        <TripSidePanel
          checklist={model.checklist}
          notes={model.notes}
          labels={labels}
        />
      </div>
    </div>
  );
}

function TripHeader({
  lang,
  model,
  labels,
}: {
  lang: string;
  model: TripModel;
  labels: LocalTripDetailLabels;
}) {
  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Link
          href={`/${lang}/trips`}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" />
          {labels.back_to_trips}
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[34px] font-semibold tracking-[-0.03em] text-fg sm:text-[42px]">
            {model.title}
          </h1>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-white"
            aria-label={labels.edit_title}
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[15px] font-medium text-fg-muted">
          <span>
            {model.startDate} - {model.endDate} ({model.days.length}{" "}
            {labels.day_unit})
          </span>
          <span className="rounded-full bg-surface px-3 py-1 text-[12px]">
            {labels.collaborative}
          </span>
          <AvatarStack />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="h-11 rounded-xl bg-white">
          <Share2 className="h-4 w-4" />
          {labels.share}
        </Button>
        <Button className="h-11 rounded-xl bg-accent px-5 text-white hover:bg-accent/90">
          <Plane className="h-4 w-4" />
          {labels.export_trip}
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="h-11 w-11 rounded-xl"
          aria-label={labels.more}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

function RouteMap({
  days,
  activeView,
  labels,
}: {
  days: TripDayModel[];
  activeView: ActiveItineraryView;
  labels: LocalTripDetailLabels;
}) {
  const activeDayIndex = typeof activeView === "number"
    ? Math.min(activeView, days.length - 1)
    : null;
  const selectedDay = activeDayIndex == null ? null : days[activeDayIndex];
  const routePoints = activeView === "overview"
    ? buildRoutePoints(days)
    : selectedDay
      ? [dayToRoutePoint(selectedDay, activeDayIndex ?? 0)]
      : [];
  const mapCities = routePoints.map((point, index) => ({
    name: point.city,
    lat: point.lat,
    lng: point.lng,
    label: String(index + 1),
    date: point.dateLabel,
  })) satisfies TripMapCity[];
  const dayStops = selectedDay
    ? selectedDay.stops.map((stop, index) => ({
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        label: String(index + 1),
        date: stop.arrival_time ?? labels.kind[stop.kind ?? "other"] ?? labels.kind.other,
      }))
    : undefined;
  const hasLocatedCities = mapCities.some((city) => city.lat != null && city.lng != null);

  return (
    <section className="relative mt-5 h-[330px] overflow-hidden rounded-[24px] border border-white/80 bg-[#efe7d9] shadow-[0_24px_80px_-58px_rgba(32,41,46,0.5)]">
      {hasLocatedCities ? (
        <div className="roam-detail-route-map absolute inset-0">
          <LeafletTripMap
            cities={mapCities}
            activeCity={selectedDay?.city ?? null}
            activeLegFrom={
              activeDayIndex != null && activeDayIndex > 0
                ? days[activeDayIndex - 1]?.city ?? null
                : null
            }
            dayStops={dayStops}
          />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 opacity-75 [background-image:radial-gradient(circle_at_20%_30%,rgba(15,184,180,0.12),transparent_22%),radial-gradient(circle_at_82%_42%,rgba(224,122,63,0.12),transparent_22%),linear-gradient(120deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48))]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(39,58,63,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(39,58,63,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 18 50 C 28 20, 38 20, 43 24 S 56 53, 62 45 S 68 63, 76 62 S 58 77, 50 68 S 33 62, 30 35"
              fill="none"
              stroke="rgba(39,58,63,0.45)"
              strokeDasharray="1.7 1.3"
              strokeWidth="0.55"
            />
          </svg>
        </>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.62),transparent_24%,transparent_76%,rgba(255,255,255,0.38)),linear-gradient(180deg,rgba(255,255,255,0.2),transparent_24%,rgba(255,255,255,0.16))]" />
      <div className="absolute right-5 top-5 rounded-2xl bg-white/88 px-4 py-2 text-[13px] font-semibold text-fg shadow-sm backdrop-blur">
        {labels.route_budget}
      </div>
      <div className="absolute left-5 top-5 rounded-2xl bg-white/80 px-4 py-2 text-[13px] font-semibold text-fg-muted backdrop-blur">
        {labels.route_preview}
      </div>
      {activeView === "overview" && routePoints.length > 1 ? (
        <Plane className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-[24deg] text-fg-muted" />
      ) : null}
      <style jsx global>{`
        .roam-detail-route-map .roam-trip-map {
          height: 330px;
          border-radius: 24px;
        }
      `}</style>
    </section>
  );
}

function DailyItinerary({
  days,
  activeView,
  onActiveViewChange,
  selectedDay,
  labels,
}: {
  days: TripDayModel[];
  activeView: ActiveItineraryView;
  onActiveViewChange: (view: ActiveItineraryView) => void;
  selectedDay: TripDayModel | null;
  labels: LocalTripDetailLabels;
}) {
  const activeDay = typeof activeView === "number" ? activeView : 0;
  return (
    <section className="mt-7">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">
        {labels.daily_itinerary}
      </h2>
      <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="h-[68px] w-12 shrink-0 rounded-xl bg-white"
          onClick={() => {
            if (activeView === "overview") return;
            onActiveViewChange(activeDay === 0 ? "overview" : Math.max(0, activeDay - 1));
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={() => onActiveViewChange("overview")}
          className={cn(
            "h-[68px] min-w-[138px] rounded-xl border bg-white px-5 text-center transition-colors",
            activeView === "overview"
              ? "border-accent text-accent shadow-sm"
              : "border-divider text-fg-secondary hover:border-accent/40",
          )}
        >
          <span className="block text-[13px] font-bold uppercase">
            {labels.overview_label}
          </span>
          <span className="mt-1 block text-[13px] font-semibold">
            {shortDate(days[0]?.date ?? "")} - {shortDate(days.at(-1)?.date ?? "")}
          </span>
        </button>
        {days.map((day, index) => (
          <button
            key={`${day.date}-${index}`}
            type="button"
            onClick={() => onActiveViewChange(index)}
            className={cn(
              "h-[68px] min-w-[138px] rounded-xl border bg-white px-5 text-center transition-colors",
              activeView === index
                ? "border-accent text-accent shadow-sm"
                : "border-divider text-fg-secondary hover:border-accent/40",
            )}
          >
            <span className="block text-[13px] font-bold uppercase">
              {formatTemplate(labels.day_label, { n: String(index + 1) })}
            </span>
            <span className="mt-1 block text-[13px] font-semibold">
              {shortDate(day.date)}
            </span>
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="h-[68px] w-12 shrink-0 rounded-xl bg-white"
          onClick={() =>
            onActiveViewChange(
              activeView === "overview" ? 0 : Math.min(days.length - 1, activeDay + 1),
            )
          }
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {activeView === "overview" ? (
        <OverviewTimeline days={days} labels={labels} />
      ) : selectedDay ? (
        <Timeline day={selectedDay} labels={labels} />
      ) : null}
    </section>
  );
}

function OverviewTimeline({
  days,
  labels,
}: {
  days: TripDayModel[];
  labels: LocalTripDetailLabels;
}) {
  const segments = buildRoutePoints(days);
  if (segments.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-divider-strong bg-white/70 p-8 text-center text-[14px] text-fg-muted">
        {labels.no_stops}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[22px] border border-white/70 bg-white/70 p-4 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.45)]">
      {segments.map((segment, index) => {
        const previous = segments[index - 1];
        const isTransfer = previous && previous.city !== segment.city;
        return (
          <div
            key={`${segment.city}-${segment.dateLabel}-${index}`}
            className="grid grid-cols-[82px_42px_minmax(0,1fr)] gap-3"
          >
            <div className="pt-4 text-[14px] font-semibold text-fg-secondary">
              {segment.dateLabel}
            </div>
            <div className="relative flex justify-center">
              <div className="absolute bottom-0 top-0 w-px bg-divider" />
              <span className={cn(
                "relative mt-4 grid h-8 w-8 place-items-center rounded-full text-white",
                routeColor(index),
              )}>
                {isTransfer ? <Plane className="h-4 w-4" /> : index + 1}
              </span>
            </div>
            <article className="mb-3 rounded-2xl border border-divider bg-white p-4 shadow-sm">
              <p className="text-[16px] font-semibold text-fg">
                {formatTemplate(isTransfer ? labels.fly_to : labels.stay_in, {
                  city: segment.city,
                })}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-fg-muted">
                {segment.days
                  .map((dayIndex) =>
                    formatTemplate(labels.day_label, { n: String(dayIndex + 1) }),
                  )
                  .join(" · ")}
              </p>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({
  day,
  labels,
}: {
  day: TripDayModel;
  labels: LocalTripDetailLabels;
}) {
  if (day.stops.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-divider-strong bg-white/70 p-8 text-center text-[14px] text-fg-muted">
        {labels.no_stops}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[22px] border border-white/70 bg-white/70 p-4 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.45)]">
      {day.stops.map((stop, index) => {
        const Icon = iconForKind(stop.kind);
        return (
          <div
            key={`${stop.name}-${index}`}
            className="grid grid-cols-[68px_42px_minmax(0,1fr)] gap-3"
          >
            <div className="pt-4 text-[15px] font-semibold text-fg-secondary">
              {stop.arrival_time ?? timeForStop(index)}
            </div>
            <div className="relative flex justify-center">
              <div className="absolute bottom-0 top-0 w-px bg-divider" />
              <span className={cn(
                "relative mt-4 grid h-8 w-8 place-items-center rounded-full text-white",
                routeColor(index),
              )}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <article className="mb-3 flex min-w-0 items-center gap-4 rounded-2xl border border-divider bg-white p-3 shadow-sm">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-accent-softer">
                <Image
                  src={STOP_IMAGES[index % STOP_IMAGES.length]}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-semibold text-fg">
                  {stop.name}
                </h3>
                <p className="mt-1 line-clamp-1 text-[13px] text-fg-muted">
                  {stop.note || day.note || day.city}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent">
                  {labels.kind[stop.kind ?? "other"] ?? labels.kind.other}
                </span>
                {stop.duration_min ? (
                  <p className="mt-2 text-[12px] text-fg-muted">
                    {Math.round(stop.duration_min / 60)}h
                  </p>
                ) : null}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function TripSidePanel({
  checklist,
  notes,
  labels,
}: {
  checklist: ChecklistGroup[];
  notes: string[];
  labels: LocalTripDetailLabels;
}) {
  return (
    <aside className="min-w-0 rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_70px_-50px_rgba(32,41,46,0.55)] backdrop-blur-xl xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <StorefrontTabs defaultValue="todos">
        <StorefrontTabsList className="h-12 w-full justify-between">
          <StorefrontTabsTrigger value="todos">
            {labels.tabs.todos}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="notes">
            {labels.tabs.notes}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="budget">
            {labels.tabs.budget}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="lumi">
            <Sparkles className="h-4 w-4" />
            {labels.tabs.lumi}
          </StorefrontTabsTrigger>
        </StorefrontTabsList>
      </StorefrontTabs>

      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-accent/40 bg-white text-accent"
        >
          <Plus className="h-4 w-4" />
          {labels.add_item}
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {checklist.map((group) => (
          <section
            key={group.title}
            className="rounded-2xl border border-divider bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  group.tint,
                )}>
                  <group.Icon className="h-5 w-5" />
                </span>
                <h2 className="text-[16px] font-semibold text-fg">
                  {group.title}
                </h2>
                <span className="text-[13px] font-semibold text-fg-muted">
                  {formatTemplate(labels.todo_count, {
                    done: String(group.done),
                    total: String(group.items.length),
                  })}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-fg-muted" />
            </div>
            <div className="mt-3 space-y-3">
              {group.items.map((item, index) => (
                <label
                  key={`${item.text}-${index}`}
                  className="flex items-start gap-3 text-[14px] leading-6 text-fg-secondary"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                      index < group.done
                        ? "border-accent bg-accent text-white"
                        : "border-divider-strong bg-white text-transparent",
                    )}
                  >
                    {index < group.done ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span>{item.text}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        <InfoCard icon={CalendarDays} title={labels.tabs.notes} body={notes[0] ?? labels.notes_empty} />
        <InfoCard icon={WalletCards} title={labels.tabs.budget} body={labels.budget_empty} />
        <InfoCard icon={Sparkles} title={labels.tabs.lumi} body={labels.lumi_prompt} />
      </div>
    </aside>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-2xl border border-divider bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-fg-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}

function AvatarStack() {
  return (
    <div className="flex -space-x-2">
      {[0, 1, 2].map((item) => (
        <span
          key={item}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white",
            item === 0 && "bg-[#2c7188]",
            item === 1 && "bg-[#c37f61]",
            item === 2 && "bg-[#3a8f78]",
          )}
        >
          {item + 1}
        </span>
      ))}
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-surface text-[12px] font-semibold text-fg-muted">
        +2
      </span>
    </div>
  );
}

type TripModel = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: TripDayModel[];
  checklist: ChecklistGroup[];
  notes: string[];
};

type TripDayModel = {
  date: string;
  city: string;
  lat: number | null;
  lng: number | null;
  note: string;
  stops: Array<
    Required<Pick<LocalStop, "name">> &
      Pick<LocalStop, "kind" | "arrival_time" | "duration_min" | "note"> & {
        lat: number | null;
        lng: number | null;
      }
  >;
};

type RoutePoint = {
  city: string;
  lat: number | null;
  lng: number | null;
  dateLabel: string;
  days: number[];
};

type ChecklistGroup = {
  title: string;
  done: number;
  items: { text: string; kind: string }[];
  tint: string;
  Icon: LucideIcon;
};

const PLACE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  berlin: { lat: 52.52, lng: 13.405 },
  boston: { lat: 42.3601, lng: -71.0589 },
  brussels: { lat: 50.8503, lng: 4.3517 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  europe: { lat: 48.8566, lng: 10.4515 },
  hongkong: { lat: 22.3193, lng: 114.1694 },
  interlaken: { lat: 46.6863, lng: 7.8632 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  london: { lat: 51.5072, lng: -0.1276 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  milan: { lat: 45.4642, lng: 9.19 },
  munich: { lat: 48.1351, lng: 11.582 },
  newyork: { lat: 40.7128, lng: -74.006 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  paris: { lat: 48.8566, lng: 2.3522 },
  pisa: { lat: 43.7228, lng: 10.4017 },
  prague: { lat: 50.0755, lng: 14.4378 },
  reykjavik: { lat: 64.1466, lng: -21.9426 },
  rome: { lat: 41.9028, lng: 12.4964 },
  seoul: { lat: 37.5665, lng: 126.978 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  taipei: { lat: 25.033, lng: 121.5654 },
  taiwan: { lat: 23.6978, lng: 120.9605 },
  taoyuanairport: { lat: 25.0797, lng: 121.2342 },
  tokyo: { lat: 35.6764, lng: 139.65 },
  venice: { lat: 45.4408, lng: 12.3155 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  京都: { lat: 35.0116, lng: 135.7681 },
  台北: { lat: 25.033, lng: 121.5654 },
  台灣: { lat: 23.6978, lng: 120.9605 },
  台灣桃園國際機場: { lat: 25.0797, lng: 121.2342 },
  桃園國際機場: { lat: 25.0797, lng: 121.2342 },
  桃園機場: { lat: 25.0797, lng: 121.2342 },
  巴黎: { lat: 48.8566, lng: 2.3522 },
  巴黎戴高樂機場: { lat: 49.0097, lng: 2.5479 },
  布拉格: { lat: 50.0755, lng: 14.4378 },
  布達佩斯: { lat: 47.4979, lng: 19.0402 },
  新加坡: { lat: 1.3521, lng: 103.8198 },
  東京: { lat: 35.6764, lng: 139.65 },
  比薩: { lat: 43.7228, lng: 10.4017 },
  義大利: { lat: 41.9028, lng: 12.4964 },
  米蘭: { lat: 45.4642, lng: 9.19 },
  米蘭馬爾彭薩機場: { lat: 45.63, lng: 8.7231 },
  維也納: { lat: 48.2082, lng: 16.3738 },
  羅馬: { lat: 41.9028, lng: 12.4964 },
  蘇黎世: { lat: 47.3769, lng: 8.5417 },
  威尼斯: { lat: 45.4408, lng: 12.3155 },
  歐洲: { lat: 48.8566, lng: 10.4515 },
};

function buildTripModel(
  draft: LocalTripDraft,
  labels: LocalTripDetailLabels,
): TripModel {
  const source = draft.lumiDraft;
  const days =
    source?.days?.length
      ? source.days.map((day) => ({
          date: day.day_date,
          city: day.city,
          ...coordinatesForPlace(day.city, draft.destination),
          note: day.note,
          stops: (day.stops ?? []).map((stop) => ({
            name: stop.name,
            kind: normalizeKind(stop.kind),
            arrival_time: stop.arrival_time,
            duration_min: stop.duration_min,
            note: stop.note,
            ...coordinatesForPlace(stop.name, day.city),
          })),
        }))
      : buildFallbackDays(draft);

  return {
    id: draft.id,
    title: source?.title ?? draft.title,
    destination: draft.destination,
    startDate: source?.start_date ?? draft.startDate,
    endDate: source?.end_date ?? draft.endDate,
    days,
    checklist: buildChecklistGroups(source?.checklist ?? [], labels),
    notes: [
      draft.sourcePrompt ? draft.sourcePrompt : days.map((day) => day.note).find(Boolean) ?? "",
    ].filter(Boolean),
  };
}

function coordinatesForPlace(
  primary: string,
  fallback?: string,
): { lat: number | null; lng: number | null } {
  const candidates = [primary, fallback ?? ""]
    .flatMap((value) => [value, ...value.split(/[,\s、，/→>到]+/)])
    .map(normalizePlaceToken)
    .filter(Boolean);
  for (const candidate of candidates) {
    const exact = PLACE_COORDINATES[candidate];
    if (exact) return exact;
    const fuzzyKey = Object.keys(PLACE_COORDINATES).find(
      (key) => candidate.includes(key) || key.includes(candidate),
    );
    if (fuzzyKey) return PLACE_COORDINATES[fuzzyKey]!;
  }
  return { lat: null, lng: null };
}

function normalizePlaceToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.'-]+/g, "");
}

function buildFallbackDays(draft: LocalTripDraft): TripDayModel[] {
  const dates = enumerateDates(draft.startDate, draft.endDate).slice(0, 14);
  return dates.map((date, index) => ({
    date,
    city: draft.destination,
    ...coordinatesForPlace(draft.destination),
    note: index === 0 ? draft.destination : "",
    stops: [],
  }));
}

function buildRoutePoints(days: TripDayModel[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const [index, day] of days.entries()) {
    const previous = points.at(-1);
    if (previous && normalizePlaceToken(previous.city) === normalizePlaceToken(day.city)) {
      previous.days.push(index);
      previous.dateLabel = formatDateRange(days[previous.days[0]]!.date, day.date);
      continue;
    }
    points.push({
      city: day.city,
      lat: day.lat,
      lng: day.lng,
      dateLabel: shortDate(day.date),
      days: [index],
    });
  }
  return points;
}

function dayToRoutePoint(day: TripDayModel, index: number): RoutePoint {
  return {
    city: day.city,
    lat: day.lat,
    lng: day.lng,
    dateLabel: shortDate(day.date),
    days: [index],
  };
}

function buildChecklistGroups(
  items: LocalChecklistItem[],
  labels: LocalTripDetailLabels,
): ChecklistGroup[] {
  const fallback = items.length
    ? items
    : [
        { text: labels.fallback_items.passport, kind: "preparation" },
        { text: labels.fallback_items.esim, kind: "transport" },
        { text: labels.fallback_items.stay, kind: "stay" },
        { text: labels.fallback_items.places, kind: "sight" },
      ];
  const groups = [
    {
      key: "preparation",
      title: labels.sections.preparation,
      tint: "bg-[#dff4f2] text-accent",
      Icon: CalendarDays,
    },
    {
      key: "transport",
      title: labels.sections.transport,
      tint: "bg-[#fff1dc] text-[#e67932]",
      Icon: Plane,
    },
    {
      key: "stay",
      title: labels.sections.stay,
      tint: "bg-[#ddf3e9] text-[#3a8f78]",
      Icon: BedDouble,
    },
    {
      key: "sights",
      title: labels.sections.sights,
      tint: "bg-[#eee7ff] text-[#7a5ac7]",
      Icon: Camera,
    },
  ];

  return groups.map((group, groupIndex) => {
    const groupItems = fallback.filter((item) => bucketForKind(item.kind) === group.key);
    const visible = groupItems.length ? groupItems : fallback.slice(groupIndex, groupIndex + 1);
    return {
      title: group.title,
      done: Math.min(visible.length, groupIndex === 0 ? 2 : groupIndex === 1 ? 1 : 0),
      items: visible.map((item) => ({ text: item.text, kind: item.kind })),
      tint: group.tint,
      Icon: group.Icon,
    };
  });
}

function readLocalDraft(): LocalTripDraft | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_TRIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalTripDraft;
    if (!parsed?.id || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate];
  }
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 21) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length ? dates : [startDate];
}

function bucketForKind(kind: string): string {
  if (kind === "stay") return "stay";
  if (kind === "transit" || kind === "transport" || kind === "flight" || kind === "esim") {
    return "transport";
  }
  if (kind === "ticket" || kind === "sight" || kind === "meal") return "sights";
  return "preparation";
}

function normalizeKind(kind: string | undefined | null): string {
  if (!kind) return "other";
  if (kind === "meal") return "meal";
  if (kind === "stay") return "stay";
  if (kind === "transit" || kind === "transport" || kind === "flight") return "transport";
  if (kind === "sight" || kind === "ticket") return kind;
  return "other";
}

function iconForKind(kind: string | undefined): LucideIcon {
  if (kind === "meal") return Utensils;
  if (kind === "stay") return BedDouble;
  if (kind === "transport" || kind === "transit") return TrainFront;
  if (kind === "sight" || kind === "ticket") return Camera;
  return MapPin;
}

function routeColor(index: number): string {
  return [
    "bg-[#d6526f]",
    "bg-[#f39b2f]",
    "bg-[#54ad8d]",
    "bg-[#4b91c9]",
    "bg-[#7a5ac7]",
    "bg-accent",
  ][index % 6]!;
}

function shortDate(date: string): string {
  const parts = date.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

function formatDateRange(start: string, end: string): string {
  const startLabel = shortDate(start);
  const endLabel = shortDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function timeForStop(index: number): string {
  return ["09:00", "10:30", "12:00", "14:00", "16:30", "19:00"][index] ?? "20:00";
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
