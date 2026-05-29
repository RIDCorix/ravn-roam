"use client";

// Leaflet-rendered world map for "我的足跡" on the /me page. Renders one
// drop-animated pin per visited country with a staggered cascade so the
// markers read as falling onto the map. Client-only because Leaflet
// touches `window` at module load — the parent uses next/dynamic with
// ssr:false to import this.

import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Tooltip, useMap } from "react-leaflet";

import {
  ensureZhHantProtocolRegistered,
  toZhHantUrl,
} from "./zh-hant-tile-protocol";

export interface FootprintPin {
  iso: string;
  lat: number;
  lng: number;
  label: string;
  visited: boolean; // past trips → solid pin; upcoming → outlined
}

// Mint a fresh divIcon per pin so each carries its own --drop-delay
// inline on the inner span. Setting the CSS custom property after the
// element renders (via an `add` event handler) doesn't work — the
// animation has already begun by the time the handler runs, so the
// delay must be baked into the markup at icon creation time.
function makeFootprintIcon(visited: boolean, delayMs: number): L.DivIcon {
  const variant = visited
    ? "roam-footprint-pin__dot--visited"
    : "roam-footprint-pin__dot--upcoming";
  // Glow sits BEHIND the dot (separate sibling) and shares the same
  // --drop-delay base. Its own animation-delay is offset in CSS so the
  // ripple appears just after the pin lands.
  return L.divIcon({
    className: "roam-footprint-pin",
    html: `<span class="roam-footprint-pin__glow ${visited ? "is-visited" : "is-upcoming"}" style="--drop-delay:${delayMs}ms"></span><span class="roam-footprint-pin__dot ${variant}" style="--drop-delay:${delayMs}ms"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

// Reveal animation duration must match the CSS `roam-reveal` keyframe.
// The map slides in from the right edge (moving leftward into its
// natural position) with an ease-in-out curve; pin drops trigger after
// the slide settles, cascading left-to-right across the map.
const REVEAL_DURATION_MS = 900;
const REVEAL_START_DELAY_MS = 80;
// Cascade window for pin drops once the slide is complete.
const PIN_CASCADE_MS = 420;
const PIN_DROP_OFFSET_MS = 120;

// react-leaflet adapter that mounts a MapLibre GL vector-tile layer
// inside Leaflet (via @maplibre/maplibre-gl-leaflet). We need vector
// tiles because MapTiler's raster endpoint doesn't honour `language=`
// — label text is baked in. With MapLibre we can rewrite every
// symbol layer's `text-field` at client side to prefer
// `name:zh-Hant` and fall back through Mandarin / Latin / native.
function MapLibreTiles({ styleUrl }: { styleUrl: string }) {
  const map = useMap();
  useEffect(() => {
    // Register the OpenCC-powered protocol once and route every
    // maptiler.com tile through it.
    ensureZhHantProtocolRegistered();

    // The plugin extends L with a `maplibreGL` factory — Leaflet's
    // TS types don't know about it, so cast.
    const layer = (
      L as unknown as {
        maplibreGL: (opts: {
          style: string;
          transformRequest?: (
            url: string,
            resourceType?: string,
          ) => { url: string };
        }) => L.Layer & {
          getMaplibreMap: () => {
            isStyleLoaded: () => boolean;
            once: (e: string, cb: () => void) => void;
            getStyle: () => {
              layers: Array<{
                id: string;
                type: string;
                layout?: Record<string, unknown>;
              }>;
            };
            setLayoutProperty: (
              layerId: string,
              name: string,
              value: unknown,
            ) => void;
          };
        };
      }
    ).maplibreGL({
      style: styleUrl,
      transformRequest: (url, resourceType) => {
        // Route MapTiler tile fetches through our OpenCC protocol
        // handler — only Tile resources need conversion; the style /
        // sprite / glyph requests stay direct.
        if (
          resourceType === "Tile" &&
          url.startsWith("https://api.maptiler.com")
        ) {
          return { url: toZhHantUrl(url) };
        }
        return { url };
      },
    });
    layer.addTo(map);

    const applyZhHant = () => {
      const gl = layer.getMaplibreMap();
      // Try every zh-Hant field name we've seen in OpenMapTiles /
      // MapTiler tiles, then deliberately fall through to the Latin
      // transliteration rather than `name:zh` — the unqualified `zh`
      // field is Simplified, and using it produces 简体 labels.
      const zhHantField = [
        "coalesce",
        ["get", "name:zh-Hant"],
        ["get", "name:zh-TW"],
        ["get", "name:zh-tw"],
        ["get", "name:zh_Hant"],
        ["get", "name:zh-hant"],
        ["get", "name:latin"],
        ["get", "name"],
      ];
      for (const l of gl.getStyle().layers) {
        if (l.type === "symbol" && l.layout && "text-field" in l.layout) {
          gl.setLayoutProperty(l.id, "text-field", zhHantField);
        }
      }
    };

    const gl = layer.getMaplibreMap();
    if (gl.isStyleLoaded()) applyZhHant();
    else gl.once("styledata", applyZhHant);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, styleUrl]);
  return null;
}

// Render the map wider than the viewport so the user can swipe/scroll
// horizontally to explore different regions. At zoom 3 the full world
// is exactly 2048px wide in Web Mercator — pick a slightly larger
// width so all continents are reachable via horizontal scroll without
// any ocean-blue overflow showing at the edges.
const MAP_WIDTH_PX = 2048;

export function WorldFootprintsMap({ pins }: { pins: FootprintPin[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Center the horizontal scroll on the user's pin centroid so the
  // first thing they see is where they've actually been. Web Mercator
  // x is linear in longitude, so we can compute pixel x without
  // touching Leaflet directly.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || pins.length === 0) return;
    const avgX =
      pins.reduce(
        (sum, p) => sum + ((p.lng + 180) / 360) * MAP_WIDTH_PX,
        0,
      ) / pins.length;
    el.scrollLeft = Math.max(0, avgX - el.clientWidth / 2);
  }, [pins]);

  return (
    <div
      ref={scrollerRef}
      className="-mx-5 h-[440px] overflow-x-auto overflow-y-hidden rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
    <div
      className="roam-footprint-reveal relative h-full"
      style={{ width: `${MAP_WIDTH_PX}px` }}
    >
      <MapContainer
        center={[20, 30]}
        zoom={3}
        minZoom={3}
        maxZoom={4}
        worldCopyJump={false}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        touchZoom={false}
        keyboard={false}
        boxZoom={false}
        style={{ height: "100%", width: "100%", background: "#E6F4F4" }}
      >
        <MapLibreTiles
          styleUrl={`https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ""}&language=zh-Hant`}
        />
        {(() => {
          // Rank pins by longitude so the drop cascade reads left→right
          // across the map. Delay is computed at render time and baked
          // into the divIcon HTML so each pin's animation starts with
          // its own offset from the moment Leaflet mounts the element.
          const ranks = new Map<string, number>();
          [...pins]
            .sort((a, b) => a.lng - b.lng)
            .forEach((p, i) => ranks.set(p.iso, i));
          const lastRank = Math.max(1, pins.length - 1);
          return pins.map((p) => {
            const rank = ranks.get(p.iso) ?? 0;
            const t = rank / lastRank;
            const delay =
              REVEAL_START_DELAY_MS +
              REVEAL_DURATION_MS +
              PIN_DROP_OFFSET_MS +
              Math.round(t * PIN_CASCADE_MS);
            return (
              <Marker
                key={p.iso}
                position={[p.lat, p.lng]}
                icon={makeFootprintIcon(p.visited, delay)}
              >
                <Tooltip direction="top" offset={[0, -18]} opacity={1}>
                  {p.label}
                </Tooltip>
              </Marker>
            );
          });
        })()}
      </MapContainer>
    </div>

      <style>{`
        .roam-footprint-reveal {
          animation: roam-reveal ${REVEAL_DURATION_MS}ms cubic-bezier(0.32, 0, 0.16, 1) ${REVEAL_START_DELAY_MS}ms both;
        }
        /* translateX is sized to the viewport (100vw) — translating by
           the inner div's own width (100%) would move it 2048px and the
           slide would feel both too fast and pointlessly long. */
        @keyframes roam-reveal {
          0%   { transform: translateX(100vw); opacity: 0.6; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .roam-footprint-pin {
          background: transparent;
          border: 0;
          /* Let the glow render outside the 22×22 icon box. */
          overflow: visible;
        }
        /* "Claimed area" glow that ripples out from the pin tip just
           after the pin lands, then settles into a slow pulse. */
        .roam-footprint-pin__glow {
          position: absolute;
          left: 50%;
          bottom: 0;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, 50%) scale(0);
          animation:
            roam-pin-claim 900ms cubic-bezier(0.22, 1, 0.36, 1) backwards,
            roam-pin-pulse 2600ms ease-in-out infinite;
          animation-delay:
            calc(var(--drop-delay, 0ms) + 240ms),
            calc(var(--drop-delay, 0ms) + 1140ms);
        }
        .roam-footprint-pin__glow.is-visited {
          background: radial-gradient(circle, rgba(15,184,180,0.45) 0%, rgba(15,184,180,0.18) 45%, rgba(15,184,180,0) 70%);
        }
        .roam-footprint-pin__glow.is-upcoming {
          background: radial-gradient(circle, rgba(91,124,250,0.32) 0%, rgba(91,124,250,0.12) 45%, rgba(91,124,250,0) 70%);
        }
        @keyframes roam-pin-claim {
          0%   { opacity: 0; transform: translate(-50%, 50%) scale(0); }
          60%  { opacity: 0.95; transform: translate(-50%, 50%) scale(1.18); }
          100% { opacity: 0.6; transform: translate(-50%, 50%) scale(1); }
        }
        @keyframes roam-pin-pulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, 50%) scale(1); }
          50%      { opacity: 0.85; transform: translate(-50%, 50%) scale(1.08); }
        }
        .roam-footprint-pin__dot {
          position: relative;
          display: block;
          width: 22px;
          height: 22px;
          transform-origin: 50% 100%;
          animation: roam-pin-drop 560ms cubic-bezier(0.18, 0.85, 0.32, 1.18) backwards;
          animation-delay: var(--drop-delay, 0ms);
        }
        /* Classic teardrop pin: a 14×14 square with bl-radius=0 rotated
           -45° around its center so the sharp bottom-left corner
           points straight down. The square must be perfectly square —
           a rectangle would rotate into a skewed diamond. */
        .roam-footprint-pin__dot::before {
          content: "";
          position: absolute;
          top: 4px;
          left: 4px;
          width: 14px;
          height: 14px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: linear-gradient(135deg, #0FB8B4, #0a7d7a);
          box-shadow: 0 4px 10px -2px rgba(15,184,180,0.55), inset 0 0 0 2px rgba(255,255,255,0.9);
        }
        .roam-footprint-pin__dot--upcoming::before {
          background: #fff;
          box-shadow: 0 2px 6px -1px rgba(15,184,180,0.30), inset 0 0 0 2px #0FB8B4;
        }
        .roam-footprint-pin__dot::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 0;
          width: 10px;
          height: 4px;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.18);
          border-radius: 50%;
          filter: blur(1.5px);
          animation: roam-pin-shadow 560ms cubic-bezier(0.18, 0.85, 0.32, 1.18) backwards;
          animation-delay: var(--drop-delay, 0ms);
        }
        @keyframes roam-pin-drop {
          0%   { transform: translateY(-32px) scale(0.6); opacity: 0; }
          60%  { transform: translateY(2px) scale(1.05); opacity: 1; }
          80%  { transform: translateY(-2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes roam-pin-shadow {
          0%   { opacity: 0; transform: translateX(-50%) scaleX(0.2); }
          60%  { opacity: 1; transform: translateX(-50%) scaleX(1.15); }
          100% { opacity: 1; transform: translateX(-50%) scaleX(1); }
        }
        .leaflet-container { background: #E6F4F4; }
        .leaflet-tooltip {
          background: rgba(15,15,15,0.85);
          color: #fff;
          border: 0;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .leaflet-tooltip-top:before { border-top-color: rgba(15,15,15,0.85); }
      `}</style>
    </div>
  );
}
