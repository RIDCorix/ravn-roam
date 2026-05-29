"use client";

// Server-friendly wrapper around the Leaflet-based world map. Uses
// next/dynamic with ssr:false so the page renders a fixed-height
// placeholder during SSR and swaps in the real map after hydration —
// avoids Leaflet's `window` access at module init.

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

import { COUNTRY_CENTROIDS } from "./country-centroids";
import type { FootprintPin } from "./world-footprints-map";

const WorldFootprintsMap = dynamic(
  () => import("./world-footprints-map").then((m) => m.WorldFootprintsMap),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[440px] w-full animate-pulse overflow-hidden rounded-2xl bg-surface-sunken" />
    ),
  },
);

export interface FootprintEntry {
  iso: string;
  visited: boolean;
}

export function WorldFootprints({
  entries,
  localeKey,
  labels,
}: {
  entries: FootprintEntry[];
  localeKey: "zh-TW" | "en";
  labels: {
    title: string;
    summary: string;
    upcoming: string;
    empty: string;
  };
}) {
  // Resolve each entry to a pin via the centroid lookup. Unknown ISO
  // codes are silently skipped — better than dropping a fallback pin in
  // the wrong place.
  const pins: FootprintPin[] = entries
    .map((e) => {
      const c = COUNTRY_CENTROIDS[e.iso];
      if (!c) return null;
      return {
        iso: e.iso,
        lat: c.lat,
        lng: c.lng,
        label: localeKey === "en" ? c.nameEn : c.nameZh,
        visited: e.visited,
      } satisfies FootprintPin;
    })
    .filter((p): p is FootprintPin => p !== null);

  const visitedCount = pins.filter((p) => p.visited).length;
  const upcomingCount = pins.length - visitedCount;
  const upcomingText =
    upcomingCount > 0 ? format(labels.upcoming, { count: String(upcomingCount) }) : "";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
          {labels.title}
        </h2>
        <span className="text-[12px] text-fg-muted tabular-nums">
          {format(labels.summary, {
            visited: String(visitedCount),
            upcoming: upcomingText,
          })}
        </span>
      </div>

      {pins.length === 0 ? (
        <div
          className="flex h-40 flex-col items-center justify-center rounded-2xl bg-surface px-5 text-center"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <MapPin className="h-5 w-5 text-fg-muted" />
          <div className="mt-1.5 text-[13px] text-fg-muted">
            {labels.empty}
          </div>
        </div>
      ) : (
        <WorldFootprintsMap pins={pins} />
      )}
    </section>
  );
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
