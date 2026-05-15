import { notFound } from "next/navigation";

import { LumiChat } from "@/components/storefront/lumi/lumi-chat";
import { TRIPS } from "@/lib/mock/consumer";

import { getDictionary, hasLocale } from "../../../../dictionaries";

export const dynamic = "force-dynamic";

export default async function TripLumiPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const trip = TRIPS.find((candidate) => candidate.id === id);
  if (!trip) return null;

  const dict = await getDictionary(lang);
  const t = dict.storefront.trips.lumi;

  return (
    <LumiChat
      trip={trip}
      lang={lang}
      greeting={t.greeting.replace("{title}", trip.title)}
      labels={{
        intro: t.intro.replace("{title}", trip.title),
        composerPlaceholder: t.composer_placeholder,
        suggestions: t.suggestions,
        errorPrefix: t.error_prefix,
        itineraryTitle: t.itinerary_title,
        esimCtaFallback: t.esim_cta_fallback,
      }}
    />
  );
}
