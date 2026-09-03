"use client";

// R-301 planner map. Same provider as the rest of the product (Leaflet on
// OSM tiles) — the redesign changes what the map says, not who draws it.
//
// The rules the spec settled: pin the places we stay in, draw a neutral
// route only between real relocations, and let the accent colour mean one
// thing only — the day currently selected.

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

export interface PlannerMapPlace {
  key: string;
  name: string;
  order: number;
  lat: number;
  lng: number;
  active: boolean;
}

export interface PlannerMapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function placeIcon(place: PlannerMapPlace): L.DivIcon {
  return L.divIcon({
    className: "planner-pin",
    html:
      `<span class="planner-pin__dot${place.active ? " is-active" : ""}">${place.order}</span>` +
      `<span class="planner-pin__label${place.active ? " is-active" : ""}">${escapeHtml(place.name)}</span>`,
    iconSize: [128, 46],
    iconAnchor: [64, 15],
  });
}

const STOP_ICON = L.divIcon({
  className: "planner-stop-pin",
  html: `<span class="planner-stop-pin__dot"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapDirector({
  places,
  activeKey,
}: {
  places: PlannerMapPlace[];
  activeKey: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (places.length === 0) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const active = places.find((place) => place.key === activeKey);
    if (active) {
      map.setView([active.lat, active.lng], 9.5, { animate: !reduced });
      return;
    }
    const bounds = L.latLngBounds(
      places.map((place) => [place.lat, place.lng] as [number, number]),
    ).pad(0.4);
    map.fitBounds(bounds, { animate: !reduced });
  }, [map, places, activeKey]);

  return null;
}

export function PlannerMap({
  places,
  stops,
  activeKey,
}: {
  places: PlannerMapPlace[];
  stops: PlannerMapStop[];
  activeKey: string | null;
}) {
  const icons = useMemo(
    () => new Map(places.map((place) => [place.key, placeIcon(place)])),
    [places],
  );
  const route = useMemo(
    () =>
      [...places]
        .sort((a, b) => a.order - b.order)
        .map((place) => [place.lat, place.lng] as [number, number]),
    [places],
  );
  const center = route[0] ?? ([35.68, 139.76] as [number, number]);

  return (
    <div className="absolute inset-0" data-testid="planner-map-canvas">
      <MapContainer
        center={center}
        zoom={6}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.8}
        />
        <MapDirector places={places} activeKey={activeKey} />
        {route.length >= 2 ? (
          <Polyline
            positions={route}
            pathOptions={{
              // Relocations only, and deliberately neutral: the route is
              // not a day, so it never takes the accent colour.
              color: "#8a8a82",
              weight: 2,
              opacity: 0.85,
              dashArray: "2 8",
              lineCap: "round",
            }}
          />
        ) : null}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={STOP_ICON}
            interactive={false}
            alt={stop.name}
          />
        ))}
        {places.map((place) => (
          <Marker
            key={place.key}
            position={[place.lat, place.lng]}
            icon={icons.get(place.key)}
            interactive={false}
            alt={place.name}
          />
        ))}
      </MapContainer>
    </div>
  );
}
