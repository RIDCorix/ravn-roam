// Trip overview tab: map placeholder (SVG faux-route) + day-by-day
// timeline with today-highlight. Ports design/app/components/Trips.jsx →
// TripOverview.

import type { Trip } from "@/lib/mock/consumer";
import { TODAY, uniqueCities } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

export function DailyTimeline({
  trip,
  sectionLabel,
  todayLabel,
  dayLabelTemplate,
}: {
  trip: Trip;
  sectionLabel: string;
  todayLabel: string;
  // Format template for the per-day label, e.g. "第 {n} 天" or "Day {n}".
  dayLabelTemplate: string;
}) {
  const cities = uniqueCities(trip).slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <MapPlaceholder cities={cities} />

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
                      isToday
                        ? ""
                        : "",
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

function MapPlaceholder({ cities }: { cities: string[] }) {
  const n = Math.max(1, cities.length);
  return (
    <div
      className="relative h-40 overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)",
      }}
    >
      <svg
        viewBox="0 0 400 160"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M 40 80 Q 100 30 160 70 T 280 60 T 360 110"
          fill="none"
          stroke="#0FB8B4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        {cities.map((c, i) => {
          const x = 40 + (i / Math.max(1, n - 1)) * 320;
          const y = 80 + Math.sin(i * 1.4) * 22;
          return (
            <g key={`${c}-${i}`}>
              <circle cx={x} cy={y} r="6" fill="#fff" stroke="#0FB8B4" strokeWidth="2" />
              <circle cx={x} cy={y} r="2.5" fill="#0FB8B4" />
              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                fontSize="11"
                fill="#111"
                fontWeight="600"
              >
                {c}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
