import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../dictionaries";
import { buildPlannerFixtureTrip } from "./fixture-trip";
import { TripPlannerFixture } from "./fixture";

export default async function TripPlannerDevPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
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
