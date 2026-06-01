"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

export type ExploreMapEvent = {
  id: string;
  regionSlug: string;
  cover: string;
  lat: number;
  lng: number;
  region: string;
  type: string;
  month: string;
  day: number;
  calendarRange?: {
    startDay: number;
    endDay: number;
  };
  featured: boolean;
  copy: {
    id: string;
    title: string;
    meta: string;
    location: string;
    date: string;
    date_short: string;
    country: string;
    type_label: string;
    rating: string;
  };
};

export type ExploreMapFocus = {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
};

const TYPE_ICONS: Record<string, string> = {
  festival: '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',
  food: '<path d="M4 2v7" /><path d="M8 2v7" /><path d="M12 2v7" /><path d="M4 9h8" /><path d="M8 9v13" /><path d="M20 2v20" /><path d="M16 2v7a4 4 0 0 0 4 4" />',
  nature: '<path d="m8 3 4 8 4-5 6 15H2L8 3Z" /><path d="M8 21 12 11l4 10" />',
  season: '<path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.4 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" />',
  culture: '<path d="M3 21h18" /><path d="M5 21V10" /><path d="M19 21V10" /><path d="M9 21V10" /><path d="M15 21V10" /><path d="M12 3 3 8h18l-9-5Z" />',
};

const DEFAULT_ICON =
  '<path d="M12 2 3 21h18L12 2Z" /><path d="M12 8v5" /><path d="M12 17h.01" />';

function makeEventIcon(event: ExploreMapEvent, active: boolean): L.DivIcon {
  const typeClass = `roam-explore-pin--${event.type}`;
  const activeClass = active ? " is-active" : "";
  return L.divIcon({
    className: `roam-explore-pin ${typeClass}${activeClass}`,
    html: `<span class="roam-explore-pin__halo"></span><span class="roam-explore-pin__dot"><svg class="roam-explore-pin__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${TYPE_ICONS[event.type] ?? DEFAULT_ICON}</svg></span>`,
    iconSize: active ? [46, 52] : [38, 44],
    iconAnchor: active ? [23, 46] : [19, 38],
  });
}

export function LeafletEventMap({
  events,
  activeId,
  onActiveChange,
  focusTarget,
}: {
  events: ExploreMapEvent[];
  activeId: string | null;
  onActiveChange: (eventId: string) => void;
  focusTarget: ExploreMapFocus | null;
  lang: string;
}) {
  const icons = useMemo(
    () =>
      new Map(
        events.map((event) => [
          event.id,
          makeEventIcon(event, event.id === activeId),
        ]),
      ),
    [activeId, events],
  );

  return (
    <div className="roam-explore-map absolute inset-0">
      <style>{PIN_CSS}</style>
      <MapContainer
        center={[22, 18]}
        zoom={2}
        minZoom={2}
        maxZoom={5}
        worldCopyJump={true}
        scrollWheelZoom={true}
        touchZoom={true}
        doubleClickZoom={true}
        zoomControl={true}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToEvents events={events} focusTarget={focusTarget} />
        {events.map((event) => (
          <Marker
            key={event.id}
            position={[event.lat, event.lng]}
            icon={icons.get(event.id) ?? makeEventIcon(event, false)}
            eventHandlers={{
              click: () => onActiveChange(event.id),
              mouseover: () => onActiveChange(event.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -34]} opacity={1}>
              <span className="text-[12px] font-semibold">
                {event.copy.title}
              </span>
            </Tooltip>
            <Popup>
              <div className="min-w-[180px]">
                <div className="text-[13px] font-semibold text-fg">
                  {event.copy.title}
                </div>
                <div className="mt-1 text-[12px] text-fg-muted">
                  {event.copy.date_short} · {event.copy.location}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function FitToEvents({
  events,
  focusTarget,
}: {
  events: ExploreMapEvent[];
  focusTarget: ExploreMapFocus | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusTarget) {
      if (focusTarget.bounds) {
        map.fitBounds(focusTarget.bounds, {
          animate: true,
          duration: 0.55,
          maxZoom: focusTarget.zoom,
          padding: [56, 56],
        });
        return;
      }
      map.flyTo(focusTarget.center, focusTarget.zoom, {
        animate: true,
        duration: 0.55,
      });
      return;
    }

    if (events.length === 0) {
      map.setView([22, 18], 2, { animate: true });
      return;
    }
    if (events.length === 1) {
      map.flyTo([events[0]!.lat, events[0]!.lng], 4, {
        animate: true,
        duration: 0.55,
      });
      return;
    }
    const bounds = L.latLngBounds(events.map((event) => [event.lat, event.lng]));
    map.fitBounds(bounds, {
      animate: true,
      duration: 0.45,
      maxZoom: 3,
      padding: [56, 56],
    });
  }, [events, focusTarget, map]);

  return null;
}

const PIN_CSS = `
.roam-explore-map .leaflet-container {
  background: #dfeee9;
  font: inherit;
}

.roam-explore-map .leaflet-tile-pane {
  filter: saturate(0.72) contrast(0.9) brightness(1.04);
  opacity: 0.86;
}

.roam-explore-map .leaflet-control-zoom {
  border: 0;
  border-radius: 18px;
  box-shadow: 0 16px 42px rgba(39, 45, 44, 0.16);
  overflow: hidden;
}

.roam-explore-map .leaflet-control-zoom a {
  border: 0;
  color: #242622;
  font: inherit;
  font-size: 20px;
  font-weight: 700;
}

.roam-explore-map .leaflet-popup-content-wrapper {
  border-radius: 14px;
  box-shadow: 0 20px 48px rgba(26, 31, 30, 0.18);
}

.roam-explore-map .leaflet-popup-content {
  margin: 10px 12px;
}

.roam-explore-map .leaflet-tooltip {
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #242622;
  box-shadow: 0 12px 30px rgba(28, 35, 34, 0.14);
}

.roam-explore-map .leaflet-tooltip::before {
  display: none;
}

.roam-explore-pin {
  background: transparent;
  border: 0;
  overflow: visible;
}

.roam-explore-pin__halo,
.roam-explore-pin__dot {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  border-radius: 999px 999px 999px 10px;
  transform: translate(-50%, -50%) rotate(-45deg);
}

.roam-explore-pin__halo {
  width: 42px;
  height: 42px;
  opacity: 0.32;
  filter: blur(1px);
}

.roam-explore-pin__dot {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.86);
  color: #fff;
  box-shadow: 0 12px 28px rgba(32, 38, 36, 0.28);
}

.roam-explore-pin__dot {
  line-height: 1;
}

.roam-explore-pin__icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.35;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(45deg);
}

.roam-explore-pin__dot {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.roam-explore-pin__dot {
  display: flex;
}

.roam-explore-pin__dot {
  align-items: center;
  justify-content: center;
}

.roam-explore-pin__dot {
  text-shadow: none;
}

.roam-explore-pin.is-active .roam-explore-pin__icon {
  width: 18px;
  height: 18px;
}

.roam-explore-pin--festival .roam-explore-pin__halo,
.roam-explore-pin--festival .roam-explore-pin__dot {
  background: #e85d4f;
}

.roam-explore-pin--food .roam-explore-pin__halo,
.roam-explore-pin--food .roam-explore-pin__dot {
  background: #e18a18;
}

.roam-explore-pin--nature .roam-explore-pin__halo,
.roam-explore-pin--nature .roam-explore-pin__dot {
  background: #4f9863;
}

.roam-explore-pin--season .roam-explore-pin__halo,
.roam-explore-pin--season .roam-explore-pin__dot {
  background: #7e5bd5;
}

.roam-explore-pin--culture .roam-explore-pin__halo,
.roam-explore-pin--culture .roam-explore-pin__dot {
  background: #3976d2;
}

.roam-explore-pin.is-active .roam-explore-pin__halo {
  width: 58px;
  height: 58px;
  opacity: 0.4;
}

.roam-explore-pin.is-active .roam-explore-pin__dot {
  width: 42px;
  height: 42px;
  border-width: 3px;
  box-shadow:
    0 0 0 7px rgba(255, 255, 255, 0.28),
    0 18px 38px rgba(30, 36, 34, 0.34);
}
`;
