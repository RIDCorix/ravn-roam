"use client";

import { geoEquirectangular, geoPath } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { AnimatePresence, m, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type {
  GeometryCollection,
  Topology,
} from "topojson-specification";

import type { Dictionary } from "@/app/[lang]/dictionaries";

const ENTER_EASE = [0.22, 0.61, 0.36, 1] as const;

const VIEW_W = 600;
const VIEW_H = 300;

/* Equirectangular keeps lat/lng linear, simple to project city coords by
   hand. Scale chosen so the inhabited world fills the viewBox with margin;
   Antarctica is filtered out below since it dominates and adds no value. */
const projection = geoEquirectangular()
  .scale(95)
  .translate([VIEW_W / 2, VIEW_H / 2 + 8]);
const pathGen = geoPath(projection);

function projectCity(lng: number, lat: number): [number, number] {
  const p = projection([lng, lat]);
  return p ?? [0, 0];
}

/* Generate footprint markers between two projected points. Each step is
   offset slightly perpendicular to the path, alternating L/R, so the chain
   reads as a walking trail rather than a straight dotted line. */
function footprintsBetween(
  p1: [number, number],
  p2: [number, number],
): Array<{ x: number; y: number; angle: number }> {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return [];
  const stepsCount = Math.max(4, Math.floor(dist / 16));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const out: Array<{ x: number; y: number; angle: number }> = [];
  for (let i = 1; i < stepsCount; i++) {
    const t = i / stepsCount;
    const baseX = p1[0] + dx * t;
    const baseY = p1[1] + dy * t;
    const offset = (i % 2 === 0 ? 1 : -1) * 1.6;
    out.push({
      x: baseX + perpX * offset,
      y: baseY + perpY * offset,
      angle,
    });
  }
  return out;
}

/* Real city lat/lng — keyed by ISO country code so the dict only stores the
   localized city name. Add more entries here as the demo set grows. */
const CITY_COORDS: Record<string, [number, number]> = {
  JP: [139.6917, 35.6895], // Tokyo
  KR: [126.978, 37.5665], // Seoul
  TH: [100.5018, 13.7563], // Bangkok
  SG: [103.8198, 1.3521], // Singapore
  FR: [2.3522, 48.8566], // Paris
  PT: [-9.1393, 38.7223], // Lisbon
  US: [-74.006, 40.7128], // New York
  AU: [151.2093, -33.8688], // Sydney
};

type WorldTopology = Topology<{ countries: GeometryCollection }>;

export function CollectionMap({
  dict,
}: {
  dict: Dictionary["journey"]["map"];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [world, setWorld] = useState<WorldTopology | null>(null);

  /* Lazy-load the world atlas only once the card scrolls into view. Same
     bundle dedupes with WorldMapLazy in the #coverage section. */
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    import("world-atlas/countries-110m.json")
      .then((mod) => {
        if (!cancelled) setWorld(mod.default as unknown as WorldTopology);
      })
      .catch((err) => console.error("world-atlas load failed", err));
    return () => {
      cancelled = true;
    };
  }, [inView]);

  const countries = useMemo<FeatureCollection | null>(() => {
    if (!world) return null;
    const all = feature(world, world.objects.countries) as unknown as
      | FeatureCollection
      | Feature;
    if (!("features" in all)) return null;
    /* Hide Antarctica — visually dominant, adds nothing to the story. */
    return {
      ...all,
      features: all.features.filter(
        (f) => (f.properties?.name as string) !== "Antarctica",
      ),
    };
  }, [world]);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        height: "100%",
        minHeight: 420,
        borderRadius: 24,
        background: "linear-gradient(160deg, #fdfaf2 0%, #f6efe1 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(80,60,30,0.18), 0 8px 24px -8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(80,60,30,0.08)",
        padding: "28px 30px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflow: "hidden",
      }}
    >
      {/* eyebrow row — restrained */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(80,60,30,0.55)",
          fontWeight: 600,
        }}
      >
        <span>Atlas</span>
        <span style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
          <LegendChip
            label={`${dict.collectedLabel} · ${dict.collected.length}`}
            variant="collected"
          />
          <LegendChip
            label={`${dict.plannedLabel} · ${dict.planned.length}`}
            variant="planned"
          />
        </span>
      </div>

      {/* map */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ width: "100%", height: "auto", overflow: "visible" }}
          aria-hidden
        >
          {/* graticule — very faint horizon lines, "atlas paper" feel */}
          <g
            stroke="rgba(80,60,30,0.06)"
            strokeWidth="0.4"
            strokeDasharray="1 4"
          >
            {[60, 120, 180, 240].map((y) => (
              <line key={y} x1="0" y1={y} x2={VIEW_W} y2={y} />
            ))}
          </g>

          {/* countries — load progressively to avoid a thud */}
          <AnimatePresence>
            {countries && (
              <m.g
                key="countries"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, ease: ENTER_EASE }}
                fill="rgba(80,60,30,0.14)"
                stroke="rgba(80,60,30,0.22)"
                strokeWidth="0.35"
                strokeLinejoin="round"
              >
                {countries.features.map((f, i) => {
                  const d = pathGen(f as Feature);
                  return d ? <path key={i} d={d} /> : null;
                })}
              </m.g>
            )}
          </AnimatePresence>

          {/* footprint trail — stitches consecutive collected cities together.
              Renders behind the dots so the city circles sit on top. */}
          {dict.collected.slice(0, -1).map((_, segIdx) => {
            const a = CITY_COORDS[dict.collected[segIdx].country];
            const b = CITY_COORDS[dict.collected[segIdx + 1].country];
            if (!a || !b) return null;
            const p1 = projectCity(a[0], a[1]);
            const p2 = projectCity(b[0], b[1]);
            const steps = footprintsBetween(p1, p2);
            return (
              <g key={`trail-${segIdx}`}>
                {steps.map((s, stepIdx) => (
                  <m.ellipse
                    key={stepIdx}
                    cx={s.x}
                    cy={s.y}
                    rx="2.2"
                    ry="1.3"
                    transform={`rotate(${s.angle} ${s.x} ${s.y})`}
                    fill="var(--accent)"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={
                      inView && countries
                        ? { opacity: 0.55, scale: 1 }
                        : {}
                    }
                    transition={{
                      delay:
                        1.2 + segIdx * 0.25 + stepIdx * 0.05,
                      duration: 0.35,
                      ease: ENTER_EASE,
                    }}
                    style={{
                      transformOrigin: `${s.x}px ${s.y}px`,
                      transformBox: "fill-box",
                    }}
                  />
                ))}
              </g>
            );
          })}

          {/* planned pins — flag planted at each destination */}
          {dict.planned.map((p, i) => {
            const coord = CITY_COORDS[p.country];
            if (!coord) return null;
            const [x, y] = projectCity(coord[0], coord[1]);
            return (
              <m.g
                key={`planned-${p.country}`}
                initial={{ opacity: 0, y: -8, scale: 0.4 }}
                animate={
                  inView && countries
                    ? { opacity: 1, y: 0, scale: 1 }
                    : {}
                }
                transition={{
                  delay: 0.7 + i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1.3, 0.36, 1],
                }}
                style={{
                  transformOrigin: `${x}px ${y}px`,
                  transformBox: "fill-box",
                }}
              >
                {/* tiny base dot at the actual city coord */}
                <circle
                  cx={x}
                  cy={y}
                  r="1.4"
                  fill="rgba(80,60,30,0.65)"
                />
                {/* pole — leans very slightly right for a planted look */}
                <line
                  x1={x}
                  y1={y}
                  x2={x + 0.4}
                  y2={y - 11}
                  stroke="rgba(80,60,30,0.78)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                {/* pennant — warm earth flag flying right */}
                <path
                  d={`M ${x + 0.4} ${y - 11}
                      L ${x + 6.8} ${y - 9.4}
                      L ${x + 4.6} ${y - 7.6}
                      L ${x + 0.4} ${y - 7.6} Z`}
                  fill="#c08c5a"
                  stroke="#8a5e30"
                  strokeWidth="0.4"
                  strokeLinejoin="round"
                />
              </m.g>
            );
          })}

          {/* collected pins — accent fill, pulse on top */}
          {dict.collected.map((c, i) => {
            const coord = CITY_COORDS[c.country];
            if (!coord) return null;
            const [x, y] = projectCity(coord[0], coord[1]);
            return (
              <g key={`collected-${c.country}`}>
                {/* pulse ring */}
                <m.circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.2"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={
                    inView && countries
                      ? { opacity: [0.6, 0, 0.6], scale: [1, 2.6, 1] }
                      : {}
                  }
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    delay: 0.4 + i * 0.12,
                    ease: "easeOut",
                  }}
                  style={{
                    transformOrigin: `${x}px ${y}px`,
                    transformBox: "fill-box",
                  }}
                />
                {/* core dot — slightly larger than planned for hierarchy */}
                <m.circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--accent)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={inView && countries ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    delay: 0.4 + i * 0.12,
                    duration: 0.5,
                    ease: [0.22, 1.4, 0.36, 1],
                  }}
                  style={{
                    transformOrigin: `${x}px ${y}px`,
                    transformBox: "fill-box",
                    filter: "drop-shadow(0 1.5px 3px rgba(15,184,180,0.55))",
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* cities footer — single-line lists, restrained */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingTop: 12,
          borderTop: "1px solid rgba(80,60,30,0.12)",
        }}
      >
        <CityRow
          label={dict.collectedLabel}
          cities={dict.collected.map((c) => c.city)}
          variant="collected"
        />
        <CityRow
          label={dict.plannedLabel}
          cities={dict.planned.map((c) => c.city)}
          variant="planned"
        />
      </div>
    </div>
  );
}

function LegendChip({
  label,
  variant,
}: {
  label: string;
  variant: "collected" | "planned";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        textTransform: "none",
        letterSpacing: "0.02em",
        fontWeight: 500,
      }}
    >
      {variant === "collected" ? (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent)",
          }}
        />
      ) : (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            border: "1.2px dashed rgba(80,60,30,0.55)",
          }}
        />
      )}
      <span style={{ color: "rgba(80,60,30,0.75)" }}>{label}</span>
    </span>
  );
}

function CityRow({
  label,
  cities,
  variant,
}: {
  label: string;
  cities: string[];
  variant: "collected" | "planned";
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 14,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(80,60,30,0.5)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color:
            variant === "collected" ? "#3a2c14" : "rgba(80,60,30,0.65)",
          lineHeight: 1.5,
        }}
      >
        {cities.join("  ·  ")}
      </span>
    </div>
  );
}
