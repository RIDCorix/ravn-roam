// Itinerary card rendered when the assistant emits an `itinerary` fenced
// JSON payload. Ports design/app/components/Lumi.jsx → ItineraryCard.

import { Map as MapIcon } from "lucide-react";

import type { ItineraryDay } from "./types";

export function ItineraryCard({
  days,
  title,
}: {
  days: ItineraryDay[];
  title: string;
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: "rgba(15,184,180,0.05)",
        boxShadow: "inset 0 0 0 1px rgba(15,184,180,0.18)",
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <MapIcon className="h-3 w-3 text-accent" />
        <span className="text-[12px] font-semibold text-accent">{title}</span>
      </div>
      <div className="flex flex-col gap-1">
        {days.map((d, i) => (
          <div
            key={`${d.date}-${i}`}
            className="flex items-center gap-2.5 text-[13px]"
          >
            <span
              className="w-14 shrink-0 whitespace-nowrap text-[12px] text-fg-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {d.date}
            </span>
            <span className="whitespace-nowrap font-medium text-fg">
              {d.city}
            </span>
            {d.sub && (
              <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">
                {d.sub}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
