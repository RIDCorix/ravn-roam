"use client";

// Trip overview tab: real Leaflet map + day-by-day timeline with
// today-highlight. The map is dynamically imported with ssr:false so
// leaflet's `window`-touching module init never runs on the server.

import dynamic from "next/dynamic";

import type { Trip } from "@/lib/mock/consumer";
import { TODAY } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

import type { TripMapCity } from "./trip-map";

const TripMap = dynamic(() => import("./trip-map").then((m) => m.TripMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-48 rounded-2xl"
      style={{ background: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)" }}
    />
  ),
});

export function DailyTimeline({
  trip,
  cities,
  sectionLabel,
  todayLabel,
  dayLabelTemplate,
}: {
  trip: Trip;
  cities: TripMapCity[];
  sectionLabel: string;
  todayLabel: string;
  // Format template for the per-day label, e.g. "第 {n} 天" or "Day {n}".
  dayLabelTemplate: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <TripMap cities={cities} />

      {trip.days.length > 0 && (
        <div>
          <div className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
            {sectionLabel}
          </div>
          <ol className="relative">
            <span className="absolute bottom-2 left-[88px] top-2 w-px bg-divider" />
            {trip.days.map((d, i) => {
              const isToday = d.d === TODAY;
              return (
                <li
                  key={`${d.d}-${i}`}
                  className="relative flex items-start gap-4 px-0 py-2"
                >
                  <div className="w-16 shrink-0 text-right">
                    <div
                      className="whitespace-nowrap text-[11px] text-fg-muted"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {dayLabelTemplate.replace("{n}", String(i + 1))}
                    </div>
                    <div
                      className="whitespace-nowrap text-[13px] font-medium text-fg"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {d.d.slice(5)}
                    </div>
                  </div>
                  <span
                    className="relative z-10 mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: isToday ? "var(--accent)" : "#fff",
                      boxShadow: isToday
                        ? "0 0 0 4px rgba(15,184,180,0.18)"
                        : "inset 0 0 0 2px var(--divider-strong)",
                    }}
                  />
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-xl px-3.5 py-2",
                      isToday ? "" : "",
                    )}
                    style={{
                      background: isToday
                        ? "rgba(15,184,180,0.08)"
                        : "var(--surface)",
                      boxShadow: isToday ? "none" : "var(--shadow-xs)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[14px] font-semibold",
                          isToday ? "text-accent" : "text-fg",
                        )}
                      >
                        {d.city}
                      </span>
                      {isToday && (
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[2px] text-[10px] font-semibold text-accent"
                          style={{ background: "var(--accent-soft)" }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          {todayLabel}
                        </span>
                      )}
                    </div>
                    {d.note && (
                      <div className="mt-0.5 truncate text-[12px] text-fg-secondary">
                        {d.note}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
