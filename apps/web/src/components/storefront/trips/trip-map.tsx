"use client";

// Real Leaflet map for the trip overview. Renders an OSM tile layer, one
// custom pin per unique city in itinerary order, and a dashed polyline
// connecting them so the visual reads as "route".
//
// Client-only because leaflet itself touches `window` at module load.
// daily-timeline.tsx imports this via next/dynamic with ssr: false.

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

export interface TripMapCity {
  name: string;
  lat: number | null;
  lng: number | null;
}

interface LocatedCity {
  name: string;
  lat: number;
  lng: number;
}

const PIN_ICON = L.divIcon({
  className: "roam-trip-pin",
  html: `<span class="roam-trip-pin__dot"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const PIN_ICON_ACTIVE = L.divIcon({
  className: "roam-trip-pin",
  html: `<span class="roam-trip-pin__dot roam-trip-pin__dot--active"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const PIN_ICON_DIM = L.divIcon({
  className: "roam-trip-pin",
  html: `<span class="roam-trip-pin__dot roam-trip-pin__dot--dim"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/* Day-stop pin: smaller filled accent dot. Visually distinct from macro
   city pins so the user can tell "today's place" from "trip-level city". */
const PIN_ICON_STOP = L.divIcon({
  className: "roam-trip-pin",
  html: `<span class="roam-trip-pin__dot roam-trip-pin__dot--stop"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const PIN_CSS = `
.roam-trip-pin { display: block; }
.roam-trip-pin__dot {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #fff;
  border: 2px solid #0FB8B4;
  box-shadow: 0 0 0 4px rgba(15,184,180,0.18), 0 1px 4px rgba(0,0,0,0.18);
}
.roam-trip-pin__dot--active {
  width: 18px;
  height: 18px;
  background: #0FB8B4;
  border-color: #fff;
  box-shadow:
    0 0 0 5px rgba(15,184,180,0.28),
    0 0 0 10px rgba(15,184,180,0.14),
    0 2px 8px rgba(0,0,0,0.22);
}
.roam-trip-pin__dot--dim {
  opacity: 0.45;
  box-shadow: 0 0 0 3px rgba(15,184,180,0.10), 0 1px 3px rgba(0,0,0,0.12);
}
.roam-trip-pin__dot--stop {
  width: 12px;
  height: 12px;
  background: #0FB8B4;
  border-color: #fff;
  border-width: 2px;
  box-shadow: 0 0 0 3px rgba(15,184,180,0.25), 0 1px 4px rgba(0,0,0,0.20);
}
.leaflet-container { background: #DCF4F3; font: inherit; }
.leaflet-popup-content { margin: 8px 12px; font-size: 12px; }
`;

/* Case- and whitespace-insensitive comparison so user-entered cities match
   what the backend wrote into the dedup'd cities list. */
function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function TripMap({
  cities,
  activeCity,
  activeLegFrom,
  dayStops,
}: {
  cities: TripMapCity[];
  /* When set, that pin renders larger with a brighter halo. The rest fade. */
  activeCity?: string | null;
  /* When set together with activeCity AND the two cities differ, the segment
     between them is drawn as a solid teal line on top of the dashed route —
     visualizes "today's move" on the Day N tab. */
  activeLegFrom?: string | null;
  /* Day-level stops to overlay on top of the macro city pins. When
     provided, the map zooms tighter, city pins dim, and the day's stops
     render as accent pins with a solid polyline between them. */
  dayStops?: TripMapCity[];
}) {
  const located = useMemo<LocatedCity[]>(
    () =>
      cities.flatMap((c) =>
        c.lat != null && c.lng != null
          ? [{ name: c.name, lat: c.lat, lng: c.lng }]
          : [],
      ),
    [cities],
  );

  const center = useMemo<[number, number]>(() => {
    if (located.length === 0) return [35.6764, 139.65]; // Tokyo as a sane default
    const lat = located.reduce((s, c) => s + c.lat, 0) / located.length;
    const lng = located.reduce((s, c) => s + c.lng, 0) / located.length;
    return [lat, lng];
  }, [located]);

  const activeKey = activeCity ? normalizeName(activeCity) : null;
  const activeLeg = useMemo<{ from: LocatedCity; to: LocatedCity } | null>(() => {
    if (!activeKey || !activeLegFrom) return null;
    const fromKey = normalizeName(activeLegFrom);
    if (fromKey === activeKey) return null; // same city → no leg to draw
    const from = located.find((c) => normalizeName(c.name) === fromKey);
    const to = located.find((c) => normalizeName(c.name) === activeKey);
    if (!from || !to) return null;
    return { from, to };
  }, [activeKey, activeLegFrom, located]);
  const hasActive =
    activeKey != null && located.some((c) => normalizeName(c.name) === activeKey);

  /* Day-level stops with resolved coords. When present, this takes over as
     the FitToCities target so the map zooms tight onto the day's pins. */
  const locatedStops = useMemo<LocatedCity[]>(
    () =>
      (dayStops ?? []).flatMap((s) =>
        s.lat != null && s.lng != null
          ? [{ name: s.name, lat: s.lat, lng: s.lng }]
          : [],
      ),
    [dayStops],
  );
  const hasDayStops = locatedStops.length > 0;

  if (located.length === 0) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-2xl text-[12px] text-fg-muted"
        style={{ background: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)" }}
      >
        無法定位行程城市
      </div>
    );
  }

  return (
    <div className="relative h-48 overflow-hidden rounded-2xl">
      <style dangerouslySetInnerHTML={{ __html: PIN_CSS }} />
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom={false}
        zoomControl={false}
        className="absolute inset-0 h-full w-full"
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* FitToCities targets dayStops when present so the day-level view
            zooms tighter onto today's pins; otherwise fit the whole trip. */}
        <FitToCities cities={hasDayStops ? locatedStops : located} />
        <Polyline
          positions={located.map((c) => [c.lat, c.lng])}
          pathOptions={{
            color: "#0FB8B4",
            weight: 2.5,
            opacity: hasActive || hasDayStops ? 0.4 : 0.9,
            dashArray: "4 6",
            lineCap: "round",
          }}
        />
        {activeLeg && (
          <Polyline
            positions={[
              [activeLeg.from.lat, activeLeg.from.lng],
              [activeLeg.to.lat, activeLeg.to.lng],
            ]}
            pathOptions={{
              color: "#0FB8B4",
              weight: 3.5,
              opacity: 1,
              lineCap: "round",
            }}
          />
        )}
        {/* Intra-day polyline — solid, sits on top of the dashed macro
            route to read as "this day's path". */}
        {hasDayStops && locatedStops.length > 1 && (
          <Polyline
            positions={locatedStops.map((s) => [s.lat, s.lng])}
            pathOptions={{
              color: "#0FB8B4",
              weight: 3,
              opacity: 1,
              lineCap: "round",
            }}
          />
        )}
        {located.map((city) => {
          const key = normalizeName(city.name);
          const isActive = activeKey != null && key === activeKey;
          /* When day stops are showing, city pins always dim — the stop
             pins are the focus. */
          const icon = isActive
            ? PIN_ICON_ACTIVE
            : hasActive || hasDayStops
              ? PIN_ICON_DIM
              : PIN_ICON;
          return (
            <Marker key={city.name} position={[city.lat, city.lng]} icon={icon}>
              <Popup>{city.name}</Popup>
            </Marker>
          );
        })}
        {/* Day stop pins — accent solid dots numbered by sort order. */}
        {locatedStops.map((s, i) => (
          <Marker
            key={`stop-${i}-${s.name}`}
            position={[s.lat, s.lng]}
            icon={PIN_ICON_STOP}
          >
            <Popup>{s.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// Auto-zoom so every city fits the viewport with a bit of padding.
function FitToCities({ cities }: { cities: LocatedCity[] }) {
  const map = useMap();
  const fittedKey = useRef<string | null>(null);
  useEffect(() => {
    if (cities.length === 0) return;
    const key = cities.map((c) => c.name).join("|");
    if (fittedKey.current === key) return;
    fittedKey.current = key;

    if (cities.length === 1) {
      map.setView([cities[0]!.lat, cities[0]!.lng], 9);
      return;
    }
    const bounds = L.latLngBounds(cities.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 9, animate: false });
  }, [cities, map]);
  return null;
}
