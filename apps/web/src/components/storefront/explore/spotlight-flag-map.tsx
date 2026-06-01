"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export type SpotlightMapEvent = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  tone: "coral" | "gold" | "green" | "cyan" | "violet" | "rose";
};

function makePinIcon(event: SpotlightMapEvent, active: boolean): L.DivIcon {
  return L.divIcon({
    className: `roam-spotlight-pin roam-spotlight-pin--${event.tone}${
      active ? " is-active" : ""
    }`,
    html: `<span class="roam-spotlight-pin__pulse"></span><span class="roam-spotlight-pin__shadow"></span><span class="roam-spotlight-pin__mark"><span class="roam-spotlight-pin__dot"></span></span>`,
    iconSize: active ? [44, 50] : [32, 38],
    iconAnchor: active ? [22, 46] : [16, 36],
    popupAnchor: [0, -40],
  });
}

export function SpotlightFlagMap({
  events,
  activeId,
  onActiveChange,
}: {
  events: SpotlightMapEvent[];
  activeId: string;
  onActiveChange: (eventId: string) => void;
}) {
  const icons = useMemo(
    () =>
      new Map(
        events.map((event) => [
          event.id,
          makePinIcon(event, event.id === activeId),
        ]),
      ),
    [activeId, events],
  );

  return (
    <div className="roam-spotlight-map absolute inset-0">
      <style>{FLAG_MAP_CSS}</style>
      <MapContainer
        center={[18, 18]}
        zoom={1.28}
        zoomSnap={0.05}
        minZoom={1.15}
        maxZoom={2.8}
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
          opacity={0.76}
        />
        <MapSettler />
        {events.map((event) => (
          <Marker
            key={event.id}
            position={[event.lat, event.lng]}
            icon={icons.get(event.id) ?? makePinIcon(event, false)}
            title={event.title}
            eventHandlers={{ click: () => onActiveChange(event.id) }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

function MapSettler() {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds([
      [-72, -178],
      [82, 178],
    ]);
  }, [map]);

  return null;
}

const FLAG_MAP_CSS = `
.roam-spotlight-map .leaflet-container {
  background: transparent;
  cursor: default;
  font: inherit;
}

.roam-spotlight-map .leaflet-tile-pane {
  filter: grayscale(1) sepia(0.1) contrast(1.04) brightness(1.08);
  opacity: 0.82;
}

.roam-spotlight-map .leaflet-control-container,
.roam-spotlight-map .leaflet-pane.leaflet-shadow-pane {
  display: none;
}

.roam-spotlight-pin {
  background: transparent;
  border: 0;
  overflow: visible;
}

.roam-spotlight-pin__shadow {
  position: absolute;
  left: 6px;
  top: 31px;
  width: 20px;
  height: 8px;
  border-radius: 999px;
  background: rgba(27, 39, 41, 0.2);
  filter: blur(4px);
  transform: rotate(-10deg);
}

.roam-spotlight-pin__mark {
  position: absolute;
  left: 4px;
  top: 2px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.86);
  border-radius: 999px 999px 999px 6px;
  box-shadow:
    inset 8px 8px 14px rgba(255, 255, 255, 0.16),
    0 12px 24px rgba(31, 36, 34, 0.22);
  transform: rotate(-45deg);
  transform-origin: center;
}

.roam-spotlight-pin__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.roam-spotlight-pin__pulse {
  position: absolute;
  left: 1px;
  top: 19px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  opacity: 0;
  transform: scale(0.6);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.48);
}

.roam-spotlight-pin.is-active .roam-spotlight-pin__mark {
  left: 3px;
  top: -2px;
  width: 36px;
  height: 36px;
  border-width: 3px;
  box-shadow:
    inset 10px 10px 16px rgba(255, 255, 255, 0.18),
    0 16px 34px rgba(31, 36, 34, 0.3);
}

.roam-spotlight-pin.is-active .roam-spotlight-pin__dot {
  width: 10px;
  height: 10px;
}

.roam-spotlight-pin.is-active .roam-spotlight-pin__pulse {
  opacity: 0.55;
  animation: roam-spotlight-pin-pulse 1.9s ease-out infinite;
}

.roam-spotlight-pin--coral .roam-spotlight-pin__mark,
.roam-spotlight-pin--coral .roam-spotlight-pin__pulse { background: rgb(232, 93, 79); }
.roam-spotlight-pin--gold .roam-spotlight-pin__mark,
.roam-spotlight-pin--gold .roam-spotlight-pin__pulse { background: rgb(225, 138, 24); }
.roam-spotlight-pin--green .roam-spotlight-pin__mark,
.roam-spotlight-pin--green .roam-spotlight-pin__pulse { background: rgb(79, 152, 99); }
.roam-spotlight-pin--cyan .roam-spotlight-pin__mark,
.roam-spotlight-pin--cyan .roam-spotlight-pin__pulse { background: rgb(50, 151, 178); }
.roam-spotlight-pin--violet .roam-spotlight-pin__mark,
.roam-spotlight-pin--violet .roam-spotlight-pin__pulse { background: rgb(126, 91, 213); }
.roam-spotlight-pin--rose .roam-spotlight-pin__mark,
.roam-spotlight-pin--rose .roam-spotlight-pin__pulse { background: rgb(215, 85, 138); }

@keyframes roam-spotlight-pin-pulse {
  0% { opacity: 0.5; transform: scale(0.45); }
  70% { opacity: 0; transform: scale(1.65); }
  100% { opacity: 0; transform: scale(1.65); }
}
`;
