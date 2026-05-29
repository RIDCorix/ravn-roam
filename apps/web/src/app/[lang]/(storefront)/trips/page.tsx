import { notFound } from "next/navigation";

import { TripsListClient } from "@/components/storefront/trips/trips-list-client";

import { getDictionary, hasLocale } from "../../dictionaries";

// Keep the route per-request for auth-aware shell rendering, but do not
// block navigation on itinerary data. The client paints skeleton rows and
// hydrates from /api/storefront/trips.
export const dynamic = "force-dynamic";

export default async function TripsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.trips;

  return (
    <TripsListClient
      lang={lang}
      labels={{
        title: t.list.title,
        subtitle: t.list.subtitle,
        empty: t.list.empty,
        groups: t.groups,
        card: t.card,
        create: t.create,
      }}
    />
  );
}
