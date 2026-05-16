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
.leaflet-container { background: #DCF4F3; font: inherit; }
.leaflet-popup-content { margin: 8px 12px; font-size: 12px; }
`;

export function TripMap({ cities }: { cities: TripMapCity[] }) {
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
        <FitToCities cities={located} />
        <Polyline
          positions={located.map((c) => [c.lat, c.lng])}
          pathOptions={{
            color: "#0FB8B4",
            weight: 2.5,
            opacity: 0.9,
            dashArray: "4 6",
            lineCap: "round",
          }}
        />
        {located.map((city) => (
          <Marker key={city.name} position={[city.lat, city.lng]} icon={PIN_ICON}>
            <Popup>{city.name}</Popup>
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
