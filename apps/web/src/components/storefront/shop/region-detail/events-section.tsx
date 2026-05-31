"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Map,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { LocaleKey } from "./date";
import { RegionEventCard } from "./event-card";
import { EventTimeline } from "./event-timeline";
import { buildEventTimeline } from "./timeline-data";
import type { ApiEvent, SeasonKey } from "./types";

const EVENT_TYPE_ORDER = [
  "seasonal",
  "festival",
  "carnival",
  "religious",
  "music",
  "sports",
  "food",
  "cultural",
  "other",
];
const MAX_ADDED_EVENT_REGIONS = 3;

interface RegionEventsLabels {
  events_title: string;
  events_subtitle: string;
  event_category_all: string;
  events_empty: string;
  featured_events_title: string;
  featured_events_subtitle: string;
  trip_prompt_title: string;
  trip_prompt_body: string;
  plan_trip_cta: string;
  plan_with_event: string;
  add_location_cta: string;
  add_location_limit: string;
  remove_location: string;
  add_location_empty: string;
  add_location_search_placeholder: string;
  timeline_title: string;
  timeline_subtitle: string;
  timeline_seasons: Record<SeasonKey, { name: string; range: string }>;
  event_types: Record<string, string>;
}

interface AddableRegion {
  slug: string;
  name: { "zh-TW": string; en: string };
}

export function RegionEventsSection({
  events,
  baseRegionSlug,
  addableRegions,
  labels,
  localeKey,
  regionName,
  regionCover,
  timelineBackgroundSrc,
  planTripHref,
}: {
  events: ApiEvent[];
  baseRegionSlug: string;
  addableRegions: AddableRegion[];
  labels: RegionEventsLabels;
  localeKey: LocaleKey;
  regionName: string;
  regionCover: string;
  timelineBackgroundSrc: string;
  planTripHref: string;
}) {
  const [selectedRegionSlugs, setSelectedRegionSlugs] = React.useState<string[]>([]);
  const [regionSelectOpen, setRegionSelectOpen] = React.useState(false);
  const [regionSearch, setRegionSearch] = React.useState("");
  const eventRegionSlugs = React.useMemo(
    () => [baseRegionSlug, ...selectedRegionSlugs],
    [baseRegionSlug, selectedRegionSlugs],
  );
  const eventRegionKey = eventRegionSlugs.join(",");
  const [loadedEvents, setLoadedEvents] = React.useState<{
    key: string;
    events: ApiEvent[];
  } | null>(null);
  const hasAddedRegions = selectedRegionSlugs.length > 0;
  const displayedEvents =
    hasAddedRegions && loadedEvents?.key === eventRegionKey
      ? loadedEvents.events
      : events;
  const [activeTypes, setActiveTypes] = React.useState<string[] | null>(null);
  const selectedRegionSet = React.useMemo(
    () => new Set(selectedRegionSlugs),
    [selectedRegionSlugs],
  );
  const selectedRegions = React.useMemo(
    () =>
      selectedRegionSlugs
        .map((slug) => addableRegions.find((region) => region.slug === slug))
        .filter((region): region is AddableRegion => region != null),
    [addableRegions, selectedRegionSlugs],
  );
  const canAddMoreRegions =
    selectedRegionSlugs.length < MAX_ADDED_EVENT_REGIONS;
  const visibleAddableRegions = React.useMemo(() => {
    const query = regionSearch.trim().toLowerCase();
    if (!query) return addableRegions;
    return addableRegions.filter((region) =>
      [
        region.name["zh-TW"],
        region.name.en,
        region.slug,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [addableRegions, regionSearch]);

  React.useEffect(() => {
    if (!hasAddedRegions) return;

    let cancelled = false;
    async function loadEvents() {
      const params = new URLSearchParams({
        upcoming: "1",
        regions: eventRegionSlugs.join(","),
      });
      try {
        const res = await fetch(`/api/storefront/events?${params}`, {
          cache: "no-store",
        });
        const data = res.ok
          ? ((await res.json()) as { events?: ApiEvent[] })
          : { events: [] };
        if (!cancelled) {
          setLoadedEvents({
            key: eventRegionKey,
            events: data.events ?? [],
          });
        }
      } catch {
        if (!cancelled) {
          setLoadedEvents({ key: eventRegionKey, events: [] });
        }
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [eventRegionKey, eventRegionSlugs, hasAddedRegions]);

  const toggleRegion = (slug: string) => {
    setSelectedRegionSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((value) => value !== slug);
      }
      if (current.length >= MAX_ADDED_EVENT_REGIONS) return current;
      return [...current, slug];
    });
  };
  const removeRegion = (slug: string) => {
    setSelectedRegionSlugs((current) =>
      current.filter((value) => value !== slug),
    );
  };
  const categoryOptions = React.useMemo(() => {
    const seen = new Set(displayedEvents.map((event) => event.event_type));
    return EVENT_TYPE_ORDER.filter((type) => seen.has(type)).map((type) => ({
      value: type,
      label: labels.event_types[type] ?? type,
    }));
  }, [displayedEvents, labels.event_types]);
  const categoryValues = React.useMemo(
    () => categoryOptions.map((option) => option.value),
    [categoryOptions],
  );
  const toggleEventType = (type: string) => {
    setActiveTypes((current) => {
      const selected = current ?? categoryValues;
      const next = selected.includes(type)
        ? selected.filter((value) => value !== type)
        : [...selected, type];

      return categoryValues.filter((value) => next.includes(value));
    });
  };
  const filteredEvents = React.useMemo(
    () => {
      if (activeTypes === null) return displayedEvents;
      if (activeTypes.length === 0) return [];
      return displayedEvents.filter((event) =>
        activeTypes.includes(event.event_type),
      );
    },
    [activeTypes, displayedEvents],
  );
  const timeline = React.useMemo(
    () => buildEventTimeline(filteredEvents, localeKey, labels.event_types),
    [filteredEvents, labels.event_types, localeKey],
  );

  return (
    <section id="events" className="scroll-mt-6 space-y-3">
      <div className="space-y-3 px-1">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
              {labels.events_title}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">
              {labels.events_subtitle}
            </p>
          </div>
          <span className="text-[11px] text-fg-muted tabular-nums">
            {filteredEvents.length}
          </span>
        </div>

        {addableRegions.length > 0 ? (
          <div className="space-y-2">
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Popover
                open={regionSelectOpen}
                onOpenChange={(open) => {
                  setRegionSelectOpen(open);
                  if (!open) setRegionSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-divider bg-surface px-3 text-[12px] font-semibold text-fg-secondary shadow-xs transition-colors hover:bg-surface-hover"
                    aria-label={labels.add_location_cta}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {labels.add_location_cta}
                    <span className="text-fg-muted">
                      {selectedRegionSlugs.length}/{MAX_ADDED_EVENT_REGIONS}
                    </span>
                    <ChevronsUpDown
                      className="h-3.5 w-3.5 text-fg-muted"
                      aria-hidden="true"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-2"
                >
                  <div className="space-y-2">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
                        aria-hidden="true"
                      />
                      <Input
                        value={regionSearch}
                        onChange={(event) => setRegionSearch(event.target.value)}
                        placeholder={labels.add_location_search_placeholder}
                        className="h-9 rounded-xl border-divider bg-surface pl-9 text-[13px]"
                      />
                    </div>
                    <div className="px-1 text-[11.5px] font-medium text-fg-muted">
                      {labels.add_location_limit}
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {visibleAddableRegions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[12px] text-fg-muted">
                          {labels.add_location_empty}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {visibleAddableRegions.map((region) => {
                            const selected = selectedRegionSet.has(region.slug);
                            const disabled = !selected && !canAddMoreRegions;
                            return (
                              <button
                                key={region.slug}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  toggleRegion(region.slug);
                                  setRegionSearch("");
                                }}
                                className={cn(
                                  "flex h-9 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors",
                                  selected
                                    ? "bg-accent-softer text-accent"
                                    : "text-fg-secondary hover:bg-surface-hover",
                                  disabled &&
                                    "cursor-not-allowed opacity-40 hover:bg-transparent",
                                )}
                              >
                                <span className="min-w-0 truncate">
                                  {region.name[localeKey]}
                                </span>
                                {selected ? (
                                  <Check
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {selectedRegions.map((region) => (
                <button
                  key={region.slug}
                  type="button"
                  onClick={() => removeRegion(region.slug)}
                  aria-label={`${labels.remove_location} ${region.name[localeKey]}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent bg-accent-softer px-3 text-[12px] font-semibold text-accent"
                >
                  {region.name[localeKey]}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {categoryOptions.length > 0 ? (
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={labels.events_title}
          >
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleEventType(option.value)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold transition-colors",
                  activeTypes === null || activeTypes.includes(option.value)
                    ? "border-accent bg-accent-softer text-accent"
                    : "border-divider bg-surface text-fg-secondary hover:bg-surface-hover",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {displayedEvents.length > 0 ? (
        <>
          <EventTimeline
            item={timeline}
            labels={labels}
            backgroundSrc={timelineBackgroundSrc}
          />
          <div className="flex items-end justify-between gap-3 px-1 pt-2">
            <div>
              <div className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.015em] text-fg">
                {labels.featured_events_title}
                <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </div>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                {labels.featured_events_subtitle}
              </p>
            </div>
          </div>
          <div
            className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={labels.featured_events_title}
          >
            {filteredEvents.map((event) => (
              <RegionEventCard
                key={event.id}
                event={event}
                regionCover={regionCover}
                regionName={regionName}
                localeKey={localeKey}
                labels={labels}
                planTripHref={planTripHref}
              />
            ))}
          </div>
          <Link
            href={planTripHref}
            className="mx-auto flex max-w-[720px] items-center gap-3 rounded-2xl border border-divider bg-surface px-4 py-3 text-fg shadow-xs transition-colors hover:bg-surface-hover"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Map className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">
                {labels.trip_prompt_title}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">
                {labels.trip_prompt_body}
              </span>
            </span>
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-white">
              {labels.plan_trip_cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </>
      ) : (
        <div
          className="rounded-2xl bg-surface px-4 py-5 text-[13px] leading-relaxed text-fg-muted"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {labels.events_empty}
        </div>
      )}
    </section>
  );
}
