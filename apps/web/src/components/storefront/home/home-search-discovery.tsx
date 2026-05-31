"use client";

// Home-page cmdk-style search + trending-now binding.
//
// The original SearchEntryPill was just a link into /trips. Users
// actually want to discover destinations from the home screen, so this
// upgrades the pill into a real cmdk-style search input: typing opens
// a popover of matching regions, picking one navigates to /shop/[slug].
//
// While the user types, the top region match is published via context
// to `<HomeTrendingCarousel>` which re-renders ShopEventsCarousel with
// a region filter — so the "現在熱門" rail below shows trending events
// for the destination they're searching for, in real time.

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronRight, Search, X } from "lucide-react";

import { MotionButton, popIn } from "@/components/storefront/motion";
import {
  RegionResultRow,
  SearchGroup,
  findMatchingRegions,
  resultClassName,
  useSearchPopover,
  type RegionStat,
} from "@/components/storefront/search/search-popover";
import { ShopEventsCarousel } from "@/components/storefront/shop/shop-events-carousel";
import { findRegionBySlug, type ShopRegion } from "@/lib/storefront-regions";
import { formatTemplate } from "@/lib/text-template";

export interface HomeSearchEvent {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  subtitle_i18n: Record<string, string>;
  event_type: string;
  region_slug: string;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  cover_image: string | null;
  badge_override: string | null;
}

type SearchResult =
  | { kind: "region"; region: ShopRegion }
  | { kind: "event"; event: HomeSearchEvent };

interface HomeSearchState {
  regionSlug: string | undefined;
  setRegionSlug: (slug: string | undefined) => void;
}

const HomeSearchContext = React.createContext<HomeSearchState>({
  regionSlug: undefined,
  setRegionSlug: () => {},
});

export function HomeSearchProvider({ children }: { children: React.ReactNode }) {
  const [regionSlug, setRegionSlug] = React.useState<string | undefined>(undefined);
  const value = React.useMemo(
    () => ({ regionSlug, setRegionSlug }),
    [regionSlug],
  );
  return (
    <HomeSearchContext.Provider value={value}>
      {children}
    </HomeSearchContext.Provider>
  );
}

export function HomeTrendingCarousel({
  lang,
  localeKey,
  labels,
}: {
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: ShopDiscoveryLabels;
}) {
  const { regionSlug } = React.useContext(HomeSearchContext);
  return (
    <ShopEventsCarousel
      lang={lang}
      localeKey={localeKey}
      labels={labels}
      regionSlug={regionSlug}
    />
  );
}

export function HomeSearchPill({
  lang,
  localeKey,
  stats,
  events,
  labels,
  placeholder,
}: {
  lang: string;
  localeKey: "zh-TW" | "en";
  stats: Record<string, RegionStat>;
  events: HomeSearchEvent[];
  labels: ShopDiscoveryLabels;
  placeholder: string;
}) {
  const router = useRouter();
  const { setRegionSlug } = React.useContext(HomeSearchContext);
  const getResults = React.useCallback(
    (trimmed: string): SearchResult[] => [
      ...findMatchingRegions(trimmed).map((region) => ({
        kind: "region" as const,
        region,
      })),
      ...findMatchingEvents(events, trimmed).map((event) => ({
        kind: "event" as const,
        event,
      })),
    ],
    [events],
  );
  const {
    q,
    setQ,
    setOpen,
    focusedIdx,
    setFocusedIdx,
    inputRef,
    popoverRef,
    trimmed,
    results: flatResults,
    showPopover,
    commit,
    onKeyDown,
  } = useSearchPopover({
    getResults,
    onCommit: (result) => router.push(resultHref(result, lang)),
  });
  const regionMatches = flatResults.filter((result) => result.kind === "region");
  const eventMatches = flatResults.filter((result) => result.kind === "event");

  // Publish top match to the carousel via context whenever the query /
  // matches change. Empty query → undefined, which clears the filter.
  React.useEffect(() => {
    const firstRegion = regionMatches[0];
    const firstEvent = eventMatches[0];
    const regionSlug =
      firstRegion?.region.slug ?? firstEvent?.event.region_slug ?? undefined;
    setRegionSlug(trimmed ? regionSlug : undefined);
  }, [trimmed, eventMatches, regionMatches, setRegionSlug]);

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 rounded-full bg-surface px-4 py-3 transition-colors focus-within:bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Search
          className="h-[18px] w-[18px] shrink-0 text-accent"
          strokeWidth={2.25}
        />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFocusedIdx(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-none bg-transparent text-[15px] font-medium text-fg placeholder:text-fg-muted focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {q ? (
          <MotionButton
            type="button"
            aria-label={labels.clear_search}
            onClick={() => {
              setQ("");
              setFocusedIdx(0);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </MotionButton>
        ) : null}
      </div>

      <AnimatePresence>
        {showPopover ? (
          <motion.div
            ref={popoverRef}
            {...popIn}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[60vh] overflow-y-auto rounded-2xl bg-surface py-2"
            style={{ boxShadow: "var(--shadow-card-lg, var(--shadow-card))" }}
            role="listbox"
          >
            {flatResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-fg-muted">
                {labels.no_search_matches}
              </div>
            ) : (
              <>
                {regionMatches.length > 0 && (
                  <SearchGroup
                    label={formatTemplate(labels.regions_count, {
                      count: String(regionMatches.length),
                    })}
                  >
                    {regionMatches.map((result, i) => {
                      const region = result.region;
                      const stat = stats[region.slug];
                      const focused = i === focusedIdx;
                      return (
                        <RegionResultRow
                          key={region.slug}
                          region={region}
                          localeKey={localeKey}
                          stat={stat}
                          labels={labels}
                          focused={focused}
                          onFocus={() => setFocusedIdx(i)}
                          onSelect={() => commit(result)}
                        />
                      );
                    })}
                  </SearchGroup>
                )}

                {eventMatches.length > 0 && (
                  <SearchGroup
                    label={formatTemplate(labels.events_count, {
                      count: String(eventMatches.length),
                    })}
                  >
                    {eventMatches.map((result, i) => {
                      const event = result.event;
                      const index = regionMatches.length + i;
                      const focused = index === focusedIdx;
                      const region = findRegionBySlug(event.region_slug);
                      const title = pickI18n(event.title_i18n, localeKey, event.slug);
                      const subtitle = pickI18n(event.subtitle_i18n, localeKey, "");
                      return (
                        <MotionButton
                          key={event.id}
                          type="button"
                          role="option"
                          aria-selected={focused}
                          onMouseEnter={() => setFocusedIdx(index)}
                          onClick={() => commit(result)}
                          className={resultClassName(focused)}
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
                            {event.cover_image || region?.cover ? (
                              <Image
                                src={event.cover_image || region!.cover}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <CalendarDays className="m-2.5 h-5 w-5 text-fg-muted" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold text-fg">
                              {title}
                            </div>
                            <div className="truncate text-[11px] text-fg-muted">
                              {region?.name[localeKey] ?? event.region_slug}
                              {subtitle ? ` · ${subtitle}` : ""}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
                        </MotionButton>
                      );
                    })}
                  </SearchGroup>
                )}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface ShopDiscoveryLabels {
  clear_search: string;
  no_search_matches: string;
  no_region_matches: string;
  regions_count: string;
  events_count: string;
  plans: string;
  from: string;
  trending_now: string;
  no_events_category: string;
}

function resultHref(result: SearchResult, lang: string): string {
  if (result.kind === "region") return `/${lang}/shop/${result.region.slug}`;
  const eventSlug = encodeURIComponent(result.event.slug);
  return `/${lang}/shop/${result.event.region_slug}?event=${eventSlug}#event-${eventSlug}`;
}

function pickI18n(
  value: Record<string, string> | undefined,
  localeKey: "zh-TW" | "en",
  fallback: string,
): string {
  return value?.[localeKey] ?? value?.["zh-TW"] ?? value?.en ?? fallback;
}

function findMatchingEvents(
  events: readonly HomeSearchEvent[],
  trimmed: string,
): HomeSearchEvent[] {
  if (!trimmed) return [];
  return events
    .filter((event) => {
      const region = findRegionBySlug(event.region_slug);
      const hay = [
        event.slug,
        event.event_type,
        event.title_i18n?.["zh-TW"],
        event.title_i18n?.en,
        event.subtitle_i18n?.["zh-TW"],
        event.subtitle_i18n?.en,
        region?.name["zh-TW"],
        region?.name.en,
        region?.slug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(trimmed);
    })
    .slice(0, 8);
}
