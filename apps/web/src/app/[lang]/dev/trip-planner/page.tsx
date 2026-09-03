import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../dictionaries";
import { UAT_FIXTURE_ROBOTS, uatFixtureEnabled } from "../uat-fixture-access";
import { buildPlannerFixtureTrip } from "./fixture-trip";
import { TripPlannerFixture } from "./fixture";

// Reachable by URL for UAT, never indexed. See `uat-fixture-access.ts` for why
// this fixture — and only this one — survives a production build.
export const metadata: Metadata = {
  title: "Trip planner — UAT fixture",
  robots: UAT_FIXTURE_ROBOTS,
};

// Rendered per request, not prerendered. `StorefrontShell` reads
// `useSearchParams()` to carry the query string across navigation, and under
// static generation that is a hard CSR-bailout error. The storefront routes
// never hit it because Supabase makes them dynamic; this fixture has no
// backend, so it would otherwise be prerendered and fail the build. Rendering
// per request also means UAT gets complete HTML with the navigation already in
// it — no Suspense fallback swap under the sheet mid-gesture.
export const dynamic = "force-dynamic";

export default async function TripPlannerDevPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (!uatFixtureEnabled()) notFound();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <TripPlannerFixture
      lang={lang}
      trip={buildPlannerFixtureTrip(lang)}
      navLabels={dict.storefront.nav}
      signInLabel={dict.storefront.login.sign_in}
      plannerLabels={dict.storefront.trips.planner}
    />
  );
}
