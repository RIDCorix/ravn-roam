import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { TripDetailClient } from "@/components/storefront/trips/trip-detail-client";
import { buildTripDetailLabels } from "@/components/storefront/trips/trip-detail-labels";

import { getDictionary, hasLocale } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/${lang}/login?next=${encodeURIComponent(`/${lang}/trips/${id}`)}`,
    );
  }

  return (
    <TripDetailClient
      tripId={id}
      lang={lang}
      labels={buildTripDetailLabels(dict.storefront)}
    />
  );
}
