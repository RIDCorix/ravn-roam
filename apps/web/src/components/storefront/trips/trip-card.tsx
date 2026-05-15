// Trip list row card. Ports design/app/components/Trips.jsx → TripRow.
// Server component — only navigation, no state.

import { ViewTransition } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { Trip, TripStatus } from "@/lib/mock/consumer";
import { uniqueCities } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

export function TripCard({
  trip,
  href,
  tasksLabel,
  daysUnit,
  activeBadgeLabel,
}: {
  trip: Trip;
  href: string;
  tasksLabel: string;
  daysUnit: string;
  activeBadgeLabel: string;
}) {
  const cities = uniqueCities(trip);
  const done = trip.checklist.filter((t) => t.done).length;
  const total = trip.checklist.length;
  const isPast = trip.status === "past";

  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-shadow duration-150 hover:shadow-md",
        isPast && "opacity-75",
      )}
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-xs)" }}
    >
      <ViewTransition name={`trip-cover-${trip.id}`}>
        <CoverBadge cover={trip.cover} status={trip.status} />
      </ViewTransition>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ViewTransition name={`trip-title-${trip.id}`}>
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {trip.title}
            </span>
          </ViewTransition>
          {trip.status === "active" && (
            <ActivePill label={activeBadgeLabel} />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-fg-secondary">
          <span className="whitespace-nowrap">
            {trip.start.slice(5)} – {trip.end.slice(5)}
          </span>
          {trip.days.length > 0 && (
            <>
              <span className="text-fg-muted">·</span>
              <span className="whitespace-nowrap">
                {trip.days.length} {daysUnit}
              </span>
            </>
          )}
          {cities.length > 0 && (
            <>
              <span className="text-fg-muted">·</span>
              <span className="truncate">{cities.join(" · ")}</span>
            </>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="shrink-0 text-right">
          <div
            className="whitespace-nowrap text-[13px] text-fg"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {done}/{total}
          </div>
          <div className="whitespace-nowrap text-[10px] text-fg-muted">
            {tasksLabel}
          </div>
        </div>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
    </Link>
  );
}

function CoverBadge({ cover, status }: { cover: string; status: TripStatus }) {
  const palette =
    status === "active"
      ? { bg: "var(--accent)", color: "#fff" }
      : status === "upcoming"
        ? { bg: "rgba(91,124,250,0.14)", color: "var(--info)" }
        : { bg: "rgba(0,0,0,0.04)", color: "var(--fg-secondary)" };
  return (
    <div
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold tracking-[-0.02em]"
      style={{ background: palette.bg, color: palette.color }}
    >
      {cover}
    </div>
  );
}

function ActivePill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[2px] text-[10px] font-semibold tracking-[0.02em] text-accent"
      style={{ background: "var(--accent-soft)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}
