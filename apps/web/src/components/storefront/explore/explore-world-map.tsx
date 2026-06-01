"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Heart,
  Menu,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { ExploreMapEvent, ExploreMapFocus } from "./leaflet-event-map";

const LeafletEventMap = dynamic(
  () => import("./leaflet-event-map").then((mod) => mod.LeafletEventMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-[#dfeee9]" />
    ),
  },
);

type ExploreLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  panel_title: string;
  panel_count: string;
  panel_body: string;
  view_region: string;
  map_title: string;
  map_hint: string;
  filters_label: string;
  month_label: string;
  selected_day: string;
  date_range_title: string;
  date_range_empty: string;
  date_range_single: string;
  date_range_range: string;
  reset_filters: string;
  no_results_title: string;
  no_results_body: string;
  featured_only: string;
  visible_count: string;
  region_search_placeholder: string;
  region_search_empty: string;
  filters: {
    time: string;
    region: string;
    type: string;
  };
  time_options: Array<{ value: string; label: string }>;
  region_options: Array<{ value: string; label: string }>;
  type_options: Array<{ value: string; label: string }>;
  events: Array<{
    id: string;
    title: string;
    meta: string;
    location: string;
    date: string;
    date_short: string;
    country: string;
    type_label: string;
    rating: string;
  }>;
};

type HeaderLabels = {
  brand: string;
  nav: {
    explore: string;
    destinations: string;
    calendar: string;
    planner: string;
    esim: string;
  };
  favorites_aria: string;
  account_aria: string;
  menu_aria: string;
};

const EVENT_META = [
  {
    id: "tomorrowland",
    regionSlug: "belgium",
    cover: "/illustrations/events/jp-sakura-2026.png",
    lat: 51.088,
    lng: 4.366,
    region: "europe",
    type: "festival",
    month: "jul",
    day: 19,
    calendarRange: { startDay: 19, endDay: 21 },
    featured: true,
  },
  {
    id: "singapore-food",
    regionSlug: "singapore",
    cover: "/illustrations/cities/singapore.jpg",
    lat: 1.352,
    lng: 103.82,
    region: "asia",
    type: "food",
    month: "jul",
    day: 22,
    calendarRange: { startDay: 19, endDay: 28 },
    featured: true,
  },
  {
    id: "edinburgh-fringe",
    regionSlug: "united-kingdom",
    cover: "/illustrations/cities/london.jpg",
    lat: 55.953,
    lng: -3.188,
    region: "europe",
    type: "culture",
    month: "aug",
    day: 8,
    featured: true,
  },
  {
    id: "jp-sakura",
    regionSlug: "japan",
    cover: "/illustrations/events/jp-sakura-2026.png",
    lat: 35.676,
    lng: 139.65,
    region: "asia",
    type: "season",
    month: "spring",
    day: 10,
    featured: false,
  },
  {
    id: "turkey-balloons",
    regionSlug: "turkey",
    cover: "/illustrations/cities/istanbul.jpg",
    lat: 38.643,
    lng: 34.828,
    region: "europe",
    type: "nature",
    month: "summer",
    day: 16,
    calendarRange: { startDay: 1, endDay: 35 },
    featured: true,
  },
  {
    id: "switzerland-alps",
    regionSlug: "switzerland",
    cover: "/illustrations/cities/prague.jpg",
    lat: 46.548,
    lng: 7.985,
    region: "europe",
    type: "nature",
    month: "summer",
    day: 9,
    calendarRange: { startDay: 1, endDay: 35 },
    featured: true,
  },
  {
    id: "iceland-lights",
    regionSlug: "iceland",
    cover: "/illustrations/timeline/seasons/winter.png",
    lat: 64.147,
    lng: -21.942,
    region: "europe",
    type: "season",
    month: "winter",
    day: 3,
    featured: false,
  },
  {
    id: "bali-holiday",
    regionSlug: "indonesia",
    cover: "/illustrations/cities/bangkok.jpg",
    lat: -8.34,
    lng: 115.092,
    region: "asia",
    type: "nature",
    month: "summer",
    day: 26,
    calendarRange: { startDay: 1, endDay: 35 },
    featured: true,
  },
  {
    id: "rio-carnival",
    regionSlug: "brazil",
    cover: "/illustrations/cities/rio.jpg",
    lat: -22.906,
    lng: -43.172,
    region: "americas",
    type: "festival",
    month: "spring",
    day: 12,
    featured: false,
  },
  {
    id: "new-york-food",
    regionSlug: "united-states",
    cover: "/illustrations/cities/new-york.jpg",
    lat: 40.713,
    lng: -74.006,
    region: "americas",
    type: "food",
    month: "jul",
    day: 6,
    calendarRange: { startDay: 5, endDay: 27 },
    featured: true,
  },
  {
    id: "sydney-light",
    regionSlug: "australia",
    cover: "/illustrations/cities/sydney.jpg",
    lat: -33.868,
    lng: 151.209,
    region: "oceania",
    type: "festival",
    month: "winter",
    day: 28,
    featured: false,
  },
] as const;

type PlaceOption = {
  id: string;
  label: string;
  helper: string;
  aliases: string[];
  focus: ExploreMapFocus;
  eventRegion?: string;
};

const PLACE_OPTIONS: PlaceOption[] = [
  {
    id: "asia",
    label: "Asia",
    helper: "Continent",
    aliases: ["asia", "亞洲", "アジア"],
    eventRegion: "asia",
    focus: {
      center: [34, 103],
      zoom: 3,
      bounds: [[-11, 25], [82, 180]],
    },
  },
  {
    id: "europe",
    label: "Europe",
    helper: "Continent",
    aliases: ["europe", "歐洲", "欧洲"],
    eventRegion: "europe",
    focus: {
      center: [53, 15],
      zoom: 4,
      bounds: [[34, -25], [72, 45]],
    },
  },
  {
    id: "americas",
    label: "Americas",
    helper: "Region",
    aliases: ["americas", "america", "美洲", "north america", "south america"],
    eventRegion: "americas",
    focus: {
      center: [12, -84],
      zoom: 3,
      bounds: [[-56, -170], [72, -35]],
    },
  },
  {
    id: "oceania",
    label: "Oceania",
    helper: "Region",
    aliases: ["oceania", "大洋洲", "澳洲區"],
    eventRegion: "oceania",
    focus: {
      center: [-24, 145],
      zoom: 3,
      bounds: [[-50, 110], [5, 180]],
    },
  },
  {
    id: "taiwan",
    label: "Taiwan",
    helper: "Country",
    aliases: ["taiwan", "台灣", "臺灣", "tw"],
    focus: {
      center: [23.7, 120.96],
      zoom: 7,
      bounds: [[21.8, 119.3], [25.4, 122.1]],
    },
  },
  {
    id: "taipei",
    label: "Taipei City",
    helper: "City",
    aliases: ["taipei", "taipei city", "台北", "台北市", "臺北", "臺北市"],
    focus: { center: [25.033, 121.565], zoom: 11 },
  },
  {
    id: "japan",
    label: "Japan",
    helper: "Country",
    aliases: ["japan", "日本", "jp"],
    eventRegion: "asia",
    focus: {
      center: [36.2, 138.25],
      zoom: 5,
      bounds: [[30, 129], [46, 146]],
    },
  },
  {
    id: "singapore",
    label: "Singapore",
    helper: "Country · City",
    aliases: ["singapore", "新加坡", "sg"],
    eventRegion: "asia",
    focus: { center: [1.352, 103.82], zoom: 11 },
  },
  {
    id: "belgium",
    label: "Belgium",
    helper: "Country",
    aliases: ["belgium", "比利時", "比利时"],
    eventRegion: "europe",
    focus: { center: [50.64, 4.67], zoom: 7 },
  },
  {
    id: "edinburgh",
    label: "Edinburgh",
    helper: "City",
    aliases: ["edinburgh", "愛丁堡", "爱丁堡"],
    eventRegion: "europe",
    focus: { center: [55.953, -3.188], zoom: 10 },
  },
  {
    id: "cappadocia",
    label: "Cappadocia",
    helper: "Region",
    aliases: ["cappadocia", "kapadokya", "卡帕多奇亞", "卡帕多奇亚"],
    eventRegion: "europe",
    focus: { center: [38.643, 34.828], zoom: 9 },
  },
  {
    id: "switzerland",
    label: "Switzerland",
    helper: "Country",
    aliases: ["switzerland", "swiss", "瑞士"],
    eventRegion: "europe",
    focus: {
      center: [46.8, 8.23],
      zoom: 7,
      bounds: [[45.8, 5.9], [47.9, 10.6]],
    },
  },
  {
    id: "iceland",
    label: "Iceland",
    helper: "Country",
    aliases: ["iceland", "冰島", "冰岛"],
    eventRegion: "europe",
    focus: {
      center: [64.9, -18.6],
      zoom: 6,
      bounds: [[63.2, -25], [66.7, -13]],
    },
  },
  {
    id: "bali",
    label: "Bali",
    helper: "Island",
    aliases: ["bali", "峇里島", "巴厘島", "巴厘岛"],
    eventRegion: "asia",
    focus: { center: [-8.34, 115.092], zoom: 9 },
  },
  {
    id: "new-york",
    label: "New York City",
    helper: "City",
    aliases: ["new york", "new york city", "nyc", "紐約", "纽约"],
    eventRegion: "americas",
    focus: { center: [40.713, -74.006], zoom: 10 },
  },
  {
    id: "sydney",
    label: "Sydney",
    helper: "City",
    aliases: ["sydney", "雪梨", "悉尼"],
    eventRegion: "oceania",
    focus: { center: [-33.868, 151.209], zoom: 10 },
  },
];

const CALENDAR_DAYS = Array.from({ length: 35 }, (_, index) => index + 1);

type DateRange = {
  startDay: number;
  endDay: number;
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function rangesOverlap(range: DateRange, eventRange: DateRange | undefined) {
  if (!eventRange) return false;
  return eventRange.startDay <= range.endDay && eventRange.endDay >= range.startDay;
}

export function ExploreWorldMap({
  lang,
  labels,
  headerLabels,
}: {
  lang: string;
  labels: ExploreLabels;
  headerLabels: HeaderLabels;
}) {
  const [time, setTime] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null);
  const [type, setType] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(true);
  const [activeId, setActiveId] = useState<string>(EVENT_META[0].id);

  const copyById = useMemo(
    () => new Map(labels.events.map((event) => [event.id, event])),
    [labels.events],
  );

  const events = useMemo<ExploreMapEvent[]>(
    () =>
      EVENT_META.flatMap((event) => {
        const copy = copyById.get(event.id);
        return copy ? [{ ...event, copy }] : [];
      }),
    [copyById],
  );

  const calendarMarkerEvents = useMemo(
    () =>
      events.filter((event) => {
        if (time !== "all" && event.month !== time) return false;
        if (
          selectedPlace?.eventRegion &&
          event.region !== selectedPlace.eventRegion
        ) {
          return false;
        }
        if (type !== "all" && event.type !== type) return false;
        if (featuredOnly && !event.featured) return false;
        return true;
      }),
    [events, featuredOnly, selectedPlace, time, type],
  );

  const filteredEvents = useMemo(
    () =>
      calendarMarkerEvents.filter((event) => {
        if (dateRange && !rangesOverlap(dateRange, event.calendarRange)) {
          return false;
        }
        return true;
      }),
    [calendarMarkerEvents, dateRange],
  );

  const activeEvent =
    filteredEvents.find((event) => event.id === activeId) ?? filteredEvents[0];
  const highlightedDays = new Set(calendarMarkerEvents.map((event) => event.day));
  const rangeSummary = dateRange
    ? dateRange.startDay === dateRange.endDay
      ? labels.date_range_single.replace("{day}", String(dateRange.startDay))
      : labels.date_range_range
          .replace("{start}", String(dateRange.startDay))
          .replace("{end}", String(dateRange.endDay))
    : labels.date_range_empty;
  const prefix = `/${lang}`;

  function selectCalendarDay(day: number) {
    setDateRange((current) => {
      if (!current || current.startDay !== current.endDay) {
        return { startDay: day, endDay: day };
      }

      return {
        startDay: Math.min(current.startDay, day),
        endDay: Math.max(current.startDay, day),
      };
    });
  }

  function resetFilters() {
    setTime("all");
    setDateRange(null);
    setSelectedPlace(null);
    setType("all");
    setFeaturedOnly(false);
  }

  return (
    <div className="min-h-screen bg-[#f6f5ef] text-fg">
      <ExploreHeader lang={lang} labels={headerLabels} />
      <div className="px-4 pb-8 pt-5 md:px-7">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-3 text-[18px] font-semibold text-fg md:text-[26px]">
            <span className="font-mono text-[24px] md:text-[30px]">04</span>
            <h1 className="tracking-[-0.02em]">{labels.map_title}</h1>
          </div>
          <p className="mt-1 max-w-[660px] text-[13px] leading-6 text-fg-muted md:text-[14px]">
            {labels.map_hint}
          </p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-white text-fg-muted">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="relative h-11 w-11 overflow-hidden rounded-full border border-white bg-neutral-200 shadow-sm">
            <Image
              src="/illustrations/lumi.png"
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          </span>
        </div>
      </div>

      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="order-2 rounded-[18px] border border-border/70 bg-white/86 p-5 shadow-[0_18px_60px_-42px_rgba(0,0,0,0.45)] backdrop-blur xl:order-none">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:bg-muted"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-[18px] font-semibold tracking-[-0.01em]">
              {labels.month_label}
            </div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:bg-muted"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-y-3 text-center text-[12px] font-semibold text-fg-muted">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-[13px]">
            {CALENDAR_DAYS.map((day) => {
              const hasEvent = highlightedDays.has(day);
              const isInRange =
                dateRange && day >= dateRange.startDay && day <= dateRange.endDay;
              const isRangeEdge =
                dateRange &&
                (day === dateRange.startDay || day === dateRange.endDay);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectCalendarDay(day)}
                  className={cn(
                    "mx-auto grid h-9 w-9 place-items-center rounded-full font-semibold text-fg-muted transition",
                    hasEvent && "text-fg",
                    isInRange && "bg-[var(--accent)]/12 text-fg",
                    isRangeEdge && "bg-[var(--accent)] text-white shadow-sm",
                    !isRangeEdge && "hover:bg-muted",
                  )}
                >
                  {day}
                  {hasEvent && !isRangeEdge ? (
                    <span className="-mt-1 h-1 w-1 rounded-full bg-[var(--accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="text-[18px] font-semibold">
              {labels.date_range_title}
            </div>
            <div className="mt-1 text-[13px] font-medium text-fg-muted">
              {rangeSummary}
            </div>
            <div className="mt-4 grid gap-3">
              {filteredEvents.slice(0, 3).map((event) => (
                <EventCompactCard
                  key={event.id}
                  event={event}
                  href={`${prefix}/shop/${event.regionSlug}`}
                  active={event.id === activeEvent?.id}
                  onSelect={() => setActiveId(event.id)}
                />
              ))}
            </div>
          </div>
        </aside>

        <main className="order-1 flex min-w-0 flex-col gap-4 xl:order-none">
          <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-border/70 bg-white/82 p-3 shadow-[0_18px_60px_-48px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="mr-1 flex items-center gap-2 px-2 text-[13px] font-semibold text-fg-muted">
              <SlidersHorizontal className="h-4 w-4" />
              {labels.filters_label}
            </div>
            <FilterSelect
              value={time}
              onValueChange={setTime}
              label={labels.filters.time}
              options={labels.time_options}
              icon={<Clock3 className="h-4 w-4" />}
            />
            <RegionSearch
              selectedPlace={selectedPlace}
              onSelect={setSelectedPlace}
              label={labels.filters.region}
              allLabel={
                labels.region_options.find((option) => option.value === "all")
                  ?.label ?? labels.filters.region
              }
              placeholder={labels.region_search_placeholder}
              emptyLabel={labels.region_search_empty}
            />
            <FilterSelect
              value={type}
              onValueChange={setType}
              label={labels.filters.type}
              options={labels.type_options}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <label className="ml-auto flex h-10 items-center gap-2 rounded-full border border-border/70 bg-white px-3 text-[13px] font-semibold text-fg shadow-xs">
              <Checkbox
                checked={featuredOnly}
                onCheckedChange={(value) => setFeaturedOnly(value === true)}
              />
              {labels.featured_only}
            </label>
          </div>

          <section className="relative min-h-[520px] flex-1 overflow-hidden rounded-[20px] border border-border/70 bg-[#dfeee9] shadow-[0_20px_80px_-48px_rgba(0,0,0,0.55)] md:min-h-[560px]">
            <LeafletEventMap
              events={filteredEvents}
              activeId={activeEvent?.id ?? null}
              onActiveChange={setActiveId}
              focusTarget={selectedPlace?.focus ?? null}
              lang={lang}
            />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/70 bg-white/88 px-3 py-2 text-[12px] font-semibold text-fg shadow-sm backdrop-blur">
              {labels.visible_count.replace("{count}", String(filteredEvents.length))}
            </div>
            {filteredEvents.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center bg-white/70 px-6 text-center backdrop-blur-sm">
                <div>
                  <div className="text-[20px] font-semibold">
                    {labels.no_results_title}
                  </div>
                  <p className="mt-2 max-w-[360px] text-[14px] leading-6 text-fg-muted">
                    {labels.no_results_body}
                  </p>
                  <Button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 rounded-full"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {labels.reset_filters}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </main>

      </div>
      </div>
    </div>
  );
}

function ExploreHeader({
  lang,
  labels,
}: {
  lang: string;
  labels: HeaderLabels;
}) {
  const prefix = `/${lang}`;
  const navItems = [
    { label: labels.nav.explore, href: `${prefix}/explore` },
    { label: labels.nav.destinations, href: `${prefix}/shop` },
    { label: labels.nav.calendar, href: `${prefix}/shop` },
    { label: labels.nav.planner, href: `${prefix}/login?next=${prefix}/trips` },
    { label: labels.nav.esim, href: `${prefix}/shop` },
  ];

  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center gap-8 px-5 sm:px-8">
        <Link
          href={prefix}
          className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-fg"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-fg text-[#f6f5ef]">
            <Compass className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          {labels.brand}
        </Link>

        <nav className="hidden items-center gap-9 text-[14px] font-semibold text-fg-secondary md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 text-fg-secondary">
          <Link
            href={`${prefix}/login`}
            aria-label={labels.favorites_aria}
            className="hidden transition-colors hover:text-fg sm:inline-flex"
          >
            <Heart className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <Link
            href={`${prefix}/login`}
            aria-label={labels.account_aria}
            className="hidden transition-colors hover:text-fg sm:inline-flex"
          >
            <User className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <button
            type="button"
            aria-label={labels.menu_aria}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,0.7)] transition-colors hover:bg-fg-secondary"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

function FilterSelect({
  value,
  onValueChange,
  label,
  options,
  icon,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  options: Array<{ value: string; label: string }>;
  icon: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className="h-10 rounded-full border-border/70 bg-white px-3 font-semibold shadow-xs"
      >
        <span className="flex items-center gap-2">
          {icon}
          <SelectValue placeholder={label} />
        </span>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegionSearch({
  selectedPlace,
  onSelect,
  label,
  allLabel,
  placeholder,
  emptyLabel,
}: {
  selectedPlace: PlaceOption | null;
  onSelect: (place: PlaceOption | null) => void;
  label: string;
  allLabel: string;
  placeholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listboxId = useId();
  const normalizedQuery = normalizeSearch(query);
  const results = useMemo(() => {
    if (!normalizedQuery) return PLACE_OPTIONS.slice(0, 8);
    return PLACE_OPTIONS.filter((place) =>
      [place.label, place.helper, ...place.aliases].some((value) =>
        normalizeSearch(value).includes(normalizedQuery),
      ),
    ).slice(0, 8);
  }, [normalizedQuery]);

  function choose(place: PlaceOption | null) {
    onSelect(place);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-border/70 bg-white px-3 text-[14px] font-semibold text-fg shadow-xs transition hover:bg-muted"
        >
          <Compass className="h-4 w-4 text-fg-muted" />
          <span className="max-w-[180px] truncate">
            {selectedPlace?.label ?? allLabel}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] rounded-[18px] border-border/70 bg-white p-2 shadow-[0_22px_72px_-34px_rgba(0,0,0,0.5)]"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-10 rounded-full border-border/70 bg-muted/50 pl-9 text-[14px]"
            autoFocus
          />
        </div>
        <div id={listboxId} role="listbox" className="mt-2 max-h-[300px] overflow-y-auto">
          <button
            type="button"
            role="option"
            aria-selected={!selectedPlace}
            onClick={() => choose(null)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-semibold transition hover:bg-muted",
              !selectedPlace && "bg-muted",
            )}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-fg-muted shadow-xs">
              <Compass className="h-4 w-4" />
            </span>
            <span>{allLabel}</span>
          </button>
          {results.length > 0 ? (
            results.map((place) => (
              <button
                key={place.id}
                type="button"
                role="option"
                aria-selected={selectedPlace?.id === place.id}
                onClick={() => choose(place)}
                className={cn(
                  "mt-1 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-muted",
                  selectedPlace?.id === place.id && "bg-muted",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {place.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-fg-muted">
                    {place.helper}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-[13px] text-fg-muted">
              {emptyLabel}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EventCompactCard({
  event,
  href,
  active,
  onSelect,
}: {
  event: ExploreMapEvent;
  href: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={cn(
        "grid grid-cols-[46px_minmax(0,1fr)] gap-3 rounded-[12px] p-2 transition hover:bg-muted",
        active && "bg-muted",
      )}
    >
      <span className="relative h-11 overflow-hidden rounded-[9px] bg-muted">
        <Image
          src={event.cover}
          alt=""
          fill
          sizes="46px"
          className="object-cover"
        />
      </span>
      <span className="min-w-0 self-center">
        <span className="block truncate text-[13px] font-semibold">
          {event.copy.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-fg-muted">
          {event.copy.country}
        </span>
      </span>
    </Link>
  );
}
