import { notFound } from "next/navigation";

import { DailyTimeline } from "@/components/storefront/trips/daily-timeline";
import { TRIPS } from "@/lib/mock/consumer";

import { getDictionary, hasLocale } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const trip = TRIPS.find((candidate) => candidate.id === id);
  if (!trip) return null;

  const dict = await getDictionary(lang);
  const t = dict.storefront.trips;

  return (
    <DailyTimeline
      trip={trip}
      sectionLabel={t.detail.timeline_section}
      todayLabel={t.detail.today}
      dayLabelTemplate={t.detail.day_label}
    />
  );
}
