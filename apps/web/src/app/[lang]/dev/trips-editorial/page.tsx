import { notFound } from "next/navigation";

import { buildTripDetailLabels } from "@/components/storefront/trips/trip-detail-labels";

import { getDictionary, hasLocale } from "../../dictionaries";
import { TripsEditorialFixture } from "./fixture";

export default async function TripsEditorialDevPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ view?: string; state?: string }>;
}) {
  // NODE_ENV alone cannot gate this. The oracle's visual gate (c-1) drives the
  // PRODUCTION build via `next start`, where NODE_ENV is "production" — so keying off
  // it made this fixture 404 for the one checker that needs it, while the acceptance
  // criterion read as if it were covered. The flag is opt-in and set only by
  // scripts/oracle/env.build, so a real deployment still has no dev routes.
  const devRoutesEnabled =
    process.env.NODE_ENV !== "production" || process.env.ROAM_ENABLE_DEV_ROUTES === "1";
  if (!devRoutesEnabled) notFound();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { view, state } = await searchParams;
  const dict = await getDictionary(lang);

  return (
    <TripsEditorialFixture
      lang={lang}
      view={view === "detail" ? "detail" : "list"}
      empty={state === "empty"}
      listLabels={dict.storefront.trips.local}
      detailLabels={buildTripDetailLabels(dict.storefront).planning}
    />
  );
}
