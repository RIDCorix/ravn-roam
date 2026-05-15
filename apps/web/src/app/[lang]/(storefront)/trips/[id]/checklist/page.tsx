import { notFound } from "next/navigation";

import { ChecklistView } from "@/components/storefront/trips/checklist-view";
import { TRIPS } from "@/lib/mock/consumer";

import { getDictionary, hasLocale } from "../../../../dictionaries";

export const dynamic = "force-dynamic";

export default async function TripChecklistPage({
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
    <ChecklistView
      items={trip.checklist}
      lang={lang}
      labels={{
        groups: {
          suggested: t.checklist.suggested,
          pending: t.checklist.pending,
          done: t.checklist.done,
        },
        shopCta: t.checklist.shop_cta,
        empty: t.checklist.empty,
      }}
    />
  );
}
