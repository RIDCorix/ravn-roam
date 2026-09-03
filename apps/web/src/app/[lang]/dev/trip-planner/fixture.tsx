"use client";

// c-1 asks for a fixture that composes the real bottom navigation with the
// planner, because a planner rendered on a bare page can only prove it does
// not overlap a navigation that was never on screen.

import { StorefrontShell } from "@/components/storefront/shell";
import type { StorefrontShellLabels } from "@/components/storefront/shell";
import { PlannerWorkspace } from "@/components/storefront/trips/planner/planner-workspace";
import type { PlannerLabels } from "@/components/storefront/trips/planner/planner-labels";
import type { PlannerTrip } from "@/components/storefront/trips/planner/planner-model";

export function TripPlannerFixture({
  lang,
  trip,
  navLabels,
  signInLabel,
  plannerLabels,
}: {
  lang: string;
  trip: PlannerTrip;
  navLabels: StorefrontShellLabels;
  signInLabel: string;
  plannerLabels: PlannerLabels;
}) {
  return (
    <StorefrontShell
      lang={lang}
      labels={navLabels}
      isSignedIn
      signInLabel={signInLabel}
      lumiLabels={null}
      fullBleed
    >
      <PlannerWorkspace lang={lang} trip={trip} labels={plannerLabels} />
    </StorefrontShell>
  );
}
