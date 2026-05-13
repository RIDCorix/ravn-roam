"use client";

import { useEffect, useMemo, useState } from "react";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection } from "geojson";
import type {
  GeometryCollection,
  Topology,
} from "topojson-specification";

type Country = {
  iso: string;
  name: string;
  coords: [number, number];
  providers: number;
  coverage: string;
  speeds: string;
  dataPlans: string;
};

type ProjectedMarker = Country & {
  x: number;
  y: number;
  k: number;
};

const SUPPORTED: Country[] = [
  { iso: "US", name: "United States", coords: [-100, 39], providers: 4, coverage: "5G nationwide", speeds: "up to 300 Mbps", dataPlans: "from $4 / GB" },
  { iso: "CA", name: "Canada", coords: [-100, 56], providers: 3, coverage: "5G / LTE", speeds: "up to 240 Mbps", dataPlans: "from $4 / GB" },
  { iso: "MX", name: "Mexico", coords: [-102, 23], providers: 2, coverage: "LTE nationwide", speeds: "up to 150 Mbps", dataPlans: "from $5 / GB" },
  { iso: "BR", name: "Brazil", coords: [-52, -11], providers: 3, coverage: "5G in metros", speeds: "up to 220 Mbps", dataPlans: "from $5 / GB" },
  { iso: "AR", name: "Argentina", coords: [-65, -36], providers: 2, coverage: "LTE nationwide", speeds: "up to 140 Mbps", dataPlans: "from $6 / GB" },
  { iso: "GB", name: "United Kingdom", coords: [-2.5, 53.5], providers: 4, coverage: "5G nationwide", speeds: "up to 280 Mbps", dataPlans: "from $3 / GB" },
  { iso: "FR", name: "France", coords: [2.5, 46.5], providers: 4, coverage: "5G / LTE", speeds: "up to 260 Mbps", dataPlans: "from $3 / GB" },
  { iso: "DE", name: "Germany", coords: [10.5, 51], providers: 4, coverage: "5G nationwide", speeds: "up to 290 Mbps", dataPlans: "from $3 / GB" },
  { iso: "IT", name: "Italy", coords: [12.5, 43], providers: 3, coverage: "5G / LTE", speeds: "up to 230 Mbps", dataPlans: "from $3 / GB" },
  { iso: "ES", name: "Spain", coords: [-3.7, 40.4], providers: 3, coverage: "5G in metros", speeds: "up to 220 Mbps", dataPlans: "from $3 / GB" },
  { iso: "TR", name: "Türkiye", coords: [35, 39], providers: 3, coverage: "LTE nationwide", speeds: "up to 180 Mbps", dataPlans: "from $4 / GB" },
  { iso: "AE", name: "UAE", coords: [54, 24], providers: 2, coverage: "5G nationwide", speeds: "up to 320 Mbps", dataPlans: "from $5 / GB" },
  { iso: "IN", name: "India", coords: [78, 22], providers: 4, coverage: "5G in metros", speeds: "up to 250 Mbps", dataPlans: "from $3 / GB" },
  { iso: "TH", name: "Thailand", coords: [101, 15], providers: 3, coverage: "5G / LTE", speeds: "up to 240 Mbps", dataPlans: "from $3 / GB" },
  { iso: "SG", name: "Singapore", coords: [103.8, 1.3], providers: 3, coverage: "5G nationwide", speeds: "up to 350 Mbps", dataPlans: "from $4 / GB" },
  { iso: "JP", name: "Japan", coords: [138, 37], providers: 4, coverage: "5G nationwide", speeds: "up to 280 Mbps", dataPlans: "from $4 / GB" },
  { iso: "KR", name: "South Korea", coords: [128, 36], providers: 3, coverage: "5G nationwide", speeds: "up to 340 Mbps", dataPlans: "from $4 / GB" },
  { iso: "AU", name: "Australia", coords: [134, -25], providers: 3, coverage: "5G / LTE", speeds: "up to 260 Mbps", dataPlans: "from $4 / GB" },
  { iso: "NZ", name: "New Zealand", coords: [172, -41], providers: 2, coverage: "5G in metros", speeds: "up to 200 Mbps", dataPlans: "from $5 / GB" },
  { iso: "ZA", name: "South Africa", coords: [25, -29], providers: 2, coverage: "LTE nationwide", speeds: "up to 160 Mbps", dataPlans: "from $5 / GB" },
  { iso: "EG", name: "Egypt", coords: [30, 27], providers: 2, coverage: "LTE nationwide", speeds: "up to 150 Mbps", dataPlans: "from $5 / GB" },
  { iso: "ID", name: "Indonesia", coords: [114, -3], providers: 2, coverage: "5G in metros", speeds: "up to 190 Mbps", dataPlans: "from $4 / GB" },
];

const VIEW_W = 1200;
const VIEW_H = 360;
const PIN_HEIGHT = 64;
const TILT_ANGLE_DEG = 35;
const PERSP = 850;
const TILT_PIVOT_X = VIEW_W / 2;
const TILT_PIVOT_Y = 312;
const ANGLE = (TILT_ANGLE_DEG * Math.PI) / 180;
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);
const HIDDEN_COUNTRIES = new Set(["Antarctica", "Greenland"]);

function tilt(x: number, y: number) {
  const dy = y - TILT_PIVOT_Y;
  const z = dy * SIN;
  const k = PERSP / (PERSP - z);
  return {
    x: TILT_PIVOT_X + (x - TILT_PIVOT_X) * k,
    y: TILT_PIVOT_Y + dy * COS * k,
    k,
  };
}

type WorldTopology = Topology<{ countries: GeometryCollection }>;

export function WorldMap() {
  const [world, setWorld] = useState<WorldTopology | null>(null);
  const [hovered, setHovered] = useState<ProjectedMarker | null>(null);
  const [pinned, setPinned] = useState<ProjectedMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("world-atlas/countries-110m.json")
      .then((mod) => {
        if (!cancelled) {
          setWorld(mod.default as unknown as WorldTopology);
        }
      })
      .catch((err) => console.error("world-atlas load failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const flatProj = useMemo(
    () =>
      geoEquirectangular().scale(168).translate([VIEW_W / 2, 160]).rotate([-10, 0, 0]),
    [],
  );

  const pathGen = useMemo(() => {
    const composed = {
      stream(downstream: ReturnType<typeof flatProj.stream>) {
        const tilted = {
          point(x: number, y: number) {
            const t = tilt(x, y);
            downstream.point(t.x, t.y);
          },
          lineStart() {
            downstream.lineStart();
          },
          lineEnd() {
            downstream.lineEnd();
          },
          polygonStart() {
            downstream.polygonStart();
          },
          polygonEnd() {
            downstream.polygonEnd();
          },
          sphere() {
            downstream.sphere?.();
          },
        };
        return flatProj.stream(tilted);
      },
    };
    return geoPath(composed);
  }, [flatProj]);

  const markers = useMemo<ProjectedMarker[]>(() => {
    return SUPPORTED.map((c) => {
      const p = flatProj(c.coords);
      if (!p) return null;
      const t = tilt(p[0], p[1]);
      return { ...c, x: t.x, y: t.y, k: t.k };
    }).filter((m): m is ProjectedMarker => m !== null);
  }, [flatProj]);

  const countries = useMemo<FeatureCollection | null>(() => {
    if (!world) return null;
    const all = feature(world, world.objects.countries) as unknown as
      | FeatureCollection
      | Feature;
    if ("features" in all) {
      return {
        ...all,
        features: all.features.filter(
          (f) => !HIDDEN_COUNTRIES.has((f.properties?.name as string) ?? ""),
        ),
      };
    }
    return null;
  }, [world]);

  const activeCountry = hovered ?? pinned;
  const horizonY = 78;

  return (
    <div style={{ position: "relative", width: "100%", isolation: "isolate" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          overflow: "visible",
        }}
        aria-label="World coverage map"
      >
        <defs>
          <linearGradient id="roam-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7F7F5" stopOpacity="1" />
            <stop offset="55%" stopColor="#F7F7F5" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F7F7F5" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="roam-horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(15,184,180,0)" />
            <stop offset="55%" stopColor="rgba(15,184,180,0.10)" />
            <stop offset="100%" stopColor="rgba(15,184,180,0)" />
          </linearGradient>
          <radialGradient id="roam-floor" cx="50%" cy="38%" r="55%">
            <stop offset="0%" stopColor="rgba(15,184,180,0.10)" />
            <stop offset="55%" stopColor="rgba(15,184,180,0.03)" />
            <stop offset="100%" stopColor="rgba(247,247,245,0)" />
          </radialGradient>
          <radialGradient id="roam-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0FB8B4" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#0FB8B4" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0FB8B4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="roam-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0FB8B4" stopOpacity="0" />
            <stop offset="55%" stopColor="#0FB8B4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0FB8B4" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="roam-foot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(17,17,32,0.22)" />
            <stop offset="60%" stopColor="rgba(17,17,32,0.06)" />
            <stop offset="100%" stopColor="rgba(17,17,32,0)" />
          </radialGradient>
        </defs>

        <rect
          x="0"
          y={horizonY + 60}
          width={VIEW_W}
          height={VIEW_H - horizonY - 60}
          fill="url(#roam-floor)"
        />

        {countries && (
          <g style={{ filter: "drop-shadow(0 24px 24px rgba(17,17,32,0.04))" }}>
            {countries.features.map((f: Feature, i: number) => {
              const name = (f.properties?.name as string) ?? "";
              const isActive = activeCountry?.name === name;
              return (
                <path
                  key={`c-${i}`}
                  d={pathGen(f) ?? undefined}
                  fill={
                    isActive
                      ? "rgba(15, 184, 180, 0.18)"
                      : "rgba(17,17,32,0.06)"
                  }
                  stroke={
                    isActive
                      ? "rgba(15, 184, 180, 0.65)"
                      : "rgba(17,17,32,0.22)"
                  }
                  strokeWidth={isActive ? 0.8 : 0.45}
                  style={{
                    transition:
                      "fill 220ms var(--ease-out-soft), stroke 220ms var(--ease-out-soft)",
                  }}
                />
              );
            })}
          </g>
        )}

        {[...markers]
          .sort((a, b) => a.y - b.y)
          .map((m) => {
            const isActive = activeCountry?.iso === m.iso;
            const depth = m.k;
            const lineLen = PIN_HEIGHT * (0.55 + 0.55 * depth);
            const topY = m.y - lineLen;
            const nodeR = 9 * (0.7 + 0.45 * depth);
            const dotR = 2.8 * (0.7 + 0.45 * depth);

            return (
              <g
                key={m.iso}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(m)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  setPinned(pinned?.iso === m.iso ? null : m)
                }
              >
                <ellipse
                  cx={m.x}
                  cy={m.y + dotR * 0.6}
                  rx={nodeR * 0.95}
                  ry={nodeR * 0.32 * COS + 1.5}
                  fill="url(#roam-foot)"
                />

                <circle
                  cx={m.x}
                  cy={m.y}
                  r={(isActive ? 22 : 14) * (0.7 + 0.45 * depth)}
                  fill="url(#roam-glow)"
                  style={{ transition: "r 260ms var(--ease-out-soft)" }}
                />

                <circle
                  cx={m.x}
                  cy={m.y}
                  r={dotR + 0.4}
                  fill="none"
                  stroke="#0FB8B4"
                  strokeWidth="0.9"
                  opacity="0.5"
                >
                  <animate
                    attributeName="r"
                    from={dotR}
                    to={dotR + 12}
                    dur="2.4s"
                    begin={`${(m.x % 7) * 0.25}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.45"
                    to="0"
                    dur="2.4s"
                    begin={`${(m.x % 7) * 0.25}s`}
                    repeatCount="indefinite"
                  />
                </circle>

                <circle cx={m.x} cy={m.y} r={dotR} fill="#0FB8B4" />
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={dotR}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1"
                />

                <g
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(10px)",
                    transition:
                      "opacity 280ms var(--ease-out-soft), transform 320ms var(--ease-out-soft)",
                    pointerEvents: "none",
                  }}
                >
                  <line
                    x1={m.x}
                    y1={m.y - dotR - 0.4}
                    x2={m.x}
                    y2={topY + nodeR * 0.55}
                    stroke="url(#roam-line)"
                    strokeWidth={isActive ? 1.5 : 1.1}
                  />

                  <g transform={`translate(${m.x}, ${topY})`}>
                    <circle r={nodeR + 1.5} fill="rgba(15, 184, 180, 0.10)" />
                    <circle
                      r={nodeR}
                      fill="#fff"
                      stroke={isActive ? "#0FB8B4" : "rgba(17,17,32,0.18)"}
                      strokeWidth={isActive ? 1.4 : 1}
                      style={{
                        filter: "drop-shadow(0 4px 10px rgba(17,17,32,0.18))",
                      }}
                    />
                    {(() => {
                      const s = nodeR / 9.5;
                      return (
                        <g
                          stroke={isActive ? "#0FB8B4" : "#111"}
                          strokeWidth="1.1"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          transform={`translate(${-5 * s}, ${-5 * s}) scale(${0.42 * s})`}
                        >
                          <path d="M5 12.55a11 11 0 0 1 14 0" />
                          <path d="M2 8.82a16 16 0 0 1 20 0" />
                          <path d="M8.5 16.43a6 6 0 0 1 7 0" />
                          <circle
                            cx="12"
                            cy="20"
                            r="0.8"
                            fill={isActive ? "#0FB8B4" : "#111"}
                            stroke="none"
                          />
                        </g>
                      );
                    })()}
                  </g>
                </g>

                <circle
                  cx={m.x}
                  cy={m.y}
                  r={Math.max(14, dotR * 4)}
                  fill="transparent"
                />
              </g>
            );
          })}
      </svg>

      {activeCountry && (
        <CoverageTooltip
          country={activeCountry}
          lineLen={PIN_HEIGHT * (0.55 + 0.55 * activeCountry.k)}
        />
      )}
    </div>
  );
}

function CoverageTooltip({
  country,
  lineLen,
}: {
  country: ProjectedMarker;
  lineLen: number;
}) {
  const topY = country.y - lineLen - 18;
  const leftPct = (country.x / VIEW_W) * 100;
  const topPct = (topY / VIEW_H) * 100;
  const anchorRight = leftPct > 70;
  const anchorLeft = leftPct < 30;

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(${anchorRight ? "-100%" : anchorLeft ? "0%" : "-50%"}, -100%)`,
        marginTop: -8,
        pointerEvents: "none",
        zIndex: 5,
        width: 240,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow:
            "0 24px 60px rgba(17,17,32,0.16), 0 6px 18px rgba(17,17,32,0.08), inset 0 0 0 1px rgba(17,17,32,0.05)",
          animation: "roam-tip-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(15, 184, 180, 0.10)",
              color: "var(--accent)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            LIVE
          </span>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--fg)",
              letterSpacing: "-0.015em",
            }}
          >
            {country.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <Row label="Operators" value={`${country.providers} carriers`} />
          <Row label="Coverage" value={country.coverage} />
          <Row label="Speeds" value={country.speeds} />
          <Row label="Data" value={country.dataPlans} />
        </div>
      </div>

      <style>{`
        @keyframes roam-tip-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          color: "var(--fg-muted)",
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--fg)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}
