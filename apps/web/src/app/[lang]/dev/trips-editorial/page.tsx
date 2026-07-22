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
  if (process.env.NODE_ENV === "production") notFound();
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
