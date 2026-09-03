import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../dictionaries";
import { findRegionBySlug } from "@/lib/storefront-regions";
import {
  addableEventRegionsForRegion,
  loadRegionEvents,
  timelineBackgroundForRegion,
} from "@/lib/storefront-region-events";
import { formatTemplate } from "@/lib/text-template";
import { RegionEventsSection } from "@/components/storefront/shop/region-detail/events-section";
import { RegionHero } from "@/components/storefront/shop/region-detail/hero";
import type { LocaleKey } from "@/components/storefront/shop/region-detail/date";

export const dynamic = "force-dynamic";

export default async function ShopRegionDetailPage({
  params,
}: {
  params: Promise<{ lang: string; region: string }>;
}) {
  const { lang, region: regionSlug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const detail = dict.storefront.shop.region_detail;
  const region = findRegionBySlug(regionSlug);
  if (!region) notFound();

  const localeKey: LocaleKey = lang === "en" ? "en" : "zh-TW";
  const destination = region.name[localeKey];
  const planTripHref = `/${lang}/trips?destination=${encodeURIComponent(destination)}`;
  const events = await loadRegionEvents(region);
  const addableEventRegions = addableEventRegionsForRegion(region).map(
    (candidate) => ({
      slug: candidate.slug,
      name: candidate.name,
    }),
  );
  const timelineBackgroundSrc = timelineBackgroundForRegion(region.slug);
  const eventLabels = {
    ...detail,
    events_subtitle: formatTemplate(detail.events_subtitle, {
      region: region.name[localeKey],
    }),
  };

  return (
    <div className="min-h-full pb-28">
      <RegionHero
        region={region}
        lang={lang}
        localeKey={localeKey}
        labels={detail}
        planTripHref={planTripHref}
      />

      <main className="space-y-6 px-5 pt-5">
        <RegionEventsSection
          events={events}
          baseRegionSlug={region.slug}
          addableRegions={addableEventRegions}
          labels={eventLabels}
          localeKey={localeKey}
          regionName={region.name[localeKey]}
          regionCover={region.cover}
          timelineBackgroundSrc={timelineBackgroundSrc}
          planTripHref={planTripHref}
        />
      </main>
    </div>
  );
}
