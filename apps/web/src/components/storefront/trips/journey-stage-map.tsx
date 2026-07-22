"use client";

// Real-map stage canvas for the V2 journey studio. World view while the
// trip frame settles, cinematic flyTo when Lumi plans one city's days,
// route polyline once cities are pinned. Client-only (Leaflet).

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

export interface JourneyMapCity {
  name: string;
  lat: number;
  lng: number;
  nights?: number | null;
  order: number;
}

export interface JourneyMapFocus {
  name: string;
  lat: number;
  lng: number;
}

function makeCityIcon(city: JourneyMapCity, dimmed: boolean): L.DivIcon {
  return L.divIcon({
    className: "roam-journey-pin",
    html: `<span class="roam-journey-pin__dot${dimmed ? " is-dim" : ""}">${city.order}</span><span class="roam-journey-pin__label${dimmed ? " is-dim" : ""}">${escapeHtml(city.name)}</span>`,
    iconSize: [120, 44],
    iconAnchor: [60, 14],
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const WORLD_CENTER: [number, number] = [24, 24];
const WORLD_ZOOM = 1.6;
const CITY_ZOOM = 11.5;

function MapDirector({
  cities,
  focus,
}: {
  cities: JourneyMapCity[];
  focus: JourneyMapFocus | null;
}) {
  const map = useMap();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (focus) {
      if (reduced) {
        map.setView([focus.lat, focus.lng], CITY_ZOOM, { animate: false });
      } else {
        map.flyTo([focus.lat, focus.lng], CITY_ZOOM, { duration: 2.4 });
      }
      return;
    }
    if (cities.length > 0) {
      const bounds = L.latLngBounds(
        cities.map((city) => [city.lat, city.lng] as [number, number]),
      ).pad(0.3);
      if (reduced) {
        map.fitBounds(bounds, { animate: false });
      } else {
        map.flyToBounds(bounds, { duration: 2 });
      }
      return;
    }
    map.setView(WORLD_CENTER, WORLD_ZOOM, { animate: !reduced });
  }, [map, cities, focus]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function JourneyStageMap({
  cities,
  focus,
  drawRoute,
}: {
  cities: JourneyMapCity[];
  focus: JourneyMapFocus | null;
  drawRoute: boolean;
}) {
  const icons = useMemo(
    () =>
      new Map(
        cities.map((city) => [
          city.order,
          makeCityIcon(city, focus != null && focus.name !== city.name),
        ]),
      ),
    [cities, focus],
  );
  const routePositions = useMemo(
    () =>
      [...cities]
        .sort((a, b) => a.order - b.order)
        .map((city) => [city.lat, city.lng] as [number, number]),
    [cities],
  );

  return (
    <div className="absolute inset-0">
      <style>{JOURNEY_MAP_CSS}</style>
      <MapContainer
        center={WORLD_CENTER}
        zoom={WORLD_ZOOM}
        zoomSnap={0.05}
        minZoom={1.1}
        maxZoom={15}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        touchZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.78}
        />
        <MapDirector cities={cities} focus={focus} />
        {drawRoute && routePositions.length >= 2 ? (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#0FB8B4",
              weight: 3,
              opacity: 0.85,
              dashArray: "1 10",
              lineCap: "round",
            }}
          />
        ) : null}
        {cities.map((city) => (
          <Marker
            key={`${city.order}-${city.name}`}
            position={[city.lat, city.lng]}
            icon={icons.get(city.order)}
            interactive={false}
          />
        ))}
      </MapContainer>
    </div>
  );
}

const JOURNEY_MAP_CSS = `
.roam-journey-pin {
  background: transparent;
  border: 0;
  display: grid;
  justify-items: center;
  gap: 4px;
  pointer-events: none;
}
.roam-journey-pin__dot {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #0FB8B4;
  border: 2px solid #fff;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 10px 22px -10px rgba(15, 184, 180, 0.85);
  animation: roam-journey-pin-pop 0.5s cubic-bezier(0.32, 0.72, 0, 1) backwards;
}
.roam-journey-pin__dot.is-dim {
  background: #fff;
  color: #0FB8B4;
  border-color: rgba(15, 184, 180, 0.45);
  box-shadow: 0 6px 16px -10px rgba(17, 17, 32, 0.4);
}
.roam-journey-pin__label {
  max-width: 116px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  padding: 2px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: #111;
  box-shadow: 0 4px 12px -6px rgba(17, 17, 32, 0.35);
}
.roam-journey-pin__label.is-dim {
  opacity: 0.65;
}
@keyframes roam-journey-pin-pop {
  from { opacity: 0; scale: 0.5; }
  to { opacity: 1; scale: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .roam-journey-pin__dot { animation: none !important; }
}
`;
