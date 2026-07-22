"use client";

// Client data wrapper for the trip planning workspace. The route remains
// backend-backed through useTripDetail; this component only chooses between
// loading, not-found, and the redesigned planning surface.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import {
  TripPlanningWorkspace,
  type TripPlanningLabels,
} from "@/components/storefront/trips/trip-planning-workspace";
import { Button } from "@/components/ui/button";
import { apiDetailToTrip } from "@/lib/trip-mapping";
import { useTripDetail } from "@/lib/trip-cache";
import type { TripDetailPayload } from "@/lib/trips-api";

export interface TripDetailClientLabels {
  back: string;
  planning: TripPlanningLabels;
  notFound: string;
}

export function TripDetailClient({
  tripId,
  lang,
  initialPayload,
  labels,
}: {
  tripId: string;
  lang: string;
  initialPayload?: TripDetailPayload;
  labels: TripDetailClientLabels;
}) {
  const { data, error, isLoading } = useTripDetail(tripId, initialPayload);
  const payload = data ?? initialPayload;

  if (!payload) {
    return (
      <TripDetailSkeleton
        lang={lang}
        labels={labels}
        message={error ? labels.notFound : undefined}
        loading={isLoading}
      />
    );
  }

  return (
    <TripPlanningWorkspace
      trip={apiDetailToTrip(payload)}
      cities={payload.cities}
      companions={payload.companions}
      lang={lang}
      labels={labels.planning}
    />
  );
}

function TripDetailSkeleton({
  lang,
  labels,
  message,
  loading,
}: {
  lang: string;
  labels: TripDetailClientLabels;
  message?: string;
  loading: boolean;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfaf7_0%,#f6f3ed_100%)] px-5 pb-10 pt-28 text-fg sm:px-8">
      <div className="mx-auto max-w-[1540px]">
        <Link
          href={`/${lang}/trips`}
          className="mb-5 inline-flex items-center gap-1 text-[13px] font-semibold text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" />
          {labels.back}
        </Link>

        {message && !loading ? (
          <div className="mx-auto flex min-h-[52vh] max-w-[720px] flex-col items-center justify-center rounded-[28px] border border-divider bg-white p-8 text-center shadow-[0_24px_70px_-48px_rgba(32,41,46,0.55)]">
            <div className="text-[16px] text-fg-muted">{message}</div>
            <Button asChild className="mt-5 rounded-xl bg-fg text-white">
              <Link href={`/${lang}/trips`}>{labels.back}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid animate-pulse gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <main className="min-w-0">
              <div className="h-16 w-[420px] max-w-full rounded-3xl bg-white/70" />
              <div className="mt-5 h-[330px] rounded-[24px] bg-white/70" />
              <div className="mt-7 h-[360px] rounded-[24px] bg-white/70" />
            </main>
            <aside className="h-[720px] rounded-[28px] bg-white/70" />
          </div>
        )}
      </div>
    </div>
  );
}
