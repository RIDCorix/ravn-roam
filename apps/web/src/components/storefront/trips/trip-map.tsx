"use client";

import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type {
  GeometryCollection,
  Topology,
} from "topojson-specification";

import { googleMapsMapId, loadGoogleMaps, loadGoogleRoutes } from "@/lib/google-maps";

export interface TripMapCity {
  name: string;
  lat: number | null;
  lng: number | null;
  label?: string;
  date?: string;
  kind?: string | null;
  travelModeToNext?: TravelModeKind;
  travelLabelToNext?: string;
}

export type TripMapTravelStop = {
  name: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: string | null;
  sourceIndex?: number;
  travelModeToNext?: TravelModeKind;
  travelLabelToNext?: string;
};

interface LocatedCity extends TripMapTravelStop {
  date?: string;
}

type SearchMarker = {
  id?: string;
  placeId?: string;
  name: string;
  lat: number;
  lng: number;
  selected?: boolean;
};
export type TripMapPoiClick = {
  placeId: string;
  lat: number;
  lng: number;
};
export type TripMapExploreClick = {
  lat: number;
  lng: number;
  placeId: string | null;
  countryName?: string | null;
  countryCode?: string | null;
};
export type TripMapPoiHighlight = SearchMarker & {
  iconMaskUri?: string | null;
  iconBackgroundColor?: string | null;
};
export type TripMapViewport = {
  center: google.maps.LatLngLiteral;
  radiusMeters: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};
export type TravelModeKind = "walk" | "drive" | "transit" | "flight";
export type TravelSegment = {
  fromIndex: number;
  toIndex: number;
  position: google.maps.LatLngLiteral;
  path: google.maps.LatLngLiteral[];
  mode: TravelModeKind;
  distanceKm: number;
  durationMin: number;
  durationText: string;
  label?: string;
};
export type TripMapActiveTravelSegment = {
  fromIndex: number;
  toIndex: number;
  focusKey?: string | null;
};

export type TripMapTravelLabels = {
  walk: string;
  drive: string;
  transit: string;
  flight: string;
  min: string;
  hour: string;
  hour_min: string;
};

const ROUTE_COLORS = [
  "#d6526f",
  "#f39b2f",
  "#54ad8d",
  "#4b91c9",
  "#7a5ac7",
  "#0fb8b4",
];

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function cssVar(element: HTMLElement | null, name: string, fallback: string) {
  if (!element) return fallback;
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function toLatLng(city: TripMapTravelStop | SearchMarker): google.maps.LatLngLiteral {
  return { lat: city.lat, lng: city.lng };
}

function isSameSearchMarker(a: SearchMarker, b: SearchMarker): boolean {
  if (a.id && b.id) return a.id === b.id;
  return (
    a.name === b.name &&
    Math.abs(a.lat - b.lat) < 0.000001 &&
    Math.abs(a.lng - b.lng) < 0.000001
  );
}

type MapOverlay = { setMap(map: google.maps.Map | null): void };
type GooglePoiStyleOverlay = google.maps.OverlayView & {
  updateHighlight(options: {
    title: string;
    iconMaskUri?: string | null;
    iconBackgroundColor?: string | null;
    selected?: boolean;
  }): void;
};
type BoundaryPath = google.maps.LatLngLiteral[];
type BoundaryLookupResult = {
  title: string;
  paths: BoundaryPath[];
};
type CountryBoundaryLookupResult = BoundaryLookupResult & {
  countryCode: string | null;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};
type BoundaryOverlay = MapOverlay & {
  sourceIndex: number;
  setActive(active: boolean): void;
};
type CountryHoverLabel = {
  title: string;
  x: number;
  y: number;
};
type WorldTopology = Topology<{ countries: GeometryCollection }>;
const COUNTRY_BOUNDARY_SOURCE_INDEX = -2_000_000;
const COUNTRY_ATLAS_NAME_ALIASES: Record<string, string> = {
  "Bosnia and Herz.": "BA",
  Brunei: "BN",
  "Central African Rep.": "CF",
  "Côte d'Ivoire": "CI",
  "Czechia": "CZ",
  "Dem. Rep. Congo": "CD",
  "Dominican Rep.": "DO",
  "Eq. Guinea": "GQ",
  "Falkland Is.": "FK",
  "Fr. S. Antarctic Lands": "TF",
  Greenland: "GL",
  Kosovo: "XK",
  Laos: "LA",
  Macedonia: "MK",
  Moldova: "MD",
  "N. Cyprus": "CY",
  Palestine: "PS",
  Russia: "RU",
  "S. Sudan": "SS",
  Somaliland: "SO",
  "South Korea": "KR",
  Syria: "SY",
  Taiwan: "TW",
  Tanzania: "TZ",
  "United States of America": "US",
  Vietnam: "VN",
  "W. Sahara": "EH",
};
let englishRegionNameToCodeCache: Map<string, string> | null = null;

export function TripMap({
  cities,
  activeCity,
  activeCityIndex,
  activeLegFrom,
  activeLegFromIndex,
  dayStops,
  activeStopIndex,
  activeStopFocusKey,
  focusActiveStopOnly = false,
  activeTravelSegment,
  panToActiveStop = true,
  disableAutoFit = false,
  travelLabels,
  searchMarker,
  searchResults = [],
  poiHighlight,
  poiFilterActive = false,
  onCityActivate,
  onStopActivate,
  onSearchResultActivate,
  onCityRemove,
  cityRemoveLabel = "Remove",
  onSearchMarkerDrag,
  onViewportChange,
  onPoiClick,
  locale = "en",
  exploreSelectMode = false,
  onExploreClick,
}: {
  cities: TripMapCity[];
  activeCity?: string | null;
  activeCityIndex?: number | null;
  activeLegFrom?: string | null;
  activeLegFromIndex?: number | null;
  dayStops?: Array<TripMapCity & { sourceIndex?: number }>;
  activeStopIndex?: number | null;
  activeStopFocusKey?: string | null;
  focusActiveStopOnly?: boolean;
  activeTravelSegment?: TripMapActiveTravelSegment | null;
  panToActiveStop?: boolean;
  disableAutoFit?: boolean;
  travelLabels?: TripMapTravelLabels;
  searchMarker?: SearchMarker | null;
  searchResults?: SearchMarker[];
  poiHighlight?: TripMapPoiHighlight | null;
  poiFilterActive?: boolean;
  onCityActivate?: (sourceIndex: number) => void;
  onStopActivate?: (sourceIndex: number) => void;
  onSearchResultActivate?: (sourceIndex: number) => void;
  onCityRemove?: (sourceIndex: number) => void;
  cityRemoveLabel?: string;
  onSearchMarkerDrag?: (position: { lat: number; lng: number }) => void;
  onViewportChange?: (viewport: TripMapViewport) => void;
  onPoiClick?: (poi: TripMapPoiClick) => void;
  locale?: string;
  /* Exploration stage: crosshair cursor + hover ring, and every map click
     (POI or bare ground) reports its coordinates instead of zooming in. */
  exploreSelectMode?: boolean;
  onExploreClick?: (point: TripMapExploreClick) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const viewportListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const overlaysRef = useRef<MapOverlay[]>([]);
  const countryBoundariesRef = useRef<CountryBoundaryLookupResult[]>([]);
  const hoverCountryOverlayRef = useRef<BoundaryOverlay | null>(null);
  const hoverCountryTitleRef = useRef<string | null>(null);
  const hoverCountrySelectionRef = useRef<{
    title: string;
    countryCode: string | null;
    lat: number;
    lng: number;
  } | null>(null);
  const poiOverlayRef = useRef<GooglePoiStyleOverlay | null>(null);
  const poiHighlightRef = useRef<TripMapPoiHighlight | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const initialCenterRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  const lastSearchCameraKeyRef = useRef<string | null>(null);
  const lastStopCameraKeyRef = useRef<string | null>(null);
  const lastPoiCameraKeyRef = useRef<string | null>(null);
  const lastPoiHighlightKeyRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [hoveredCitySourceIndex, setHoveredCitySourceIndex] = useState<number | null>(null);
  const [hoverCountryLabel, setHoverCountryLabel] = useState<CountryHoverLabel | null>(null);
  const poiHighlightStableKey = poiHighlight ? poiHighlightKey(poiHighlight) : null;
  const poiHighlightTitle = poiHighlight?.name ?? "";
  const poiHighlightLat = poiHighlight?.lat ?? null;
  const poiHighlightLng = poiHighlight?.lng ?? null;
  const poiHighlightIconMaskUri = poiHighlight?.iconMaskUri ?? null;
  const poiHighlightIconBackgroundColor = poiHighlight?.iconBackgroundColor ?? null;
  const poiHighlightSelected = poiHighlight?.selected === true;

  const located = useMemo<LocatedCity[]>(
    () =>
      cities.flatMap((c, sourceIndex) =>
        c.lat != null && c.lng != null
          ? [{
              name: c.name,
              lat: c.lat,
              lng: c.lng,
              label: c.label,
              date: c.date,
              kind: c.kind,
              sourceIndex,
            }]
          : [],
      ),
    [cities],
  );

  const center = useMemo<google.maps.LatLngLiteral>(() => {
    if (located.length === 0) return { lat: 35.6764, lng: 139.65 };
    return {
      lat: located.reduce((s, c) => s + c.lat, 0) / located.length,
      lng: located.reduce((s, c) => s + c.lng, 0) / located.length,
    };
  }, [located]);

  useEffect(() => {
    if (mapRef.current) return;
    initialCenterRef.current = center;
  }, [center]);

  const activeKey = activeCity ? normalizeName(activeCity) : null;
  const activeLocatedCity = useMemo(() => {
    if (activeCityIndex != null) {
      return located.find((c) => c.sourceIndex === activeCityIndex) ?? null;
    }
    if (!activeKey) return null;
    return located.find((c) => normalizeName(c.name) === activeKey) ?? null;
  }, [activeCityIndex, activeKey, located]);
  const activeLocatedSourceIndex = activeLocatedCity?.sourceIndex ?? null;
  const focusedCitySourceIndex = activeLocatedSourceIndex ?? hoveredCitySourceIndex;
  const hasActive = focusedCitySourceIndex != null;
  const activeLeg = useMemo<{ from: LocatedCity; to: LocatedCity } | null>(() => {
    if (!activeLocatedCity || !activeLegFrom) return null;
    const from = activeLegFromIndex != null
      ? located.find((c) => c.sourceIndex === activeLegFromIndex)
      : located.find((c) => normalizeName(c.name) === normalizeName(activeLegFrom));
    const to = activeLocatedCity;
    if (!from || !to) return null;
    if (from.sourceIndex === to.sourceIndex) return null;
    return { from, to };
  }, [activeLegFrom, activeLegFromIndex, activeLocatedCity, located]);

  const locatedStops = useMemo<LocatedCity[]>(
    () =>
      (dayStops ?? []).flatMap((s, sourceIndex) =>
        s.lat != null && s.lng != null
          ? [{
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              label: s.label,
              date: s.date,
              kind: s.kind,
              travelModeToNext: s.travelModeToNext,
              travelLabelToNext: s.travelLabelToNext,
              sourceIndex: s.sourceIndex ?? sourceIndex,
            }]
          : [],
      ),
    [dayStops],
  );
  const hasDayStops = locatedStops.length > 0;
  const activeStop =
    activeStopIndex != null
      ? locatedStops.find((stop) => stop.sourceIndex === activeStopIndex) ?? null
      : null;
  const activeTravelFromIndex = activeTravelSegment?.fromIndex ?? null;
  const activeTravelToIndex = activeTravelSegment?.toIndex ?? null;
  const activeTravelFocusKey = activeTravelSegment?.focusKey ?? null;

  useEffect(() => {
    let canceled = false;
    if (!mapElementRef.current || (located.length === 0 && !exploreSelectMode)) return;
    void loadGoogleMaps()
      .then(() => {
        if (canceled || !mapElementRef.current || mapRef.current) return;
        const initialCenter = initialCenterRef.current ?? { lat: 35.6764, lng: 139.65 };
        mapRef.current = new google.maps.Map(mapElementRef.current, {
          center: initialCenter,
          zoom: 5,
          mapId: googleMapsMapId,
          disableDefaultUI: true,
          clickableIcons: true,
          gestureHandling: "greedy",
          backgroundColor: "#e7f4f2",
          styles: googleMapsMapId ? undefined : ROAM_MAP_STYLE,
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!canceled) setLoadError(true);
      });
    return () => {
      canceled = true;
      if (cameraFrameRef.current) {
        window.cancelAnimationFrame(cameraFrameRef.current);
        cameraFrameRef.current = null;
      }
      viewportListenersRef.current.forEach((listener) => listener.remove());
      viewportListenersRef.current = [];
    };
  }, [exploreSelectMode, located.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setOptions({
      clickableIcons: !poiFilterActive,
      styles: googleMapsMapId
        ? undefined
        : poiFilterActive
          ? ROAM_MAP_STYLE_POI_FILTERED
          : ROAM_MAP_STYLE,
    });
  }, [mapReady, poiFilterActive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onPoiClick || poiFilterActive || exploreSelectMode) {
      return;
    }
    const listener = map.addListener(
      "click",
      (event: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
        if (!event.placeId || !event.latLng) return;
        event.stop?.();
        const position = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };
        animateMapCamera(map, cameraFrameRef, {
          center: position,
          zoom: Math.max(map.getZoom() ?? 5, 16),
          duration: 220,
        });
        onPoiClick({
          placeId: event.placeId,
          lat: position.lat,
          lng: position.lng,
        });
      },
    );
    return () => listener.remove();
  }, [mapReady, onPoiClick, poiFilterActive, exploreSelectMode]);

  useEffect(() => {
    const map = mapRef.current;
    const container = mapElementRef.current;
    if (!mapReady || !map || !container) {
      return;
    }
    const clickListener =
      exploreSelectMode && onExploreClick
        ? map.addListener(
            "click",
            (event: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
              if (!event.latLng) return;
              event.stop?.();
              const position = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
              };
              const country = hoverCountrySelectionRef.current ??
                (() => {
                  const match = findCountryBoundary(position, countryBoundariesRef.current);
                  return match
                    ? {
                        title: localizedCountryName(match, locale),
                        countryCode: match.countryCode,
                        lat: position.lat,
                        lng: position.lng,
                      }
                    : null;
                })();
              onExploreClick({
                lat: country?.lat ?? position.lat,
                lng: country?.lng ?? position.lng,
                placeId: event.placeId ?? null,
                countryName: country?.title ?? null,
                countryCode: country?.countryCode ?? null,
              });
            },
          )
        : null;
    if (exploreSelectMode) {
      map.setOptions({ draggableCursor: "crosshair" });
    }
    /* Country hover highlight via data-driven boundary styling. This stays
       on Google's vector feature layer and avoids per-cursor polygon fetches. */
    let boundaryLayer: google.maps.FeatureLayer | null = null;
    const boundaryListeners: google.maps.MapsEventListener[] = [];
    const mouseProjectionOverlay = createMouseProjectionOverlay();
    mouseProjectionOverlay.setMap(map);
    const hovered: { placeId: string | null; movedAt: number } = {
      placeId: null,
      movedAt: 0,
    };
    const boundaryStyle = (
      options: google.maps.FeatureStyleFunctionOptions,
    ): google.maps.FeatureStyleOptions | null => {
      const feature = options.feature as google.maps.PlaceFeature;
      if (feature.placeId && feature.placeId === hovered.placeId) {
        return {
          fillColor: "#FFFFFF",
          fillOpacity: 0.18,
          strokeColor: "#FFFFFF",
          strokeOpacity: 0.72,
          strokeWeight: 2,
        };
      }
      return null;
    };
    const setHoveredBoundary = (placeId: string | null) => {
      if (hovered.placeId === placeId || !boundaryLayer) return;
      hovered.placeId = placeId;
      /* Reassigning the style function forces the layer to restyle. */
      boundaryLayer.style = boundaryStyle;
    };
    const clearHoverCountryOverlay = () => {
      hoverCountryOverlayRef.current?.setMap(null);
      hoverCountryOverlayRef.current = null;
      hoverCountryTitleRef.current = null;
    };
    const clearHoverCountry = () => {
      clearHoverCountryOverlay();
      hoverCountrySelectionRef.current = null;
      setHoverCountryLabel(null);
    };
    const showHoverCountryOverlay = (result: CountryBoundaryLookupResult | null) => {
      if (!result) {
        clearHoverCountryOverlay();
        return;
      }
      if (hoverCountryTitleRef.current === result.title) return;
      hoverCountryOverlayRef.current?.setMap(null);
      hoverCountryTitleRef.current = result.title;
      const overlay = createBoundaryOverlay({
        paths: result.paths,
        sourceIndex: COUNTRY_BOUNDARY_SOURCE_INDEX,
        title: result.title,
        zIndex: 16,
        interactive: false,
        onHover: () => undefined,
        onLeave: () => undefined,
        onClick: () => undefined,
      });
      overlay.setMap(map);
      overlay.setActive(true);
      hoverCountryOverlayRef.current = overlay;
    };
    try {
      if (googleMapsMapId) {
        boundaryLayer = map.getFeatureLayer(google.maps.FeatureType.COUNTRY);
      }
    } catch {
      boundaryLayer = null;
    }
    if (boundaryLayer) {
      /* isAvailable is transient until the vector style finishes loading,
         so never gate on it up front — apply the style now and re-apply
         when the map reports a capabilities change. */
      boundaryLayer.style = boundaryStyle;
      boundaryListeners.push(
        boundaryLayer.addListener(
          "mousemove",
          (event: google.maps.FeatureMouseEvent) => {
            const feature = event.features?.[0] as
              | google.maps.PlaceFeature
              | undefined;
            hovered.movedAt = Date.now();
            setHoveredBoundary(feature?.placeId ?? null);
          },
        ),
      );
      boundaryListeners.push(
        map.addListener("mapcapabilities_changed", () => {
          if (boundaryLayer) boundaryLayer.style = boundaryStyle;
          if (process.env.NODE_ENV !== "production") {
            console.info(
              "[explore-map] capabilities:",
              map.getMapCapabilities(),
              "country available:",
              boundaryLayer?.isAvailable,
            );
          }
        }),
      );
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[explore-map] initial capabilities:",
          map.getMapCapabilities(),
          "country available:",
          boundaryLayer.isAvailable,
        );
      }
    }

    const handleMove = (event: MouseEvent) => {
      const hasRecentGoogleCountryHover = boundaryLayer && Date.now() - hovered.movedAt <= 140;
      if (boundaryLayer && !hasRecentGoogleCountryHover) {
        setHoveredBoundary(null);
      }
      const mapPoint = containerMousePointToLatLng(mouseProjectionOverlay, container, event);
      const country = mapPoint ? findCountryBoundary(mapPoint, countryBoundariesRef.current) : null;
      if (!hasRecentGoogleCountryHover) {
        showHoverCountryOverlay(country);
      } else {
        clearHoverCountryOverlay();
      }
      if (country) {
        hoverCountrySelectionRef.current = mapPoint
          ? {
              title: localizedCountryName(country, locale),
              countryCode: country.countryCode,
              lat: mapPoint.lat,
              lng: mapPoint.lng,
            }
          : null;
        const labelTitle = localizedCountryName(country, locale);
        const rect = container.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - rect.left, 12), rect.width - 12);
        const y = Math.min(Math.max(event.clientY - rect.top, 12), rect.height - 12);
        setHoverCountryLabel((current) =>
          current?.title === labelTitle &&
          Math.abs(current.x - x) < 1 &&
          Math.abs(current.y - y) < 1
            ? current
            : { title: labelTitle, x, y },
        );
      } else {
        hoverCountrySelectionRef.current = null;
        setHoverCountryLabel(null);
      }
      const target = event.target instanceof Element ? event.target : null;
      const cityCard = target?.closest<HTMLElement>(".roam-google-city-card");
      const citySourceIndex = Number(cityCard?.dataset.sourceIndex);
      if (!exploreSelectMode) {
        setHoveredCitySourceIndex(
          Number.isInteger(citySourceIndex)
            ? citySourceIndex
            : null,
        );
      }
    };
    const handleLeave = () => {
      setHoveredBoundary(null);
      setHoveredCitySourceIndex(null);
      clearHoverCountry();
    };
    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);
    return () => {
      clickListener?.remove();
      for (const listener of boundaryListeners) listener.remove();
      if (boundaryLayer) boundaryLayer.style = null;
      mouseProjectionOverlay.setMap(null);
      clearHoverCountry();
      if (exploreSelectMode) {
        map.setOptions({ draggableCursor: undefined });
      }
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
    };
  }, [mapReady, exploreSelectMode, locale, onExploreClick]);

  useEffect(() => {
    countryBoundariesRef.current = [];
    hoverCountryOverlayRef.current?.setMap(null);
    hoverCountryOverlayRef.current = null;
    hoverCountryTitleRef.current = null;

    if (!mapReady) {
      return;
    }

    let canceled = false;
    import("world-atlas/countries-110m.json")
      .then((mod) => {
        if (canceled) return;
        countryBoundariesRef.current = worldCountryBoundariesFromTopology(
          mod.default as unknown as WorldTopology,
        );
      })
      .catch(() => {
        if (!canceled) {
          countryBoundariesRef.current = [];
        }
      });

    return () => {
      canceled = true;
      countryBoundariesRef.current = [];
      hoverCountryOverlayRef.current?.setMap(null);
      hoverCountryOverlayRef.current = null;
      hoverCountryTitleRef.current = null;
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !onViewportChange) return;

    let viewportTimer: number | null = null;
    const emitViewport = () => {
      if (viewportTimer != null) {
        window.clearTimeout(viewportTimer);
        viewportTimer = null;
      }
      const bounds = map.getBounds();
      const centerValue = map.getCenter();
      if (!bounds || !centerValue) return;
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
      const center = { lat: centerValue.lat(), lng: centerValue.lng() };
      const radiusMeters = Math.min(
        50000,
        Math.max(
          250,
          distanceBetween(center, {
            lat: northEast.lat(),
            lng: northEast.lng(),
          }) * 1000,
        ),
      );
      onViewportChange({
        center,
        radiusMeters,
        bounds: {
          north: northEast.lat(),
          south: southWest.lat(),
          east: northEast.lng(),
          west: southWest.lng(),
        },
      });
    };
    const queueViewportEmit = () => {
      if (viewportTimer != null) window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(emitViewport, 90);
    };

    emitViewport();
    viewportListenersRef.current.forEach((listener) => listener.remove());
    viewportListenersRef.current = [
      map.addListener("idle", emitViewport),
      map.addListener("bounds_changed", queueViewportEmit),
    ];
    return () => {
      if (viewportTimer != null) window.clearTimeout(viewportTimer);
      viewportListenersRef.current.forEach((listener) => listener.remove());
      viewportListenersRef.current = [];
    };
  }, [mapReady, onViewportChange]);

  useEffect(() => {
    let canceled = false;
    if (!mapReady || locatedStops.length < 2 || !travelLabels) {
      const timer = window.setTimeout(() => {
        if (!canceled) setTravelSegments([]);
      }, 0);
      return () => {
        canceled = true;
        window.clearTimeout(timer);
      };
    }

    void resolveTravelSegments(locatedStops, travelLabels)
      .then((segments) => {
        if (!canceled) setTravelSegments(segments);
      })
      .catch(() => {
        if (!canceled) {
          setTravelSegments(createFallbackTravelSegments(locatedStops, travelLabels));
        }
      });

    return () => {
      canceled = true;
    };
  }, [locatedStops, mapReady, travelLabels]);

  useEffect(() => {
    const map = mapRef.current;
    const root = mapElementRef.current;
    if (!mapReady || !map || !root) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const accent = cssVar(root, "--accent", "#0fb8b4");
    const fg = cssVar(root, "--fg", "#202124");
    const surface = cssVar(root, "--surface", "#ffffff");

    if (!hasDayStops && located.length > 1) {
      overlaysRef.current.push(createArrivalPolyline({
        map,
        path: located.map(toLatLng),
        activeIndex: -1,
        strokeColor: accent,
        strokeOpacity: hasActive ? 0.26 : 0.58,
        strokeWeight: 2,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "14px",
        }],
        duration: 980,
      }));
    }

    if (!hasDayStops && activeLeg) {
      overlaysRef.current.push(createArrivalPolyline({
        map,
        path: [toLatLng(activeLeg.from), toLatLng(activeLeg.to)],
        activeIndex: 1,
        strokeColor: accent,
        strokeOpacity: 0.76,
        strokeWeight: 3,
        duration: 520,
        delay: 120,
        zIndex: 3,
      }));
    }

    if (!hasDayStops) {
      located.forEach((city, index) => {
        const citySourceIndex = city.sourceIndex ?? index;
        const isActive = focusedCitySourceIndex === citySourceIndex;
        const overlay = createTripLabelOverlay({
          position: toLatLng(city),
          title: city.name,
          label: city.label ?? String(index + 1),
          subtitle: city.date,
          color: ROUTE_COLORS[index % ROUTE_COLORS.length] ?? accent,
          surface,
          fg,
          sourceIndex: citySourceIndex,
          active: isActive,
          dimmed: !isActive && hasActive,
          onActivate: () => onCityActivate?.(citySourceIndex),
          onRemove: onCityRemove
            ? () => onCityRemove(citySourceIndex)
            : undefined,
          removeLabel: onCityRemove ? `${cityRemoveLabel} ${city.name}` : undefined,
          onHover: exploreSelectMode
            ? undefined
            : () => setHoveredCitySourceIndex(citySourceIndex),
          onLeave: exploreSelectMode
            ? undefined
            : () => setHoveredCitySourceIndex((current) =>
                current === citySourceIndex ? null : current,
              ),
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      });
    }

    locatedStops.forEach((stop, index) => {
      const label = stop.label ?? String(index + 1);
      const overlay = createStopLabelOverlay({
        position: toLatLng(stop),
        title: `${label}. ${stop.name}`,
        label,
        tooltip: stop.name,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length] ?? accent,
        active: activeStopIndex === stop.sourceIndex,
        onActivate: () => onStopActivate?.(stop.sourceIndex ?? index),
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    if (hasDayStops && locatedStops.length > 1) {
      const focusedTravelSegment =
        activeTravelFromIndex != null && activeTravelToIndex != null
          ? travelSegments.find(
              (segment) =>
                segment.fromIndex === activeTravelFromIndex &&
                segment.toIndex === activeTravelToIndex,
            ) ?? null
          : null;
      const activeTravelSegmentForMap =
        focusedTravelSegment ??
        travelSegments.find((segment) => activeStopIndex === segment.toIndex) ??
        null;
      const activeTravelToSourceIndex =
        activeTravelSegmentForMap?.toIndex ?? activeStopIndex;
      const activeArrivalIndex =
        activeTravelToSourceIndex == null
          ? -1
          : locatedStops.findIndex((stop) => stop.sourceIndex === activeTravelToSourceIndex);
      overlaysRef.current.push(createArrivalPolyline({
        map,
        path: routePathForStops(locatedStops, travelSegments),
        activeIndex: activeArrivalIndex,
        activePath: activeTravelSegmentForMap?.path,
        strokeColor: accent,
        strokeOpacity: 0.76,
        strokeWeight: 3,
        duration: 760,
        zIndex: 2,
      }));
    }

    travelSegments
      .filter((segment) =>
        activeTravelFromIndex != null && activeTravelToIndex != null
          ? segment.fromIndex === activeTravelFromIndex &&
            segment.toIndex === activeTravelToIndex
          : activeStopIndex === segment.toIndex,
      )
      .forEach((segment) => {
        const overlay = createTravelModeOverlay({
          position: segment.position,
          path: segment.path,
          label: `${segment.label ?? travelLabels?.[segment.mode] ?? segment.mode} · ${segment.durationText}`,
          active: true,
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      });

    if (searchMarker) {
      searchResults.forEach((result, index) => {
        const isSelected = isSameSearchMarker(result, searchMarker);
        if (isSelected) return;
        const resultSelected = result.selected === true;
        const marker = new google.maps.Marker({
          map,
          position: toLatLng(result),
          title: result.name,
          zIndex: resultSelected ? 74 : 64,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: resultSelected ? "#d6526f" : accent,
            fillOpacity: resultSelected ? 1 : 0.92,
            strokeColor: surface,
            strokeOpacity: 1,
            strokeWeight: resultSelected ? 4 : 3,
            scale: resultSelected ? 9 : 7,
          },
        });
        marker.addListener("click", () => onSearchResultActivate?.(index));
        overlaysRef.current.push(marker);
      });

      const marker = new google.maps.Marker({
        map,
        position: toLatLng(searchMarker),
        title: searchMarker.name,
        draggable: true,
        zIndex: 80,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#d6526f",
          fillOpacity: 1,
          strokeColor: surface,
          strokeOpacity: 1,
          strokeWeight: 4,
          scale: 11,
        },
      });
      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        if (!position) return;
        onSearchMarkerDrag?.({ lat: position.lat(), lng: position.lng() });
      });
      overlaysRef.current.push(marker);
      const overlay = createStopLabelOverlay({
        position: toLatLng(searchMarker),
        title: searchMarker.name,
        label: "",
        tooltip: searchMarker.name,
        color: "#d6526f",
        active: true,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    } else {
      searchResults.forEach((result, index) => {
        const resultSelected = result.selected === true;
        const marker = new google.maps.Marker({
          map,
          position: toLatLng(result),
          title: result.name,
          zIndex: resultSelected ? 74 : 64,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: resultSelected ? "#d6526f" : accent,
            fillOpacity: resultSelected ? 1 : 0.92,
            strokeColor: surface,
            strokeOpacity: 1,
            strokeWeight: resultSelected ? 4 : 3,
            scale: resultSelected ? 9 : 7,
          },
        });
        marker.addListener("click", () => onSearchResultActivate?.(index));
        overlaysRef.current.push(marker);
      });
    }

    const activeStopOrderIndex =
      activeStopIndex == null
        ? -1
        : locatedStops.findIndex((stop) => stop.sourceIndex === activeStopIndex);
    const previousActiveStop =
      activeStopOrderIndex > 0
        ? locatedStops[activeStopOrderIndex - 1] ?? null
        : null;
    const focusPoints = hasDayStops ? locatedStops : located;
    const searchCameraKey = searchMarker
      ? `search:${searchMarker.lat},${searchMarker.lng}`
      : "";
    const poiCameraKey =
      poiHighlightStableKey && poiHighlightLat != null && poiHighlightLng != null
        ? `poi:${poiHighlightStableKey}`
        : "";
    const stopCameraKey =
      panToActiveStop && activeStop
        ? `stop:${activeStopFocusKey ?? activeStopIndex ?? ""}:${activeStop.lat},${activeStop.lng}`
        : "";
    const searchCameraChanged = searchCameraKey !== lastSearchCameraKeyRef.current;
    const poiCameraChanged = poiCameraKey !== lastPoiCameraKeyRef.current;
    const stopCameraChanged = stopCameraKey !== lastStopCameraKeyRef.current;
    const fitKey = [
      searchCameraKey,
      poiCameraKey,
      searchResults.length > 0
        ? `search-results:${searchResults.map((result) => `${result.lat},${result.lng}`).join(";")}`
        : "",
      stopCameraKey,
      panToActiveStop && previousActiveStop
        ? `prev:${previousActiveStop.lat},${previousActiveStop.lng}`
        : "",
      hasDayStops ? "stops" : "cities",
      ...focusPoints.map((point) => `${point.name}:${point.lat},${point.lng}`),
    ].join("|");
    const shouldFit = !disableAutoFit && fitKey !== lastFitKeyRef.current;
    if (shouldFit) {
      lastFitKeyRef.current = fitKey;
      lastSearchCameraKeyRef.current = searchCameraKey;
      lastPoiCameraKeyRef.current = poiCameraKey;
      lastStopCameraKeyRef.current = stopCameraKey;
    }

    if (
      shouldFit &&
      poiHighlightLat != null &&
      poiHighlightLng != null
    ) {
      animateMapCamera(map, cameraFrameRef, {
        center: { lat: poiHighlightLat, lng: poiHighlightLng },
        zoom: Math.max(map.getZoom() ?? 5, 16),
        duration: poiCameraChanged ? 560 : 220,
      });
    } else if (shouldFit && focusActiveStopOnly && panToActiveStop && activeStop) {
      animateMapCamera(map, cameraFrameRef, {
        center: toLatLng(activeStop),
        zoom: Math.max(map.getZoom() ?? 5, 16),
        duration: stopCameraChanged ? 560 : 220,
      });
    } else if (
      shouldFit &&
      stopCameraChanged &&
      panToActiveStop &&
      activeStop &&
      previousActiveStop &&
      !focusActiveStopOnly
    ) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(toLatLng(previousActiveStop));
      bounds.extend(toLatLng(activeStop));
      animateMapCamera(map, cameraFrameRef, {
        ...cameraForBounds(map, bounds, {
          padding: { top: 112, right: 360, bottom: 126, left: 190 },
          maxZoom: 17,
        }),
        duration: 560,
      });
    } else if (shouldFit && stopCameraChanged && panToActiveStop && activeStop) {
      animateMapCamera(map, cameraFrameRef, {
        center: toLatLng(activeStop),
        zoom: Math.max(map.getZoom() ?? 5, 16),
        duration: 560,
      });
    } else if (shouldFit && searchMarker && searchCameraChanged) {
      animateMapCamera(map, cameraFrameRef, {
        center: toLatLng(searchMarker),
        zoom: Math.max(map.getZoom() ?? 5, 15),
        duration: 560,
      });
    } else if (
      shouldFit &&
      panToActiveStop &&
      activeStop &&
      searchResults.length > 0
    ) {
      // Suggested-place markers should not make the map fall back to fitting the full day.
    } else if (shouldFit && focusPoints.length === 1) {
      animateMapCamera(map, cameraFrameRef, {
        center: toLatLng(focusPoints[0]!),
        zoom: hasDayStops ? 15 : 9,
        duration: 520,
      });
    } else if (shouldFit && focusPoints.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      focusPoints.forEach((point) => bounds.extend(toLatLng(point)));
      animateMapCamera(map, cameraFrameRef, {
        ...cameraForBounds(map, bounds, {
          padding: hasDayStops
            ? { top: 104, right: 340, bottom: 128, left: 180 }
            : { top: 72, right: 220, bottom: 72, left: 170 },
          maxZoom: hasDayStops ? 15 : 10,
        }),
        duration: 620,
      });
    }

    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [
    activeKey,
    activeLeg,
    activeLocatedSourceIndex,
    activeStop,
    activeStopFocusKey,
    activeStopIndex,
    focusActiveStopOnly,
    activeTravelFocusKey,
    activeTravelFromIndex,
    activeTravelToIndex,
    disableAutoFit,
    exploreSelectMode,
    focusedCitySourceIndex,
    hasActive,
    hasDayStops,
    located,
    locatedStops,
    mapReady,
    onCityActivate,
    onCityRemove,
    cityRemoveLabel,
    onSearchResultActivate,
    onSearchMarkerDrag,
    onStopActivate,
    panToActiveStop,
    poiHighlightLat,
    poiHighlightLng,
    poiHighlightSelected,
    poiHighlightStableKey,
    poiFilterActive,
    searchMarker,
    searchResults,
    travelLabels,
    travelSegments,
  ]);

  useEffect(() => {
    poiHighlightRef.current = poiHighlight ?? null;
  }, [poiHighlight]);

  useEffect(() => {
    const map = mapRef.current;
    poiOverlayRef.current?.setMap(null);
    poiOverlayRef.current = null;

    if (!mapReady || !map || !poiHighlightStableKey) {
      lastPoiHighlightKeyRef.current = null;
      return;
    }

    const marker = poiHighlightRef.current;
    if (!marker) return;

    const animate = lastPoiHighlightKeyRef.current !== poiHighlightStableKey;
    lastPoiHighlightKeyRef.current = poiHighlightStableKey;
    const overlay = createGooglePoiStyleOverlay({
      position: toLatLng(marker),
      title: marker.name,
      iconMaskUri: marker.iconMaskUri,
      iconBackgroundColor: marker.iconBackgroundColor,
      selected: marker.selected === true,
      animate,
    });
    overlay.setMap(map);
    poiOverlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      if (poiOverlayRef.current === overlay) {
        poiOverlayRef.current = null;
      }
    };
  }, [mapReady, poiHighlightStableKey]);

  useEffect(() => {
    if (!poiHighlightStableKey) return;
    poiOverlayRef.current?.updateHighlight({
      title: poiHighlightTitle,
      iconMaskUri: poiHighlightIconMaskUri,
      iconBackgroundColor: poiHighlightIconBackgroundColor,
      selected: poiHighlightSelected,
    });
  }, [
    poiHighlightIconBackgroundColor,
    poiHighlightIconMaskUri,
    poiHighlightSelected,
    poiHighlightStableKey,
    poiHighlightTitle,
  ]);

  if (located.length === 0 && !exploreSelectMode) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-2xl text-[12px] text-fg-muted"
        style={{ background: "linear-gradient(135deg, var(--accent-soft) 0%, #ECF0FE 100%)" }}
      >
        無法定位行程城市
      </div>
    );
  }

  return (
    <div className="roam-trip-map isolate relative z-0 h-48 overflow-hidden rounded-2xl bg-accent-soft">
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />
      <div ref={mapElementRef} className="absolute inset-0 h-full w-full" />
      {exploreSelectMode && hoverCountryLabel ? (
        <div
          className="roam-country-hover-label"
          style={{
            left: hoverCountryLabel.x,
            top: hoverCountryLabel.y,
          }}
        >
          {hoverCountryLabel.title}
        </div>
      ) : null}
      {!hasDayStops && located.length > 1 ? (
        <nav
          aria-label="Trip route"
          className="absolute bottom-4 left-4 z-10 max-h-[min(320px,calc(100%-7rem))] w-[min(230px,calc(100%-2rem))] overflow-auto rounded-[18px] border border-white/80 bg-white/88 p-2 shadow-[0_18px_48px_-28px_rgba(32,41,46,0.45)] backdrop-blur-xl"
        >
          <div className="space-y-1">
            {located.map((city, index) => {
              const citySourceIndex = city.sourceIndex ?? index;
              const active = focusedCitySourceIndex === citySourceIndex;
              const color = ROUTE_COLORS[index % ROUTE_COLORS.length] ?? "#0fb8b4";
              return (
                <button
                  key={`route-rail:${citySourceIndex}:${city.name}:${city.date ?? ""}`}
                  type="button"
                  className={[
                    "flex w-full items-center gap-2 rounded-[13px] px-2.5 py-2 text-left transition",
                    active
                      ? "bg-accent-soft text-fg shadow-[inset_0_0_0_1px_rgba(15,184,180,0.22)]"
                      : "text-fg hover:bg-black/[0.04]",
                  ].join(" ")}
                  onClick={() => onCityActivate?.(citySourceIndex)}
                  onMouseEnter={() => setHoveredCitySourceIndex(citySourceIndex)}
                  onMouseLeave={() => setHoveredCitySourceIndex((current) =>
                    current === citySourceIndex ? null : current,
                  )}
                  onFocus={() => setHoveredCitySourceIndex(citySourceIndex)}
                  onBlur={() => setHoveredCitySourceIndex((current) =>
                    current === citySourceIndex ? null : current,
                  )}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-sm"
                    style={{ background: color }}
                    aria-hidden="true"
                  >
                    {city.label ?? String(index + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-black leading-4">
                      {city.name}
                    </span>
                    {city.date ? (
                      <span className="mt-0.5 block truncate text-[11px] font-semibold leading-3 text-fg-muted">
                        {city.date}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 grid place-items-center bg-white/72 px-6 text-center text-[12px] font-semibold text-fg-muted backdrop-blur">
          Google Maps 尚未完成設定
        </div>
      ) : null}
    </div>
  );
}

function createTripLabelOverlay({
  position,
  title,
  label,
  subtitle,
  color,
  surface,
  fg,
  sourceIndex,
  active,
  dimmed,
  onActivate,
  onRemove,
  removeLabel,
  onHover,
  onLeave,
}: {
  position: google.maps.LatLngLiteral;
  title: string;
  label: string;
  subtitle?: string;
  color: string;
  surface: string;
  fg: string;
  sourceIndex: number;
  active: boolean;
  dimmed: boolean;
  onActivate?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  onHover?: () => void;
  onLeave?: () => void;
}): google.maps.OverlayView {
  return new (class extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = [
        "roam-google-city-card",
        active ? "roam-google-city-card--active" : "",
        onRemove ? "roam-google-city-card--removable" : "",
      ].filter(Boolean).join(" ");
      this.div.setAttribute("role", "button");
      this.div.dataset.sourceIndex = String(sourceIndex);
      this.div.tabIndex = 0;
      this.div.style.setProperty("--route-color", color);
      this.div.style.setProperty("--card-surface", surface);
      this.div.style.setProperty("--card-fg", fg);
      this.div.style.opacity = dimmed ? "0.46" : "1";
      this.div.style.zIndex = active ? "260" : dimmed ? "90" : "140";
      this.div.innerHTML = `
        <span class="roam-google-city-card__pin" aria-hidden="true">
          <span class="roam-google-city-card__index">${escapeHtml(label)}</span>
        </span>
        ${onRemove ? `
          <button class="roam-google-city-card__remove" type="button" aria-label="${escapeHtml(removeLabel ?? "Remove")}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ` : ""}
        <span class="roam-google-city-card__copy">
          <span class="roam-google-city-card__name">${escapeHtml(title)}</span>
          ${subtitle ? `<span class="roam-google-city-card__date">${escapeHtml(subtitle)}</span>` : ""}
        </span>
      `;
      this.div.addEventListener("click", () => onActivate?.());
      this.div
        .querySelector<HTMLButtonElement>(".roam-google-city-card__remove")
        ?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove?.();
        });
      this.div.addEventListener("mouseenter", () => {
        this.div?.classList.add("roam-google-city-card--hovered");
        onHover?.();
      });
      this.div.addEventListener("mouseleave", () => {
        this.div?.classList.remove("roam-google-city-card--hovered");
        onLeave?.();
      });
      this.div.addEventListener("focus", () => {
        this.div?.classList.add("roam-google-city-card--hovered");
        onHover?.();
      });
      this.div.addEventListener("blur", () => {
        this.div?.classList.remove("roam-google-city-card--hovered");
        onLeave?.();
      });
      this.div.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onActivate?.();
      });
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const point = this.getProjection()?.fromLatLngToDivPixel(position);
      if (!point) return;
      this.div.style.transform = `translate(${point.x}px, ${point.y}px) translate(-17px, -42px)`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  })();
}

function createStopLabelOverlay({
  position,
  title,
  label,
  tooltip,
  color,
  active,
  onActivate,
}: {
  position: google.maps.LatLngLiteral;
  title: string;
  label: string;
  tooltip?: string;
  color: string;
  active: boolean;
  onActivate?: () => void;
}): google.maps.OverlayView {
  return new (class extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = active
        ? "roam-google-stop-label roam-google-stop-label--active"
        : "roam-google-stop-label";
      this.div.setAttribute("role", "button");
      this.div.title = tooltip ?? title;
      this.div.tabIndex = 0;
      this.div.style.setProperty("--stop-color", color);
      this.div.style.zIndex = active ? "80" : "20";
      this.div.style.opacity = active ? "1" : "0.88";
      this.div.innerHTML = `
        <span class="roam-google-stop-label__pin" aria-hidden="true">
          <span class="roam-google-stop-label__dot">${escapeHtml(label)}</span>
        </span>
        <span class="roam-google-stop-label__text">${escapeHtml(title)}</span>
      `;
      this.div.addEventListener("click", () => onActivate?.());
      this.div.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onActivate?.();
      });
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const point = this.getProjection()?.fromLatLngToDivPixel(position);
      if (!point) return;
      this.div.style.transform = `translate(${point.x}px, ${point.y}px) translate(-17px, -42px)`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  })();
}

function createGooglePoiStyleOverlay({
  position,
  title,
  iconMaskUri,
  iconBackgroundColor,
  selected,
  animate,
}: {
  position: google.maps.LatLngLiteral;
  title: string;
  iconMaskUri?: string | null;
  iconBackgroundColor?: string | null;
  selected?: boolean;
  animate: boolean;
}): GooglePoiStyleOverlay {
  return new (class extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private title = title;
    private iconMaskUri = iconMaskUri;
    private iconBackgroundColor = iconBackgroundColor;
    private selected = selected === true;

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = animate
        ? "roam-google-poi-style roam-google-poi-style--animate"
        : "roam-google-poi-style";
      this.applyHighlightStyles();
      this.div.style.zIndex = "96";
      this.div.innerHTML = `
        <span class="roam-google-poi-style__shell" aria-hidden="true">
          <span class="roam-google-poi-style__inner">
            <span class="roam-google-poi-style__icon"></span>
          </span>
        </span>
      `;
      this.getPanes()?.overlayLayer.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const point = this.getProjection()?.fromLatLngToDivPixel(position);
      if (!point) return;
      this.div.style.transform = `translate(${point.x}px, ${point.y}px) translate(-22px, -49px)`;
    }

    updateHighlight(options: {
      title: string;
      iconMaskUri?: string | null;
      iconBackgroundColor?: string | null;
      selected?: boolean;
    }) {
      this.title = options.title;
      this.iconMaskUri = options.iconMaskUri;
      this.iconBackgroundColor = options.iconBackgroundColor;
      this.selected = options.selected === true;
      this.applyHighlightStyles();
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }

    private applyHighlightStyles() {
      if (!this.div) return;
      this.div.title = this.title;
      this.div.style.setProperty(
        "--google-poi-color",
        this.selected ? "#d6526f" : this.iconBackgroundColor ?? "#34a853",
      );
      if (this.iconMaskUri) {
        this.div.style.setProperty("--google-poi-icon", `url("${this.iconMaskUri}")`);
      } else {
        this.div.style.removeProperty("--google-poi-icon");
      }
    }
  })();
}

function createBoundaryOverlay({
  paths,
  sourceIndex,
  title,
  zIndex,
  interactive = true,
  onHover,
  onLeave,
  onClick,
}: {
  paths: BoundaryPath[];
  sourceIndex: number;
  title: string;
  zIndex: number;
  interactive?: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}): BoundaryOverlay {
  return new (class extends google.maps.OverlayView implements BoundaryOverlay {
    sourceIndex = sourceIndex;
    private div: HTMLDivElement | null = null;
    private visualPathElements: SVGPathElement[] = [];
    private hitPathElements: SVGPathElement[] = [];
    private active = false;

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = interactive
        ? "roam-google-boundary"
        : "roam-google-boundary roam-google-boundary--passive";
      this.div.title = title;
      this.div.dataset.sourceIndex = String(sourceIndex);
      this.div.style.zIndex = String(zIndex);
      this.div.innerHTML = `
        <svg class="roam-google-boundary__svg" aria-hidden="true">
          ${paths.map(() => `
            <path class="roam-google-boundary__visual" />
            <path class="roam-google-boundary__hit" />
          `).join("")}
        </svg>
      `;
      this.visualPathElements = Array.from(
        this.div.querySelectorAll<SVGPathElement>(".roam-google-boundary__visual"),
      );
      this.hitPathElements = Array.from(
        this.div.querySelectorAll<SVGPathElement>(".roam-google-boundary__hit"),
      );
      if (interactive) {
        this.hitPathElements.forEach((path) => {
          path.addEventListener("mouseenter", onHover);
          path.addEventListener("mouseleave", onLeave);
          path.addEventListener("click", onClick);
        });
      }
      this.applyActive();
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;
      const projectedPaths = paths.map((path) =>
        path.flatMap((point) => {
          const pixel = projection.fromLatLngToDivPixel(point);
          return pixel ? [{ x: pixel.x, y: pixel.y }] : [];
        }),
      );
      const points = projectedPaths.flat();
      if (points.length === 0) return;
      const padding = interactive && this.active ? 24 : 10;
      const minX = Math.min(...points.map((point) => point.x)) - padding;
      const minY = Math.min(...points.map((point) => point.y)) - padding;
      const maxX = Math.max(...points.map((point) => point.x)) + padding;
      const maxY = Math.max(...points.map((point) => point.y)) + padding;
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);

      this.div.style.transform = `translate(${minX}px, ${minY}px)`;
      this.div.style.width = `${width}px`;
      this.div.style.height = `${height}px`;

      this.visualPathElements.forEach((pathElement, index) => {
        const path = projectedPaths[index] ?? [];
        const d = path
          .map((point, pointIndex) =>
            `${pointIndex === 0 ? "M" : "L"} ${point.x - minX} ${point.y - minY}`,
          )
          .join(" ");
        const nextPath = d ? `${d} Z` : "";
        pathElement.setAttribute("d", nextPath);
        this.hitPathElements[index]?.setAttribute("d", nextPath);
      });
    }

    setActive(active: boolean) {
      if (this.active === active) return;
      this.active = active;
      if (this.div) {
        this.div.style.zIndex = String(active ? zIndex + 100 : zIndex);
      }
      this.applyActive();
      this.draw();
    }

    onRemove() {
      if (interactive) {
        this.hitPathElements.forEach((path) => {
          path.removeEventListener("mouseenter", onHover);
          path.removeEventListener("mouseleave", onLeave);
          path.removeEventListener("click", onClick);
        });
      }
      this.visualPathElements = [];
      this.hitPathElements = [];
      this.div?.remove();
      this.div = null;
    }

    private applyActive() {
      if (this.div) {
        this.div.style.zIndex = String(this.active ? zIndex + 100 : zIndex);
      }
      this.visualPathElements.forEach((path) => {
        const exactLandMask = !interactive;
        path.setAttribute(
          "fill",
          this.active
            ? exactLandMask
              ? "rgba(255,255,255,0.24)"
              : "rgba(255,255,255,0.42)"
            : "rgba(255,255,255,0.18)",
        );
        path.setAttribute("stroke", "#FFFFFF");
        path.setAttribute("stroke-opacity", this.active ? (exactLandMask ? "0.62" : "0.9") : "0.34");
        path.setAttribute("stroke-width", this.active ? (exactLandMask ? "1.35" : "2.5") : "1.25");
        path.style.filter = this.active && !exactLandMask
          ? "drop-shadow(0 10px 16px rgba(32,41,46,0.18))"
          : "none";
        path.style.transform = this.active && !exactLandMask
          ? "translateY(-8px) scale(1.06)"
          : "translateY(0) scale(1)";
      });
      this.hitPathElements.forEach((path) => {
        path.setAttribute("fill", "rgba(15,184,180,0)");
        path.setAttribute("stroke", "rgba(15,184,180,0)");
        path.setAttribute("stroke-width", "14");
      });
    }
  })();
}

function createMouseProjectionOverlay(): google.maps.OverlayView {
  return new (class extends google.maps.OverlayView {
    onAdd() {}
    draw() {}
    onRemove() {}
  })();
}

function worldCountryBoundariesFromTopology(
  world: WorldTopology,
): CountryBoundaryLookupResult[] {
  const all = feature(world, world.objects.countries) as unknown as
    | FeatureCollection
    | Feature;
  const countries = "features" in all ? all.features : [all];
  return countries.flatMap((country) => {
    const title = typeof country.properties?.name === "string"
      ? country.properties.name
      : "";
    if (!title || title === "Antarctica") return [];
    const countryCode = countryCodeForAtlasName(title);
    const paths = boundaryPathsFromGeometry(country.geometry);
    return paths.length > 0
      ? [{
          title,
          countryCode,
          paths,
          bounds: boundsForBoundaryPaths(paths),
        }]
      : [];
  });
}

function localizedCountryName(country: CountryBoundaryLookupResult, locale: string): string {
  if (!country.countryCode) return country.title;
  try {
    const displayNames = new Intl.DisplayNames(
      [locale === "zh-TW" ? "zh-Hant-TW" : locale],
      { type: "region" },
    );
    return displayNames.of(country.countryCode) ?? country.title;
  } catch {
    return country.title;
  }
}

function countryCodeForAtlasName(name: string): string | null {
  const alias = COUNTRY_ATLAS_NAME_ALIASES[name];
  if (alias) return alias;
  const normalized = normalizeCountryName(name);
  if (!englishRegionNameToCodeCache) {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    const next = new Map<string, string>();
    for (let first = 65; first <= 90; first += 1) {
      for (let second = 65; second <= 90; second += 1) {
        const code = `${String.fromCharCode(first)}${String.fromCharCode(second)}`;
        const label = displayNames.of(code);
        if (!label || label === code) continue;
        next.set(normalizeCountryName(label), code);
      }
    }
    englishRegionNameToCodeCache = next;
  }
  return englishRegionNameToCodeCache.get(normalized) ?? null;
}

function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function boundaryPathsFromGeometry(geometry: Geometry | null | undefined): BoundaryPath[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return lngLatPolygonPaths(geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap(lngLatPolygonPaths);
  }
  return [];
}

function lngLatPolygonPaths(value: unknown): BoundaryPath[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((path) => {
    if (!Array.isArray(path)) return [];
    const points = path.flatMap((point) => {
      if (!Array.isArray(point)) return [];
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return [];
      }
      return [{ lat, lng }];
    });
    return points.length >= 4 ? [points] : [];
  });
}

function boundsForBoundaryPaths(paths: BoundaryPath[]): CountryBoundaryLookupResult["bounds"] {
  const points = paths.flat();
  return {
    north: Math.max(...points.map((point) => point.lat)),
    south: Math.min(...points.map((point) => point.lat)),
    east: Math.max(...points.map((point) => point.lng)),
    west: Math.min(...points.map((point) => point.lng)),
  };
}

function containerMousePointToLatLng(
  projectionOverlay: google.maps.OverlayView,
  container: HTMLElement,
  event: MouseEvent,
): google.maps.LatLngLiteral | null {
  const projection = projectionOverlay.getProjection();
  if (!projection) return null;
  const rect = container.getBoundingClientRect();
  const latLng = projection.fromContainerPixelToLatLng(
    new google.maps.Point(event.clientX - rect.left, event.clientY - rect.top),
  );
  if (!latLng) return null;
  return {
    lat: latLng.lat(),
    lng: latLng.lng(),
  };
}

function findCountryBoundary(
  point: google.maps.LatLngLiteral,
  boundaries: CountryBoundaryLookupResult[],
): CountryBoundaryLookupResult | null {
  for (const boundary of boundaries) {
    if (
      point.lat < boundary.bounds.south ||
      point.lat > boundary.bounds.north ||
      point.lng < boundary.bounds.west ||
      point.lng > boundary.bounds.east
    ) {
      continue;
    }
    const containingPaths = boundary.paths.filter((path) => pointInPolygon(point, path));
    if (containingPaths.length > 0) {
      return {
        title: boundary.title,
        countryCode: boundary.countryCode,
        paths: containingPaths,
        bounds: boundsForBoundaryPaths(containingPaths),
      };
    }
  }
  return null;
}

function pointInPolygon(point: google.maps.LatLngLiteral, polygon: BoundaryPath): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses =
      a.lng > point.lng !== b.lng > point.lng &&
      point.lat <
        ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng || Number.EPSILON) +
          a.lat;
    if (crosses) inside = !inside;
  }
  return inside;
}

function poiHighlightKey(marker: TripMapPoiHighlight): string {
  if (marker.id) return marker.id;
  return [
    marker.lat.toFixed(6),
    marker.lng.toFixed(6),
  ].join(":");
}

function animateMapCamera(
  map: google.maps.Map,
  frameRef: MutableRefObject<number | null>,
  target: {
    center: google.maps.LatLngLiteral;
    zoom: number;
    duration?: number;
  },
) {
  if (frameRef.current) {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentCenter = map.getCenter();
  const startCenter = currentCenter
    ? { lat: currentCenter.lat(), lng: currentCenter.lng() }
    : target.center;
  const startZoom = map.getZoom() ?? target.zoom;
  const duration = Math.max(160, target.duration ?? 520);

  if (prefersReducedMotion) {
    map.moveCamera({ center: target.center, zoom: target.zoom });
    return;
  }

  const start = window.performance.now();
  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(progress);
    map.moveCamera({
      center: {
        lat: lerp(startCenter.lat, target.center.lat, eased),
        lng: lerpLng(startCenter.lng, target.center.lng, eased),
      },
      zoom: lerp(startZoom, target.zoom, eased),
    });
    if (progress < 1) {
      frameRef.current = window.requestAnimationFrame(tick);
    } else {
      frameRef.current = null;
    }
  };

  frameRef.current = window.requestAnimationFrame(tick);
}

function cameraForBounds(
  map: google.maps.Map,
  bounds: google.maps.LatLngBounds,
  {
    padding,
    maxZoom,
  }: {
    padding: { top: number; right: number; bottom: number; left: number };
    maxZoom: number;
  },
) {
  const div = map.getDiv();
  const width = Math.max(1, div.clientWidth - padding.left - padding.right);
  const height = Math.max(1, div.clientHeight - padding.top - padding.bottom);
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  const ne = latLngToWorld({
    lat: northEast.lat(),
    lng: northEast.lng(),
  });
  const sw = latLngToWorld({
    lat: southWest.lat(),
    lng: southWest.lng(),
  });
  const spanX = Math.max(0.000001, Math.abs(ne.x - sw.x));
  const spanY = Math.max(0.000001, Math.abs(ne.y - sw.y));
  const zoom = Math.min(
    maxZoom,
    Math.max(1, Math.floor(Math.min(Math.log2(width / spanX), Math.log2(height / spanY)))),
  );
  return {
    center: {
      lat: (northEast.lat() + southWest.lat()) / 2,
      lng: midpointLng(southWest.lng(), northEast.lng()),
    },
    zoom,
  };
}

function latLngToWorld({ lat, lng }: google.maps.LatLngLiteral) {
  const siny = Math.sin((lat * Math.PI) / 180);
  const safeSiny = Math.min(Math.max(siny, -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * 256,
    y: (0.5 - Math.log((1 + safeSiny) / (1 - safeSiny)) / (4 * Math.PI)) * 256,
  };
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function lerpLng(from: number, to: number, progress: number) {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return normalizeLng(from + delta * progress);
}

function midpointLng(from: number, to: number) {
  return lerpLng(from, to, 0.5);
}

function normalizeLng(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function createTravelModeOverlay({
  position,
  path,
  label,
  active,
}: {
  position: google.maps.LatLngLiteral;
  path: google.maps.LatLngLiteral[];
  label: string;
  active: boolean;
}): google.maps.OverlayView {
  return new (class extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = active
        ? "roam-google-travel-pill roam-google-travel-pill--active"
        : "roam-google-travel-pill";
      this.div.style.zIndex = active ? "60" : "30";
      this.div.innerHTML = `<span>${escapeHtml(label)}</span>`;
      this.getPanes()?.overlayLayer.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      const point = projection?.fromLatLngToDivPixel(position);
      if (!point) return;
      const offset = projection ? travelPillOffset(projection, path) : { x: 0, y: 0 };
      this.div.style.transform = `translate(${point.x + offset.x}px, ${point.y + offset.y}px) translate(-50%, -50%)`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  })();
}

export async function resolveTravelSegments(
  stops: TripMapTravelStop[],
  labels: TripMapTravelLabels,
): Promise<TravelSegment[]> {
  const routes = await loadGoogleRoutes();
  const segments = await Promise.all(
    stops.slice(1).map((to, offset) =>
      resolveTravelSegment({
        from: stops[offset]!,
        to,
        labels,
        routes,
      }),
    ),
  );
  return segments;
}

async function resolveTravelSegment({
  from,
  to,
  labels,
  routes,
}: {
  from: TripMapTravelStop;
  to: TripMapTravelStop;
  labels: TripMapTravelLabels;
  routes: google.maps.RoutesLibrary;
}): Promise<TravelSegment> {
  const distanceKm = distanceBetween(toLatLng(from), toLatLng(to));
  const preferredMode = inferTravelMode(from, to, distanceKm);
  const candidates: Array<Exclude<TravelModeKind, "flight">> =
    preferredMode === "flight"
      ? []
      : preferredMode === "transit"
        ? ["transit", "drive"]
        : [preferredMode];

  for (const mode of candidates) {
    try {
      const result = await routes.Route.computeRoutes({
        origin: toLatLng(from),
        destination: toLatLng(to),
        travelMode: googleTravelMode(routes, mode),
        computeAlternativeRoutes: false,
        fields: ["durationMillis", "path"],
        ...(mode === "drive"
          ? { routingPreference: routes.RoutingPreference.TRAFFIC_UNAWARE }
          : {}),
      });
      const route = result.routes?.[0];
      if (!route || !route.durationMillis) continue;
      const durationText = formatTravelDuration(route.durationMillis / 60000, labels);
      const durationMin = Math.max(1, Math.round(route.durationMillis / 60000));
      const path = routePathFromGoogleRoute(route) ?? [toLatLng(from), toLatLng(to)];
      return {
        fromIndex: from.sourceIndex ?? 0,
        toIndex: to.sourceIndex ?? 0,
        position: midpointForPath(path),
        path,
        mode,
        distanceKm,
        durationMin,
        durationText,
        label: from.travelLabelToNext,
      };
    } catch {
      // Fall back to the next available mode, then to a deterministic estimate.
    }
  }

  return createFallbackTravelSegment(from, to, labels, preferredMode, distanceKm);
}

export function createFallbackTravelSegments(
  stops: TripMapTravelStop[],
  labels: TripMapTravelLabels,
): TravelSegment[] {
  return stops.slice(1).map((to, offset) => {
    const from = stops[offset]!;
    const distanceKm = distanceBetween(toLatLng(from), toLatLng(to));
    return createFallbackTravelSegment(
      from,
      to,
      labels,
      inferTravelMode(from, to, distanceKm),
      distanceKm,
    );
  });
}

function createFallbackTravelSegment(
  from: TripMapTravelStop,
  to: TripMapTravelStop,
  labels: TripMapTravelLabels,
  mode: TravelModeKind,
  distanceKm: number,
): TravelSegment {
  return {
    fromIndex: from.sourceIndex ?? 0,
    toIndex: to.sourceIndex ?? 0,
    position: midpointBetween(toLatLng(from), toLatLng(to)),
    path: [toLatLng(from), toLatLng(to)],
    mode,
    distanceKm,
    durationMin: estimateTravelMinutes(mode, distanceKm),
    durationText: formatTravelDuration(estimateTravelMinutes(mode, distanceKm), labels),
    label: from.travelLabelToNext,
  };
}

function inferTravelMode(
  from: TripMapTravelStop,
  to: TripMapTravelStop,
  distanceKm: number,
): TravelModeKind {
  if (from.travelModeToNext) return from.travelModeToNext;
  const kind = `${from.kind ?? ""} ${to.kind ?? ""}`.toLowerCase();
  if (kind.includes("flight") || distanceKm >= 120) return "flight";
  if (kind.includes("airport_transfer")) return "drive";
  if (kind.includes("transit") || kind.includes("transport")) return "transit";
  if (distanceKm <= 2.2) return "walk";
  return "drive";
}

function googleTravelMode(
  routes: google.maps.RoutesLibrary,
  mode: Exclude<TravelModeKind, "flight">,
): google.maps.TravelModeString {
  if (mode === "walk") return routes.TravelMode.WALKING;
  if (mode === "transit") return routes.TravelMode.TRANSIT;
  return routes.TravelMode.DRIVING;
}

function estimateTravelMinutes(mode: TravelModeKind, distanceKm: number) {
  if (mode === "walk") return Math.max(3, Math.round((distanceKm / 4.6) * 60));
  if (mode === "transit") return Math.max(12, Math.round((distanceKm / 24) * 60 + 8));
  if (mode === "flight") return Math.max(55, Math.round((distanceKm / 720) * 60 + 45));
  return Math.max(6, Math.round((distanceKm / 32) * 60 + 5));
}

function formatTravelDuration(minutes: number, labels: TripMapTravelLabels) {
  const safeMinutes = Math.max(1, Math.round(minutes));
  if (safeMinutes < 60) {
    return formatTemplate(labels.min, { n: String(safeMinutes) });
  }
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (rest === 0) return formatTemplate(labels.hour, { h: String(hours) });
  return formatTemplate(labels.hour_min, {
    h: String(hours),
    m: String(rest),
  });
}

function midpointBetween(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
): google.maps.LatLngLiteral {
  return {
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  };
}

function routePathForStops(
  stops: TripMapTravelStop[],
  segments: TravelSegment[],
): google.maps.LatLngLiteral[] {
  if (stops.length < 2) return stops.map(toLatLng);
  if (segments.length === 0) return stops.map(toLatLng);
  const path: google.maps.LatLngLiteral[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1]!;
    const to = stops[index]!;
    const segment = segments.find(
      (item) =>
        item.fromIndex === from.sourceIndex &&
        item.toIndex === to.sourceIndex,
    );
    const segmentPath = segment?.path.length ? segment.path : [toLatLng(from), toLatLng(to)];
    if (path.length === 0) {
      path.push(...segmentPath);
    } else {
      path.push(...segmentPath.slice(1));
    }
  }
  return path;
}

function routePathFromGoogleRoute(route: unknown): google.maps.LatLngLiteral[] | null {
  const polylinePath = routePathFromGooglePolylines(route);
  if (polylinePath) return polylinePath;
  const jsonPath = routePathFromGoogleJson(route);
  if (jsonPath) return jsonPath;
  const path = valueFromObject(route, "path");
  const points = arrayFromPath(path);
  if (!points || points.length < 2) return null;
  const latLngs = points
    .map(latLngLiteralFromUnknown)
    .filter((point): point is google.maps.LatLngLiteral => point != null);
  return latLngs.length > 1 ? latLngs : null;
}

function routePathFromGoogleJson(route: unknown): google.maps.LatLngLiteral[] | null {
  if (!isObject(route) || typeof route["toJSON"] !== "function") return null;
  try {
    const json = route["toJSON"].call(route);
    const path = valueFromObject(json, "path");
    const points = arrayFromPath(path);
    if (!points || points.length < 2) return null;
    const latLngs = points
      .map(latLngLiteralFromUnknown)
      .filter((point): point is google.maps.LatLngLiteral => point != null);
    return latLngs.length > 1 ? latLngs : null;
  } catch {
    return null;
  }
}

function routePathFromGooglePolylines(route: unknown): google.maps.LatLngLiteral[] | null {
  if (!isObject(route)) return null;
  const createPolylines = route["createPolylines"];
  if (typeof createPolylines !== "function") return null;
  try {
    const polylines = createPolylines.call(route, {});
    if (!Array.isArray(polylines)) return null;
    const path: google.maps.LatLngLiteral[] = [];
    for (const polyline of polylines) {
      const points = polylinePathPoints(polyline);
      if (!points || points.length === 0) continue;
      if (path.length === 0) {
        path.push(...points);
      } else {
        path.push(...points.slice(1));
      }
      if (isObject(polyline) && typeof polyline["setMap"] === "function") {
        polyline["setMap"].call(polyline, null);
      }
    }
    return path.length > 1 ? path : null;
  } catch {
    return null;
  }
}

function polylinePathPoints(polyline: unknown): google.maps.LatLngLiteral[] | null {
  if (!isObject(polyline) || typeof polyline["getPath"] !== "function") return null;
  const path = polyline["getPath"].call(polyline);
  const points = arrayFromPath(path);
  if (!points || points.length < 2) return null;
  const latLngs = points
    .map(latLngLiteralFromUnknown)
    .filter((point): point is google.maps.LatLngLiteral => point != null);
  return latLngs.length > 1 ? latLngs : null;
}

function arrayFromPath(path: unknown): unknown[] | null {
  if (Array.isArray(path)) return path;
  if (isObject(path)) {
    const getArray = path["getArray"];
    if (typeof getArray === "function") {
      const value = getArray.call(path);
      return Array.isArray(value) ? value : null;
    }
  }
  return null;
}

function latLngLiteralFromUnknown(value: unknown): google.maps.LatLngLiteral | null {
  if (!isObject(value)) return null;
  const lat = value["lat"];
  const lng = value["lng"];
  if (typeof lat === "function" && typeof lng === "function") {
    const nextLat = lat.call(value);
    const nextLng = lng.call(value);
    return typeof nextLat === "number" && typeof nextLng === "number"
      ? { lat: nextLat, lng: nextLng }
      : null;
  }
  return typeof lat === "number" && typeof lng === "number"
    ? { lat, lng }
    : null;
}

function midpointForPath(path: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
  if (path.length <= 1) return path[0] ?? { lat: 0, lng: 0 };
  const distances = cumulativeDistances(path);
  const totalDistance = distances[distances.length - 1] ?? 0;
  return pointAtDistance(path, distances, totalDistance / 2);
}

function travelPillOffset(
  projection: google.maps.MapCanvasProjection,
  path: google.maps.LatLngLiteral[],
) {
  if (path.length < 2) return { x: 0, y: 34 };
  const from = projection.fromLatLngToDivPixel(path[0]!);
  const to = projection.fromLatLngToDivPixel(path[path.length - 1]!);
  if (!from || !to) return { x: 0, y: 34 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: 0, y: 34 };
  if (Math.abs(dx) < Math.abs(dy) * 0.35) return { x: 0, y: 36 };
  let x = -dy / length;
  let y = dx / length;
  if (y < 0) {
    x *= -1;
    y *= -1;
  }
  return { x: x * 34, y: y * 34 };
}

function valueFromObject(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createArrivalPolyline({
  map,
  path,
  activePath,
  activeIndex = -1,
  duration = 800,
  delay = 0,
  ...options
}: google.maps.PolylineOptions & {
  map: google.maps.Map;
  path: google.maps.LatLngLiteral[];
  activePath?: google.maps.LatLngLiteral[];
  activeIndex?: number;
  duration?: number;
  delay?: number;
}): MapOverlay {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const requestedOpacity = Number(options.strokeOpacity ?? 0.75);
  const baseLine = new google.maps.Polyline({
    ...options,
    map,
    path,
    strokeOpacity: prefersReducedMotion
      ? requestedOpacity
      : Math.max(0.08, requestedOpacity * 0.24),
  });
  const arrivalPath = activePath && activePath.length > 1
    ? activePath
    : activeIndex > 0 && activeIndex < path.length
      ? [path[activeIndex - 1]!, path[activeIndex]!]
      : [];
  const movingLine = arrivalPath.length > 1
    ? new google.maps.Polyline({
        ...options,
        map,
        path: prefersReducedMotion ? arrivalPath : arrivalPath.slice(0, 1),
        strokeOpacity: Math.min(1, requestedOpacity + 0.28),
        strokeWeight: Number(options.strokeWeight ?? 2) + 1.25,
        icons: undefined,
        zIndex: Number(options.zIndex ?? 0) + 10,
      })
    : null;
  let frame = 0;

  if (movingLine && !prefersReducedMotion && arrivalPath.length > 1) {
    const distances = cumulativeDistances(arrivalPath);
    const totalDistance = distances[distances.length - 1] ?? 0;
    const start = window.performance.now() + delay;

    const tick = (now: number) => {
      if (now < start) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, (now - start) / Math.max(160, duration));
      const head = totalDistance * easeInOutSine(progress);
      movingLine.setPath(pathBetweenDistances(arrivalPath, distances, 0, head));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
  }

  return {
    setMap(nextMap) {
      if (frame) window.cancelAnimationFrame(frame);
      baseLine.setMap(nextMap);
      movingLine?.setMap(nextMap);
    },
  };
}

function cumulativeDistances(path: google.maps.LatLngLiteral[]) {
  const distances = [0];
  for (let i = 1; i < path.length; i += 1) {
    distances.push(
      (distances[i - 1] ?? 0) + distanceBetween(path[i - 1]!, path[i]!),
    );
  }
  return distances;
}

function pathBetweenDistances(
  path: google.maps.LatLngLiteral[],
  distances: number[],
  start: number,
  end: number,
) {
  if (path.length <= 1) return path;
  const safeStart = Math.max(0, Math.min(start, distances[distances.length - 1] ?? 0));
  const safeEnd = Math.max(safeStart, Math.min(end, distances[distances.length - 1] ?? 0));
  const nextPath = [
    pointAtDistance(path, distances, safeStart),
  ];
  for (let i = 1; i < path.length; i += 1) {
    const distance = distances[i] ?? 0;
    if (distance > safeStart && distance < safeEnd) {
      nextPath.push(path[i]!);
    }
  }
  nextPath.push(pointAtDistance(path, distances, safeEnd));
  return nextPath;
}

function pointAtDistance(
  path: google.maps.LatLngLiteral[],
  distances: number[],
  target: number,
) {
  if (target <= 0) return path[0]!;
  for (let i = 1; i < path.length; i += 1) {
    const previousDistance = distances[i - 1] ?? 0;
    const nextDistance = distances[i] ?? previousDistance;
    if (target > nextDistance) continue;
    const segmentDistance = nextDistance - previousDistance;
    const ratio =
      segmentDistance <= 0
        ? 1
        : Math.max(0, Math.min(1, (target - previousDistance) / segmentDistance));
    const from = path[i - 1]!;
    const to = path[i]!;
    return {
      lat: from.lat + (to.lat - from.lat) * ratio,
      lng: from.lng + (to.lng - from.lng) * ratio,
    };
  }
  return path[path.length - 1]!;
}

function distanceBetween(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

const MAP_CSS = `
.roam-trip-map .gm-style {
  font: inherit;
}
.roam-google-boundary {
  position: absolute;
  pointer-events: auto;
}
.roam-google-boundary__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.roam-google-boundary__visual {
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
  transition:
    fill 220ms cubic-bezier(.2,.8,.2,1),
    stroke-opacity 220ms ease,
    stroke-width 220ms cubic-bezier(.2,.8,.2,1),
    filter 220ms ease,
    transform 260ms cubic-bezier(.2,.8,.2,1);
}
.roam-google-boundary__hit {
  cursor: crosshair;
  pointer-events: all;
}
.roam-google-boundary--passive,
.roam-google-boundary--passive .roam-google-boundary__hit {
  pointer-events: none;
}
.roam-country-hover-label {
  position: absolute;
  z-index: 28;
  max-width: min(220px, calc(100% - 32px));
  transform: translate(14px, calc(-100% - 12px));
  border: 1px solid rgba(255,255,255,0.76);
  border-radius: 999px;
  background: rgba(32,41,46,0.82);
  color: #fff;
  box-shadow: 0 14px 36px rgba(32,41,46,0.22);
  backdrop-filter: blur(14px);
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  overflow: hidden;
  pointer-events: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.roam-google-city-card {
  position: absolute;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 34px;
  min-width: 34px;
  max-width: 210px;
  color: var(--card-fg, #202124);
  pointer-events: auto;
  cursor: pointer;
  will-change: transform;
  transition: opacity 180ms ease, filter 180ms ease;
}
.roam-google-city-card:hover,
.roam-google-city-card--hovered,
.roam-google-city-card:focus-visible,
.roam-google-city-card--active {
  z-index: 260 !important;
}
.roam-google-city-card__pin {
  position: relative;
  width: 34px;
  height: 42px;
  flex: 0 0 34px;
  filter: drop-shadow(0 8px 16px rgba(32,41,46,0.22));
  transform-origin: center bottom;
  transition: transform 220ms cubic-bezier(.2,.8,.2,1), filter 220ms ease;
}
.roam-google-city-card__index {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 999px;
  background: var(--route-color, var(--accent));
  border: 3px solid #fff;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}
.roam-google-city-card__pin::after {
  content: "";
  position: absolute;
  left: 13px;
  top: 25px;
  width: 8px;
  height: 17px;
  background: var(--route-color, var(--accent));
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}
.roam-google-city-card__remove {
  position: absolute;
  left: 23px;
  top: -8px;
  z-index: 3;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(32,41,46,0.88);
  color: #fff;
  box-shadow: 0 8px 18px rgba(32,41,46,0.24);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.82);
  transition: opacity 160ms ease, transform 180ms cubic-bezier(.2,.8,.2,1);
}
.roam-google-city-card__remove svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.8;
  stroke-linecap: round;
}
.roam-google-city-card:hover .roam-google-city-card__remove,
.roam-google-city-card--hovered .roam-google-city-card__remove,
.roam-google-city-card:focus-visible .roam-google-city-card__remove,
.roam-google-city-card--active .roam-google-city-card__remove,
.roam-google-city-card__remove:focus-visible {
  opacity: 1;
  transform: scale(1);
}
.roam-google-city-card--removable .roam-google-city-card__remove {
  opacity: 0.88;
  transform: scale(1);
}
.roam-google-city-card--removable:hover .roam-google-city-card__remove,
.roam-google-city-card--removable.roam-google-city-card--hovered .roam-google-city-card__remove,
.roam-google-city-card--removable:focus-visible .roam-google-city-card__remove {
  opacity: 1;
}
.roam-google-city-card__copy {
  position: absolute;
  left: 42px;
  top: 2px;
  display: block;
  min-width: 0;
  width: 116px;
  padding: 9px 12px;
  border-radius: 15px;
  background: color-mix(in srgb, var(--card-surface, #fff) 94%, transparent);
  box-shadow: 0 16px 38px rgba(32,41,46,0.16);
  backdrop-filter: blur(12px);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px) scale(0.96);
  transform-origin: left center;
  transition: opacity 160ms ease, transform 180ms cubic-bezier(.2,.8,.2,1);
}
.roam-google-city-card:hover .roam-google-city-card__copy,
.roam-google-city-card--hovered .roam-google-city-card__copy,
.roam-google-city-card:focus-visible .roam-google-city-card__copy,
.roam-google-city-card--active .roam-google-city-card__copy {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}
.roam-google-city-card--active .roam-google-city-card__index {
  box-shadow: 0 0 0 5px rgba(15,184,180,0.18);
}
.roam-google-city-card:hover .roam-google-city-card__pin,
.roam-google-city-card--hovered .roam-google-city-card__pin,
.roam-google-city-card:focus-visible .roam-google-city-card__pin,
.roam-google-city-card--active .roam-google-city-card__pin {
  transform: scale(1.12);
}
.roam-google-city-card:hover .roam-google-city-card__copy,
.roam-google-city-card--hovered .roam-google-city-card__copy,
.roam-google-city-card:focus-visible .roam-google-city-card__copy,
.roam-google-city-card--active .roam-google-city-card__copy {
  box-shadow: 0 18px 46px rgba(15,184,180,0.22), 0 0 0 3px rgba(15,184,180,0.16);
}
.roam-google-city-card__name {
  display: block;
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 800;
}
.roam-google-city-card__date {
  display: block;
  margin-top: 2px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: color-mix(in srgb, var(--card-fg, #202124) 55%, transparent);
}
.roam-google-stop-label {
  position: absolute;
  display: block;
  width: 34px;
  height: 42px;
  color: #202124;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  will-change: transform;
  transition: opacity 180ms ease, filter 180ms ease;
}
.roam-google-stop-label__pin {
  position: relative;
  z-index: 2;
  display: block;
  width: 34px;
  height: 42px;
  filter: drop-shadow(0 8px 16px rgba(32,41,46,0.22));
  transform-origin: center bottom;
  transition: transform 220ms cubic-bezier(.2,.8,.2,1), filter 220ms ease;
}
.roam-google-stop-label__dot {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 999px;
  border: 3px solid #fff;
  background: var(--stop-color, var(--accent));
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}
.roam-google-stop-label__pin::after {
  content: "";
  position: absolute;
  left: 13px;
  top: 25px;
  width: 8px;
  height: 17px;
  background: var(--stop-color, var(--accent));
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}
.roam-google-stop-label__text {
  position: absolute;
  left: 28px;
  top: -8px;
  z-index: 5;
  display: block;
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 999px;
  padding: 6px 0;
  background: rgba(255,255,255,0.96);
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  backdrop-filter: blur(10px);
  opacity: 0;
  transform: translate(-4px, 12px) scale(0.96);
  transform-origin: left center;
  transition: opacity 180ms ease, transform 180ms ease, max-width 180ms ease, padding 180ms ease;
}
.roam-google-stop-label--active .roam-google-stop-label__pin {
  filter: drop-shadow(0 12px 22px rgba(32,41,46,0.26));
  transform: scale(1.16);
}
.roam-google-stop-label--active .roam-google-stop-label__dot {
  box-shadow: 0 0 0 5px rgba(15,184,180,0.18);
}
.roam-google-stop-label--active .roam-google-stop-label__text {
  max-width: 190px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.99);
  box-shadow: 0 14px 32px rgba(15,184,180,0.24), 0 0 0 3px rgba(15,184,180,0.16);
  opacity: 1;
  transform: translate(0, 0) scale(1);
}
.roam-google-poi-style {
  position: absolute;
  pointer-events: none;
  width: 44px;
  height: 49px;
}
.roam-google-poi-style__shell {
  position: relative;
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(60,64,67,0.28), 0 0 0 1px rgba(60,64,67,0.1);
  filter: drop-shadow(0 1px 1px rgba(60,64,67,0.18));
  transform-origin: center bottom;
}
.roam-google-poi-style--animate .roam-google-poi-style__shell {
  animation: roam-google-poi-style-pop 220ms cubic-bezier(.2,.8,.2,1) both;
}
.roam-google-poi-style__shell::after {
  content: "";
  position: absolute;
  left: 16px;
  top: 34px;
  width: 12px;
  height: 12px;
  background: #fff;
  box-shadow: 1px 1px 2px rgba(60,64,67,0.16);
  transform: rotate(45deg);
}
.roam-google-poi-style__inner {
  position: absolute;
  left: 7px;
  top: 7px;
  z-index: 2;
  display: block;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--google-poi-color, #34a853);
}
.roam-google-poi-style__icon {
  position: absolute;
  left: 7px;
  top: 7px;
  display: block;
  width: 16px;
  height: 16px;
  background: #fff;
  mask-image: var(--google-poi-icon);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-image: var(--google-poi-icon);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}
.roam-google-poi-style__icon::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #fff;
  opacity: 0;
}
.roam-google-poi-style:not([style*="--google-poi-icon"]) .roam-google-poi-style__icon {
  mask-image: none;
  -webkit-mask-image: none;
  border-radius: 999px;
}
.roam-google-poi-style:not([style*="--google-poi-icon"]) .roam-google-poi-style__icon::after {
  opacity: 1;
}
@keyframes roam-google-poi-style-pop {
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.roam-google-travel-pill {
  position: absolute;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  max-width: 150px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.78);
  background: rgba(255,255,255,0.86);
  box-shadow: 0 10px 26px rgba(32,41,46,0.16);
  color: #202124;
  font-size: 11px;
  font-weight: 750;
  line-height: 1;
  padding: 7px 10px;
  backdrop-filter: blur(12px);
  opacity: 0.84;
  white-space: nowrap;
}
.roam-google-travel-pill span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
.roam-google-travel-pill--active {
  border-color: rgba(15,184,180,0.28);
  box-shadow: 0 16px 34px rgba(15,184,180,0.22), 0 0 0 3px rgba(15,184,180,0.11);
  color: #164346;
  opacity: 1;
}
`;

const ROAM_MAP_STYLE: google.maps.MapTypeStyle[] = [
  {
    featureType: "all",
    elementType: "labels.text.fill",
    stylers: [{ color: "#66757a" }],
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }, { weight: 2 }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f4efe5" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 20 }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#cfe8ed" }],
  },
] satisfies google.maps.MapTypeStyle[];

const ROAM_MAP_STYLE_POI_FILTERED: google.maps.MapTypeStyle[] = [
  ...ROAM_MAP_STYLE,
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.business",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.attraction",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.place_of_worship",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
] satisfies google.maps.MapTypeStyle[];
