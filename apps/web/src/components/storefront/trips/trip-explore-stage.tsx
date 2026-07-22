"use client";

// Exploration-stage pieces for the trip detail page:
//   * ExploreStageMap — the map limited to searching/selecting countries
//     and cities while the trip has no planned days yet
//   * TripDateRangePicker — the header date pill, editable in exploration
//   * LumiTakeoverOverlay — floating Lumi that, after a Lumi-created trip,
//     resolves the prompt into dates + cities and applies them on screen
//     (avatar flies to the date pill, pins drop onto the map)

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { DateRange } from "react-day-picker";
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ExternalLink, Loader2, MapPin, Plane, Plus, Search, Send, X } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import type { TripPlanningLabels } from "@/components/storefront/trips/trip-planning-workspace";
import { cn } from "@/lib/utils";

const EASE = [0.32, 0.72, 0, 1] as const;

const LeafletTripMap = dynamic(
  () => import("./trip-map").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[linear-gradient(135deg,#dff4f2,#efe7d9)]" />
    ),
  },
);

// ── Exploration city model ──────────────────────────────────────────────

export interface ExploreCity {
  name: string;
  lat: number;
  lng: number;
  country_code?: string | null;
}

export interface ExploreDeparturePlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
}

export function readExplorationCities(
  metadata: Record<string, unknown>,
): ExploreCity[] {
  const planning =
    metadata.planning && typeof metadata.planning === "object"
      ? (metadata.planning as Record<string, unknown>)
      : null;
  const raw = planning?.exploration_cities;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const city = item as Record<string, unknown>;
    if (
      typeof city.name !== "string" ||
      typeof city.lat !== "number" ||
      typeof city.lng !== "number"
    ) {
      return [];
    }
    return [
      {
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        country_code:
          typeof city.country_code === "string" ? city.country_code : null,
      },
    ];
  });
}

// ── Pin-drop sound (tiny synthesized plop; safe to fail silently) ───────

let audioContext: AudioContext | null = null;

export function playPinDropSound() {
  try {
    type AudioWindow = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    /* audio unavailable or blocked before a user gesture — skip */
  }
}

// ── Exploration map section ─────────────────────────────────────────────

export interface ExploreSearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  countryCode?: string | null;
}

export function ExploreStageMap({
  lang,
  cities,
  labels,
  onSearch,
  onAddCity,
  onRemoveCity,
  onResolvePoint,
  nextEnabled,
  onNext,
}: {
  lang: string;
  cities: ExploreCity[];
  labels: TripPlanningLabels["explore_stage"];
  onSearch: (query: string) => Promise<ExploreSearchResult[]>;
  onAddCity: (city: ExploreCity) => void | Promise<void>;
  onRemoveCity: (index: number) => void | Promise<void>;
  onResolvePoint: (lat: number, lng: number) => Promise<ExploreSearchResult | null>;
  nextEnabled: boolean;
  onNext: () => void;
}) {
  const [candidate, setCandidate] = useState<ExploreSearchResult | null>(null);
  const [resolvingPoint, setResolvingPoint] = useState(false);
  const resolveSeq = useRef(0);

  const handleExploreClick = useCallback(
    (point: {
      lat: number;
      lng: number;
      placeId: string | null;
      countryName?: string | null;
      countryCode?: string | null;
    }) => {
      if (point.countryName) {
        resolveSeq.current += 1;
        setResolvingPoint(false);
        setCandidate(null);
        void onAddCity({
          name: point.countryName,
          lat: point.lat,
          lng: point.lng,
          country_code: point.countryCode ?? null,
        });
        return;
      }
      const seq = ++resolveSeq.current;
      setResolvingPoint(true);
      setCandidate(null);
      void onResolvePoint(point.lat, point.lng)
        .then((resolved) => {
          if (resolveSeq.current !== seq) return;
          setCandidate(resolved);
        })
        .catch(() => {
          if (resolveSeq.current !== seq) return;
          setCandidate(null);
        })
        .finally(() => {
          if (resolveSeq.current === seq) setResolvingPoint(false);
        });
    },
    [onAddCity, onResolvePoint],
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExploreSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchSeq = useRef(0);

  const runSearch = useCallback(
    async (value: string) => {
      const clean = value.trim();
      const seq = ++searchSeq.current;
      if (clean.length < 2) {
        setResults([]);
        setSearched(false);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const found = await onSearch(clean);
        if (searchSeq.current !== seq) return;
        setResults(found);
        setSearched(true);
      } catch {
        if (searchSeq.current !== seq) return;
        setResults([]);
        setSearched(true);
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    },
    [onSearch],
  );

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 320);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const mapCities = useMemo(
    () =>
      cities.map((city) => ({
        name: city.name,
        lat: city.lat,
        lng: city.lng,
      })),
    [cities],
  );
  const selectedKeys = useMemo(
    () => new Set(cities.map((city) => city.name.toLowerCase())),
    [cities],
  );

  return (
    <section className="relative mt-3 h-[52svh] min-h-[380px] overflow-hidden rounded-[22px] border border-white/80 bg-[#efe7d9] shadow-[0_24px_80px_-58px_rgba(32,41,46,0.5)] sm:rounded-[24px] xl:h-[56dvh]">
      <div className="roam-explore-stage-map absolute inset-0">
        <LeafletTripMap
          cities={mapCities}
          exploreSelectMode
          disableAutoFit
          locale={lang}
          onExploreClick={handleExploreClick}
          onCityRemove={onRemoveCity}
          cityRemoveLabel={labels.remove}
        />
        <style>{`
          .roam-explore-stage-map .roam-trip-map {
            height: 100%;
            border-radius: 0;
          }
          /* The map's built-in route legend duplicates the selected-city
             chips below; hide it in exploration mode. */
          .roam-explore-stage-map nav[aria-label="Trip route"] {
            display: none;
          }
        `}</style>
      </div>

      <div className="absolute inset-x-3 top-3 sm:inset-x-4 sm:top-4">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="rounded-2xl border border-white/80 bg-white/92 p-1.5 shadow-[0_18px_44px_-26px_rgba(32,41,46,0.5)] backdrop-blur">
            <div className="flex items-center gap-2 px-2">
              {searching ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-fg-muted" />
              )}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.search_placeholder}
                className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-muted"
              />
              {query ? (
                <button
                  type="button"
                  aria-label={labels.remove}
                  onClick={() => setQuery("")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <AnimatePresence>
              {searched && query.trim().length >= 2 ? (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden border-t border-divider"
                >
                  {results.length === 0 ? (
                    <li className="px-3 py-3 text-[12.5px] text-fg-muted">
                      {searching ? labels.searching : labels.no_results}
                    </li>
                  ) : (
                    results.map((result) => {
                      const added = selectedKeys.has(result.name.toLowerCase());
                      return (
                        <li key={result.id}>
                          <button
                            type="button"
                            disabled={added}
                            onClick={() => {
                              setQuery("");
                              setResults([]);
                              setSearched(false);
                              void onAddCity({
                                name: result.name,
                                lat: result.lat,
                                lng: result.lng,
                                country_code: result.countryCode ?? null,
                              });
                            }}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                              added
                                ? "cursor-default opacity-50"
                                : "hover:bg-[rgba(15,184,180,0.06)]",
                            )}
                          >
                            <MapPin className="h-4 w-4 shrink-0 text-accent" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold text-fg">
                                {result.name}
                              </span>
                              <span className="block truncate text-[12px] text-fg-muted">
                                {result.address}
                              </span>
                            </span>
                            {!added ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent">
                                <Plus className="h-3 w-3" />
                                {labels.add}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </motion.ul>
              ) : null}
            </AnimatePresence>
          </div>
          {cities.length > 0 ? (
            <p className="mx-auto mt-2 w-fit rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-medium text-fg-muted shadow-sm backdrop-blur">
              {labels.map_hint}
            </p>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {resolvingPoint || candidate ? (
          <motion.div
            key={candidate ? `cand-${candidate.id}` : "resolving"}
            className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-4 sm:bottom-[72px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="flex items-center gap-2.5 rounded-full border border-white/80 bg-white/95 py-1.5 pl-4 pr-1.5 shadow-[0_18px_44px_-22px_rgba(32,41,46,0.55)] backdrop-blur">
              {resolvingPoint ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span className="text-[13px] font-medium text-fg-muted">
                    {labels.searching}
                  </span>
                </>
              ) : candidate ? (
                <>
                  <MapPin className="h-4 w-4 shrink-0 text-accent" />
                  <span className="max-w-[200px] truncate text-[13.5px] font-semibold text-fg">
                    {candidate.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = candidate;
                      setCandidate(null);
                      void onAddCity({
                        name: next.name,
                        lat: next.lat,
                        lng: next.lng,
                        country_code: next.countryCode ?? null,
                      });
                    }}
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {labels.add}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCandidate(null)}
                    className="inline-flex h-9 items-center rounded-full border border-divider bg-white px-3 text-[12.5px] font-semibold text-fg-secondary"
                  >
                    {labels.cancel}
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {cities.length > 0 ? (
        <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/80 bg-white/88 px-3 py-2 shadow-sm backdrop-blur">
            <span className="text-[11.5px] font-semibold text-fg-muted">
              {labels.selected_label}
            </span>
            <span className="order-last ml-auto">
              <button
                type="button"
                onClick={onNext}
                disabled={!nextEnabled}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full bg-fg px-3.5 text-[12.5px] font-semibold text-white",
                  !nextEnabled && "cursor-not-allowed opacity-45",
                )}
              >
                {labels.next_flights}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </span>
            <AnimatePresence>
              {cities.map((city, index) => (
                <motion.span
                  key={`${city.name}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.6, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-softer px-2.5 py-1 text-[12px] font-semibold text-fg"
                >
                  {city.name}
                  <button
                    type="button"
                    aria-label={`${labels.remove} ${city.name}`}
                    onClick={() => void onRemoveCity(index)}
                    className="grid h-4 w-4 place-items-center rounded-full text-fg-muted hover:text-fg"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Exploration flights (stage 2) ───────────────────────────────────────

export interface ExploreFlightLeg {
  key: string;
  kind: "outbound" | "intercity" | "return";
  from: string | null;
  to: string | null;
  /* Pin whose activation on the map selects this leg. */
  mapCityIndex: number;
  /* Map leg highlight: index of the departure city, when on the map. */
  legFromIndex: number | null;
}

export interface ExploreFlightDetails {
  departureDate: string;
  departureTime: string;
  flightNumber: string;
  terminal: string;
  gate: string;
}

export function buildExploreFlights(cities: ExploreCity[]): ExploreFlightLeg[] {
  if (cities.length === 0) return [];
  const legs: ExploreFlightLeg[] = [
    {
      key: "outbound",
      kind: "outbound",
      from: null,
      to: cities[0]!.name,
      mapCityIndex: 0,
      legFromIndex: null,
    },
  ];
  for (let i = 1; i < cities.length; i++) {
    legs.push({
      key: `leg-${i}`,
      kind: "intercity",
      from: cities[i - 1]!.name,
      to: cities[i]!.name,
      mapCityIndex: i,
      legFromIndex: i - 1,
    });
  }
  legs.push({
    key: "return",
    kind: "return",
    from: cities[cities.length - 1]!.name,
    to: null,
    mapCityIndex: cities.length - 1,
    legFromIndex: null,
  });
  return legs;
}

function exploreFlightTitle(
  leg: ExploreFlightLeg,
  departure: ExploreDeparturePlace | null,
  labels: TripPlanningLabels["explore_flights"],
): string {
  if (leg.kind === "outbound") {
    if (departure) {
      return labels.from_departure
        .replace("{from}", departure.name)
        .replace("{to}", leg.to ?? "");
    }
    return labels.from_home.replace("{to}", leg.to ?? "");
  }
  if (leg.kind === "return") {
    if (departure) {
      return labels.to_departure
        .replace("{from}", leg.from ?? "")
        .replace("{to}", departure.name);
    }
    return labels.to_home.replace("{from}", leg.from ?? "");
  }
  return labels.leg
    .replace("{from}", leg.from ?? "")
    .replace("{to}", leg.to ?? "");
}

function googleFlightsHref(
  leg: ExploreFlightLeg,
  departure: ExploreDeparturePlace | null,
): string {
  const query =
    leg.kind === "outbound"
      ? departure
        ? `flights from ${departure.name} to ${leg.to}`
        : `flights to ${leg.to}`
      : leg.kind === "return"
        ? departure
          ? `flights from ${leg.from} to ${departure.name}`
          : `flights from ${leg.from}`
        : `flights from ${leg.from} to ${leg.to}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export function ExploreFlightsBoard({
  cities,
  flights,
  departure,
  selectedIndex,
  onSelect,
  onBack,
  onRequestDeparture,
  labels,
}: {
  cities: ExploreCity[];
  flights: ExploreFlightLeg[];
  departure: ExploreDeparturePlace | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onBack: () => void;
  onRequestDeparture: () => void;
  labels: TripPlanningLabels["explore_flights"];
}) {
  const mapCities = useMemo(() => {
    const tripCities = cities.map((city, index) => ({
      name: city.name,
      lat: city.lat,
      lng: city.lng,
      label: String(index + 1),
    }));
    if (!departure) return tripCities;
    return [
      {
        name: departure.name,
        lat: departure.lat,
        lng: departure.lng,
        label: labels.departure_pin,
      },
      ...tripCities,
    ];
  }, [cities, departure, labels.departure_pin]);
  const selected = flights[selectedIndex] ?? null;
  const departureOffset = departure ? 1 : 0;
  const activeCityIndex = selected
    ? selected.kind === "return" && departure
      ? 0
      : selected.mapCityIndex + departureOffset
    : null;
  const activeCity =
    activeCityIndex != null ? mapCities[activeCityIndex]?.name ?? null : null;
  const legFromIndex = selected
    ? selected.kind === "outbound" && departure
      ? 0
      : selected.kind === "return" && departure
        ? cities.length
        : selected.legFromIndex != null
          ? selected.legFromIndex + departureOffset
          : null
    : null;
  const legFrom =
    legFromIndex != null ? mapCities[legFromIndex]?.name ?? null : null;

  return (
    <div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-1 rounded-full border border-divider bg-white px-3.5 text-[13px] font-semibold text-fg-secondary shadow-sm transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" />
          {labels.back}
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-fg">
            <Plane className="h-4 w-4 text-accent" />
            {labels.title}
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white">
            {labels.count.replace("{n}", String(flights.length))}
          </span>
        </div>
      </div>
      <section className="relative mt-3 h-[52svh] min-h-[380px] overflow-hidden rounded-[22px] border border-white/80 bg-[#efe7d9] shadow-[0_24px_80px_-58px_rgba(32,41,46,0.5)] sm:rounded-[24px] xl:h-[56dvh]">
        {mapCities.length > 0 ? (
          <div className="roam-explore-stage-map absolute inset-0">
            <LeafletTripMap
              cities={mapCities}
              activeCity={activeCity}
              activeCityIndex={activeCityIndex}
              activeLegFrom={legFrom}
              activeLegFromIndex={legFromIndex}
              onCityActivate={(sourceIndex) => {
                if (departure && sourceIndex === 0) {
                  onSelect(selected?.kind === "return" ? flights.length - 1 : 0);
                  return;
                }
                const cityIndex = sourceIndex - departureOffset;
                const match = flights.findIndex(
                  (leg) =>
                    leg.kind !== "return" && leg.mapCityIndex === cityIndex,
                );
                if (match >= 0) onSelect(match);
              }}
            />
            <style>{`
              .roam-explore-stage-map .roam-trip-map {
                height: 100%;
                border-radius: 0;
              }
              .roam-explore-stage-map nav[aria-label="Trip route"] {
                display: none;
              }
            `}</style>
          </div>
        ) : null}
        <p className="absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 truncate rounded-full bg-white/85 px-3.5 py-1.5 text-[12px] font-medium text-fg-secondary shadow-sm backdrop-blur">
          {labels.map_hint}
        </p>
        {!departure ? (
          <div className="absolute left-4 top-4 max-w-[320px] rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur">
            <p className="text-[13px] font-semibold text-fg">
              {labels.departure_missing_title}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-fg-muted">
              {labels.departure_missing_body}
            </p>
            <button
              type="button"
              onClick={onRequestDeparture}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-fg px-3 text-[12px] font-semibold text-white transition-colors hover:bg-fg-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
              {labels.departure_set_cta}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ExploreFlightsPanel({
  flights,
  departure,
  departurePlaces,
  selectedIndex,
  onSelect,
  onBack,
  onDepartureSelect,
  onRequestDeparture,
  flightDetails,
  onFlightDetailsChange,
  labels,
}: {
  flights: ExploreFlightLeg[];
  departure: ExploreDeparturePlace | null;
  departurePlaces: ExploreDeparturePlace[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onBack: () => void;
  onDepartureSelect: (placeId: string) => void;
  onRequestDeparture: () => void;
  flightDetails: Record<string, ExploreFlightDetails>;
  onFlightDetailsChange: (
    legKey: string,
    details: ExploreFlightDetails,
  ) => void;
  labels: TripPlanningLabels["explore_flights"];
}) {
  const [departureQuery, setDepartureQuery] = useState("");
  const [expandedLegKey, setExpandedLegKey] = useState<string | null>(null);
  const filteredDeparturePlaces = useMemo(() => {
    const clean = departureQuery.trim().toLowerCase();
    if (!clean) return departurePlaces;
    return departurePlaces.filter((place) =>
      `${place.name} ${place.address}`.toLowerCase().includes(clean),
    );
  }, [departurePlaces, departureQuery]);

  return (
    <aside className="flex min-h-0 flex-col rounded-[24px] border border-white/80 bg-white/85 shadow-[0_24px_80px_-58px_rgba(32,41,46,0.5)] backdrop-blur xl:overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
            <Plane className="h-4 w-4 text-accent" />
            {labels.title}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-fg-muted">
            {labels.count.replace("{n}", String(flights.length))}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-divider bg-white px-3 text-[12.5px] font-semibold text-fg-secondary transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {labels.back}
        </button>
      </div>
      <div className="border-b border-divider p-4">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-divider bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-accent/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  {labels.departure_label}
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-fg">
                  {departure?.name ?? labels.departure_missing_title}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] rounded-2xl bg-white p-2">
            {departurePlaces.length > 3 ? (
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                <Input
                  value={departureQuery}
                  onChange={(event) => setDepartureQuery(event.target.value)}
                  placeholder={labels.departure_search_placeholder}
                  className="h-9 rounded-xl pl-8 text-[13px]"
                />
              </div>
            ) : null}
            {filteredDeparturePlaces.length > 0 ? (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filteredDeparturePlaces.map((place) => {
                  const active = place.id === departure?.id;
                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-fg hover:bg-muted/60",
                      )}
                      onClick={() => onDepartureSelect(place.id)}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {place.name}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-fg-muted">
                          {place.address}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-2 text-[12px] leading-5 text-fg-muted">
                {departurePlaces.length === 0
                  ? labels.departure_missing_body
                  : labels.departure_no_results}
              </p>
            )}
            <button
              type="button"
              onClick={onRequestDeparture}
              className="mt-1 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft"
            >
              <Plus className="h-4 w-4" />
              {departure ? labels.departure_change_cta : labels.departure_set_cta}
            </button>
          </PopoverContent>
        </Popover>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {flights.map((leg, index) => {
          const active = index === selectedIndex;
          const details = flightDetails[leg.key] ?? EMPTY_EXPLORE_FLIGHT_DETAILS;
          const expanded = expandedLegKey === leg.key;
          return (
            <motion.div
              key={leg.key}
              onClick={() => {
                onSelect(index);
                setExpandedLegKey((current) =>
                  current === leg.key ? null : leg.key,
                );
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: index * 0.05 }}
              className={cn(
                "block w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-shadow",
                expanded
                  ? "border-accent bg-accent-softer/55 shadow-[0_18px_36px_-24px_rgba(15,184,180,0.7)]"
                  : active
                    ? "border-accent/50 bg-white shadow-sm hover:shadow-md"
                    : "border-divider bg-white shadow-sm hover:shadow-md",
              )}
            >
              <div className="flex w-full items-start justify-between gap-2 text-left">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                    active ? "bg-accent text-white" : "bg-accent-soft text-accent",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-fg-muted">
                    {leg.kind === "outbound"
                      ? labels.outbound
                      : leg.kind === "return"
                        ? labels.return_flight
                        : labels.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] font-semibold text-fg">
                    {exploreFlightTitle(leg, departure, labels)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[rgba(224,122,63,0.12)] px-2.5 py-1 text-[11px] font-semibold text-[#b25a25]">
                  {labels.pending}
                </span>
              </div>
              <FlightDetailsSummary details={details} labels={labels} />
              {expanded ? (
                <div onClick={(event) => event.stopPropagation()}>
                  <FlightDetailsFields
                    key={`${leg.key}:${details.departureDate}:${details.departureTime}:${details.flightNumber}:${details.terminal}:${details.gate}`}
                    legKey={leg.key}
                    details={details}
                    labels={labels}
                    onChange={onFlightDetailsChange}
                  />
                </div>
              ) : null}
              <a
                href={googleFlightsHref(leg, departure)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-divider bg-white px-3 text-[12px] font-semibold text-fg-secondary transition-colors hover:text-fg"
              >
                {labels.search_flights}
                <ExternalLink className="h-3 w-3" />
              </a>
            </motion.div>
          );
        })}
      </div>
    </aside>
  );
}

const EMPTY_EXPLORE_FLIGHT_DETAILS: ExploreFlightDetails = {
  departureDate: "",
  departureTime: "",
  flightNumber: "",
  terminal: "",
  gate: "",
};

function FlightDetailsSummary({
  details,
  labels,
}: {
  details: ExploreFlightDetails;
  labels: TripPlanningLabels["explore_flights"];
}) {
  const items = [
    details.departureDate
      ? {
          key: "date",
          label: compactDate(details.departureDate),
        }
      : null,
    details.departureTime
      ? { key: "time", label: details.departureTime }
      : null,
    details.flightNumber
      ? { key: "flight", label: details.flightNumber }
      : null,
    details.terminal
      ? {
          key: "terminal",
          label: `${labels.terminal_label} ${details.terminal}`,
        }
      : null,
    details.gate
      ? {
          key: "gate",
          label: `${labels.gate_label} ${details.gate}`,
        }
      : null,
  ].filter((item): item is { key: string; label: string } => item != null);

  if (items.length === 0) {
    return (
      <p className="mt-2 text-[12px] font-medium text-fg-muted">
        {labels.flight_details_empty}
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          className="rounded-full border border-divider bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-fg-secondary"
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function FlightDetailsFields({
  legKey,
  details,
  labels,
  onChange,
}: {
  legKey: string;
  details: ExploreFlightDetails;
  labels: TripPlanningLabels["explore_flights"];
  onChange: (legKey: string, details: ExploreFlightDetails) => void;
}) {
  const [draft, setDraft] = useState(details);

  function update(field: keyof ExploreFlightDetails, value: string) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      onChange(legKey, next);
      return next;
    });
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-fg-muted">
            {labels.departure_date_label}
          </span>
          <Input
            type="date"
            value={draft.departureDate}
            onChange={(event) => update("departureDate", event.target.value)}
            onInput={(event) =>
              update("departureDate", event.currentTarget.value)
            }
            className="h-9 rounded-xl bg-white text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-fg-muted">
            {labels.departure_time_label}
          </span>
          <Input
            type="time"
            value={draft.departureTime}
            onChange={(event) => update("departureTime", event.target.value)}
            onInput={(event) =>
              update("departureTime", event.currentTarget.value)
            }
            className="h-9 rounded-xl bg-white text-[12px]"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-fg-muted">
            {labels.flight_number_label}
          </span>
          <Input
            value={draft.flightNumber}
            onChange={(event) => update("flightNumber", event.target.value)}
            placeholder={labels.flight_number_placeholder}
            className="h-9 rounded-xl bg-white text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-fg-muted">
            {labels.terminal_label}
          </span>
          <Input
            value={draft.terminal}
            onChange={(event) => update("terminal", event.target.value)}
            placeholder={labels.terminal_placeholder}
            className="h-9 rounded-xl bg-white text-[12px]"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-fg-muted">
            {labels.gate_label}
          </span>
          <Input
            value={draft.gate}
            onChange={(event) => update("gate", event.target.value)}
            placeholder={labels.gate_placeholder}
            className="h-9 rounded-xl bg-white text-[12px]"
          />
        </label>
      </div>
    </div>
  );
}

function compactDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}

// ── Date range picker pill ──────────────────────────────────────────────

function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TripDateRangePicker({
  id,
  startDate,
  endDate,
  dayCount,
  editable,
  glow,
  labels,
  dayUnit,
  onChange,
}: {
  id?: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  editable: boolean;
  glow: boolean;
  labels: TripPlanningLabels["date_range"];
  dayUnit: string;
  onChange: (startDate: string, endDate: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const pill = (
    <div
      id={id}
      className={cn(
        "rounded-full border px-3 py-1 text-right text-[12px] font-semibold shadow-sm backdrop-blur transition-shadow duration-500",
        glow
          ? "roam-daterange-glow border-accent/60 bg-accent-softer text-fg"
          : "border-white/80 bg-white/78 text-fg-muted",
        editable && "cursor-pointer hover:border-accent/40 hover:text-fg",
      )}
      title={editable ? labels.aria_label : labels.locked_hint}
    >
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-accent" />
        {startDate} - {endDate}（{dayCount} {dayUnit}）
      </span>
      <style>{`
        .roam-daterange-glow {
          box-shadow: 0 0 0 4px rgba(15,184,180,0.18), 0 10px 30px -12px rgba(15,184,180,0.55);
          animation: roam-daterange-pulse 1.4s ease-in-out 2;
        }
        @keyframes roam-daterange-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(15,184,180,0.18), 0 10px 30px -12px rgba(15,184,180,0.55); }
          50% { box-shadow: 0 0 0 9px rgba(15,184,180,0.1), 0 14px 36px -12px rgba(15,184,180,0.7); }
        }
        @media (prefers-reduced-motion: reduce) {
          .roam-daterange-glow { animation: none; }
        }
      `}</style>
    </div>
  );

  if (!editable) return pill;

  const selected: DateRange | undefined =
    range?.from || range?.to
      ? range
      : { from: parseIsoDate(startDate), to: parseIsoDate(endDate) };
  const canApply = Boolean(range?.from && range?.to);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRange(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={labels.aria_label}>
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto rounded-2xl p-2.5">
        <Calendar
          mode="range"
          numberOfMonths={1}
          defaultMonth={selected.from}
          selected={selected}
          onSelect={(next: DateRange | undefined) => setRange(next)}
        />
        <button
          type="button"
          disabled={!canApply || saving}
          onClick={async () => {
            if (!range?.from || !range?.to) return;
            setSaving(true);
            try {
              await onChange(toIsoDate(range.from), toIsoDate(range.to));
              setOpen(false);
            } finally {
              setSaving(false);
            }
          }}
          className={cn(
            "mt-1 inline-flex h-10 w-full items-center justify-center rounded-xl bg-accent text-[13px] font-semibold text-white",
            (!canApply || saving) && "cursor-not-allowed opacity-50",
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : labels.apply}
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ── Lumi takeover overlay ───────────────────────────────────────────────

interface TakeoverFrameCity {
  name: string;
  lat?: number | null;
  lng?: number | null;
  country_code?: string | null;
}

interface TakeoverFrame {
  start_date: string;
  end_date: string;
  cities: TakeoverFrameCity[];
  flight_details?: TakeoverFlightDetails[] | null;
}

export interface TakeoverFlightDetails {
  leg_key: string;
  departure_date?: string | null;
  departure_time?: string | null;
  flight_number?: string | null;
  terminal?: string | null;
  gate?: string | null;
}

type TakeoverStepResponse =
  | { step: string; status: "question"; question: { text: string; options: string[] } }
  | { step: "frame"; status: "complete"; frame: TakeoverFrame };

type TakeoverPhase =
  | "intro"
  | "thinking"
  | "asking"
  | "dates"
  | "places"
  | "done"
  | "failed";

export function LumiTakeoverOverlay({
  prompt,
  labels,
  avatarSrc,
  dateTargetId,
  onApplyDates,
  onAddCity,
  onApplyFlightDetails,
  onDismiss,
}: {
  prompt: string;
  labels: TripPlanningLabels["lumi_takeover"];
  avatarSrc: string;
  dateTargetId: string;
  onApplyDates: (startDate: string, endDate: string) => Promise<void>;
  onAddCity: (city: ExploreCity) => Promise<void>;
  onApplyFlightDetails?: (details: TakeoverFlightDetails[]) => Promise<void>;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<TakeoverPhase>("intro");
  const [question, setQuestion] = useState<{ text: string; options: string[] } | null>(null);
  const [answer, setAnswer] = useState("");
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const qaRef = useRef<Array<{ step: "frame"; question: string; answer: string }>>([]);
  const frameRef = useRef<TakeoverFrame | null>(null);
  /* The parent passes inline callbacks whose identity changes every render
     (each PATCH triggers a refresh → re-render). Read them through refs so
     runStep stays referentially stable and the start effect fires once —
     otherwise every render schedules another journey call. */
  const onApplyDatesRef = useRef(onApplyDates);
  const onAddCityRef = useRef(onAddCity);
  const onApplyFlightDetailsRef = useRef(onApplyFlightDetails);
  const choreographyStartedRef = useRef(false);
  useEffect(() => {
    onApplyDatesRef.current = onApplyDates;
    onAddCityRef.current = onAddCity;
    onApplyFlightDetailsRef.current = onApplyFlightDetails;
  });

  const runChoreography = useCallback(
    async (frame: TakeoverFrame) => {
      frameRef.current = frame;
      choreographyStartedRef.current = true;
      /* Beat 1 — fly the avatar to the date pill, tap, apply dates. */
      setPhase("dates");
      const target = document.getElementById(dateTargetId);
      if (target && !reduced) {
        const rect = target.getBoundingClientRect();
        setFlight({
          x: rect.left - 48,
          y: rect.top + rect.height / 2 - 22,
        });
        await new Promise((resolve) => setTimeout(resolve, 1250));
      }
      await onApplyDatesRef.current(frame.start_date, frame.end_date);
      await new Promise((resolve) => setTimeout(resolve, reduced ? 150 : 1100));
      setFlight(null);
      /* Beat 2 — drop the city pins one by one. */
      setPhase("places");
      const cities = frame.cities.filter(
        (city): city is TakeoverFrameCity & { lat: number; lng: number } =>
          typeof city.lat === "number" && typeof city.lng === "number",
      );
      for (const city of cities) {
        await onAddCityRef.current({
          name: city.name,
          lat: city.lat,
          lng: city.lng,
          country_code: city.country_code ?? null,
        });
        await new Promise((resolve) => setTimeout(resolve, reduced ? 80 : 460));
      }
      if (frame.flight_details?.length && onApplyFlightDetailsRef.current) {
        await onApplyFlightDetailsRef.current(frame.flight_details);
      }
      setPhase("done");
    },
    [dateTargetId, reduced],
  );

  const runStep = useCallback(async () => {
    if (choreographyStartedRef.current) return;
    setPhase("thinking");
    try {
      const res = await fetch("/api/lumi/journey/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          current_date: new Date().toISOString().slice(0, 10),
          qa: qaRef.current,
          frame: null,
          anchors: null,
          days: [],
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (TakeoverStepResponse & { error?: string; message?: string })
        | null;
      if (!res.ok || !data || data.error) {
        throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      }
      if (data.status === "question") {
        setQuestion({
          text: data.question.text,
          options: data.question.options ?? [],
        });
        setPhase("asking");
        return;
      }
      if (data.step === "frame" && data.status === "complete") {
        await runChoreography(data.frame);
        return;
      }
      throw new Error("unexpected journey step");
    } catch {
      setPhase("failed");
    }
  }, [prompt, runChoreography]);

  useEffect(() => {
    /* No "started" guard: StrictMode runs this twice and cancels the first
       timer in cleanup, so guarding would mean the step never fires. The
       cleanup keeps it single-shot instead. */
    const timer = setTimeout(() => void runStep(), reduced ? 250 : 1400);
    return () => clearTimeout(timer);
  }, [runStep, reduced]);

  const handleAnswer = (text: string) => {
    const clean = text.trim();
    if (!clean || !question) return;
    qaRef.current = [
      ...qaRef.current,
      { step: "frame", question: question.text, answer: clean },
    ];
    setQuestion(null);
    setAnswer("");
    void runStep();
  };

  const speech =
    phase === "intro"
      ? labels.intro
      : phase === "thinking"
        ? labels.intro
        : phase === "asking"
          ? question?.text ?? labels.asking
          : phase === "dates"
            ? labels.dates
            : phase === "places"
              ? labels.places
              : phase === "failed"
                ? labels.failed
                : labels.done;

  return (
    <>
      <AnimatePresence>
        {flight ? (
          <motion.div
            key="flying-avatar"
            className="pointer-events-none fixed z-[80] h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-[0_14px_30px_-12px_rgba(15,184,180,0.8)]"
            initial={{
              left:
                typeof window === "undefined" ? 0 : window.innerWidth - 120,
              top:
                typeof window === "undefined" ? 0 : window.innerHeight - 170,
              scale: 1,
            }}
            animate={{
              left: flight.x,
              top: flight.y,
              scale: [1, 1, 0.86, 1.05, 1],
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 1.25, ease: EASE, times: [0, 0.7, 0.82, 0.92, 1] }}
          >
            <Image src={avatarSrc} alt="" fill sizes="44px" className="object-cover" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className="fixed bottom-5 right-4 z-[75] w-[min(92vw,360px)] sm:right-6"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-[0_32px_72px_-32px_rgba(17,17,32,0.45)] backdrop-blur-xl">
          <div className="flex items-start gap-3 p-4">
            <div
              className={cn(
                "relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md transition-opacity",
                flight && "opacity-0",
              )}
            >
              <Image src={avatarSrc} alt="Lumi" fill sizes="44px" className="object-cover" />
              {(phase === "thinking" || phase === "dates" || phase === "places") ? (
                <span className="absolute inset-0 animate-pulse rounded-full bg-accent/10" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={speech}
                  className="text-[13.5px] font-medium leading-6 text-fg"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  {speech}
                </motion.p>
              </AnimatePresence>
              {phase === "thinking" || phase === "dates" || phase === "places" ? (
                <span className="mt-2 flex items-center gap-1" aria-hidden>
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
                      style={{ animationDelay: `${dot * 170}ms`, animationDuration: "1.1s" }}
                    />
                  ))}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={labels.dismiss}
              onClick={onDismiss}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-muted hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {phase === "asking" && question ? (
            <div className="border-t border-divider px-4 pb-4 pt-3">
              {question.options.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {question.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      className="rounded-full border border-accent/30 bg-accent-softer px-3 py-1.5 text-[12.5px] font-semibold text-fg transition-colors hover:border-accent/60"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      handleAnswer(answer);
                    }
                  }}
                  placeholder={labels.answer_placeholder}
                  className="h-10 min-w-0 flex-1 rounded-full border border-divider bg-white px-3.5 text-[13px] text-fg outline-none placeholder:text-fg-muted focus:border-accent/50"
                />
                <button
                  type="button"
                  aria-label={labels.send}
                  onClick={() => handleAnswer(answer)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {phase === "done" || phase === "failed" ? (
            <div className="border-t border-divider px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-fg text-[13px] font-semibold text-white"
              >
                {labels.dismiss}
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
