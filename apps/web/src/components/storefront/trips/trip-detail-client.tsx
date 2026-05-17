"use client";

// Client wrapper for the trip detail body. Receives the server-rendered
// initial payload so the first paint is identical to RSC, then takes
// over data ownership via SWR. Mutations (Lumi edits, companion CRUD)
// call `refreshTrip(id)` which re-fetches just this entry — no RSC
// re-render, no router.refresh().

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CompanionsMenu } from "@/components/storefront/trips/companions-menu";
import {
  TripDetailTabs,
  type TripDetailLabels,
} from "@/components/storefront/trips/trip-detail-tabs";
import { apiDetailToTrip } from "@/lib/trip-mapping";
import { useTripDetail } from "@/lib/trip-cache";
import type { TripDetailPayload } from "@/lib/trips-api";

export interface TripDetailClientLabels extends TripDetailLabels {
  back: string;
  dayUnit: string;
  companions: {
    manage_title: string;
    manage_aria: string;
    add: string;
    rename_placeholder: string;
    copy_invite: string;
    copied: string;
    link_only: string;
    joined: string;
    delete: string;
    pick_friend: string;
    pick_friend_soon: string;
  };
}

export function TripDetailClient({
  tripId,
  lang,
  initialPayload,
  labels,
}: {
  tripId: string;
  lang: string;
  initialPayload: TripDetailPayload;
  labels: TripDetailClientLabels;
}) {
  const { data } = useTripDetail(tripId, initialPayload);
  const payload = data ?? initialPayload;
  const trip = apiDetailToTrip(payload);

  return (
    <div>
      <header
        className="sticky top-0 z-10 flex items-center gap-2.5 px-5 py-3.5 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "rgba(247,247,245,0.85)" }}
      >
        <Link
          href={`/${lang}/trips`}
          aria-label={labels.back}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-semibold tracking-[-0.015em]">
            {trip.title}
          </h1>
          <div className="whitespace-nowrap text-[12px] text-fg-muted">
            {trip.start} → {trip.end}
            {trip.days.length > 0
              ? ` · ${trip.days.length} ${labels.dayUnit}`
              : ""}
          </div>
        </div>
        <CompanionsMenu
          tripId={trip.id}
          companions={payload.companions}
          labels={labels.companions}
        />
      </header>

      <TripDetailTabs
        trip={trip}
        cities={payload.cities}
        companions={payload.companions}
        lang={lang}
        labels={labels}
      />
    </div>
  );
}
