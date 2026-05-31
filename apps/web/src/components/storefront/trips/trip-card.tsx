// Trip list row card. Ports design/app/components/Trips.jsx → TripRow.
// Server component — only navigation, no state.

import { ChevronRight } from "lucide-react";

import { MotionLink } from "@/components/storefront/motion";
import { tripCoverUrl } from "@/lib/trip-cover";
import type { Trip, TripStatus } from "@/lib/trip-types";
import { uniqueTripCities } from "@/lib/trip-types";
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
  const cities = uniqueTripCities(trip);
  const done = trip.checklist.filter((t) => t.done).length;
  const total = trip.checklist.length;
  const isPast = trip.status === "past";
  const coverUrl = tripCoverUrl({ title: trip.title, cities });

  return (
    <MotionLink
      href={href}
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "relative flex min-h-[92px] w-full items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-3.5 text-left text-white transition-shadow duration-150 hover:shadow-md",
        isPast && "opacity-75",
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(12,14,20,0.74) 0%, rgba(12,14,20,0.56) 48%, rgba(12,14,20,0.34) 100%), url(${coverUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <CoverBadge cover={trip.cover} status={trip.status} />
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] drop-shadow-sm">
            {trip.title}
          </span>
          {trip.status === "active" && (
            <ActivePill label={activeBadgeLabel} />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-white/82 drop-shadow-sm">
          <span className="whitespace-nowrap">
            {trip.start.slice(5)} – {trip.end.slice(5)}
          </span>
          {trip.days.length > 0 && (
            <>
              <span className="text-white/60">·</span>
              <span className="whitespace-nowrap">
                {trip.days.length} {daysUnit}
              </span>
            </>
          )}
          {cities.length > 0 && (
            <>
              <span className="text-white/60">·</span>
              <span className="truncate">{cities.join(" · ")}</span>
            </>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="relative shrink-0 text-right">
          <div
            className="whitespace-nowrap text-[13px] text-white drop-shadow-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {done}/{total}
          </div>
          <div className="whitespace-nowrap text-[10px] text-white/70">
            {tasksLabel}
          </div>
        </div>
      )}
      <ChevronRight className="relative h-4 w-4 shrink-0 text-white/75" />
    </MotionLink>
  );
}

function CoverBadge({ cover, status }: { cover: string; status: TripStatus }) {
  const palette =
    status === "active"
      ? { bg: "rgba(15,184,180,0.92)", color: "#fff" }
      : status === "upcoming"
        ? { bg: "rgba(255,255,255,0.82)", color: "var(--info)" }
        : { bg: "rgba(255,255,255,0.74)", color: "var(--fg-secondary)" };
  return (
    <div
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold tracking-[-0.02em] shadow-sm backdrop-blur"
      style={{ background: palette.bg, color: palette.color }}
    >
      {cover}
    </div>
  );
}

function ActivePill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/82 px-2 py-[2px] text-[10px] font-semibold tracking-[0.02em] text-accent shadow-sm backdrop-blur"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}
