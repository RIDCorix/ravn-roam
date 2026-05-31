import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Map, Sparkles } from "lucide-react";

import { getDictionary, hasLocale } from "../../../dictionaries";
import { findRegionBySlug } from "@/lib/storefront-regions";
import {
  buildPlansHref,
  loadRegionEvents,
  timelineBackgroundForRegion,
} from "@/lib/storefront-region-events";
import { formatTemplate } from "@/lib/text-template";
import { RegionEventCard } from "@/components/storefront/shop/region-detail/event-card";
import { EventTimeline } from "@/components/storefront/shop/region-detail/event-timeline";
import { RegionHero } from "@/components/storefront/shop/region-detail/hero";
import { buildEventTimeline } from "@/components/storefront/shop/region-detail/timeline-data";
import type { LocaleKey } from "@/components/storefront/shop/region-detail/date";

export const dynamic = "force-dynamic";

export default async function ShopRegionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, region: regionSlug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const detail = dict.storefront.shop.region_detail;
  const region = findRegionBySlug(regionSlug);
  if (!region) notFound();

  const localeKey: LocaleKey = lang === "en" ? "en" : "zh-TW";
  const sp = await searchParams;
  const plansHref = buildPlansHref(lang, region, sp);
  const destination = region.name[localeKey];
  const planTripHref = `/${lang}/trips?destination=${encodeURIComponent(destination)}`;
  const events = await loadRegionEvents(region.slug);
  const timeline = buildEventTimeline(events, localeKey, detail.event_types);
  const timelineBackgroundSrc = timelineBackgroundForRegion(region.slug);

  return (
    <div className="min-h-full pb-28">
      <RegionHero
        region={region}
        lang={lang}
        localeKey={localeKey}
        labels={detail}
        plansHref={plansHref}
        planTripHref={planTripHref}
      />

      <main className="space-y-6 px-5 pt-5">
        <section id="events" className="scroll-mt-6 space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
                {detail.events_title}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                {formatTemplate(detail.events_subtitle, {
                  region: region.name[localeKey],
                })}
              </p>
            </div>
            <span className="text-[11px] text-fg-muted tabular-nums">
              {events.length}
            </span>
          </div>

          {events.length > 0 ? (
            <>
              <EventTimeline
                item={timeline}
                labels={detail}
                backgroundSrc={timelineBackgroundSrc}
              />
              <div className="flex items-end justify-between gap-3 px-1 pt-2">
                <div>
                  <div className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.015em] text-fg">
                    {detail.featured_events_title}
                    <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-fg-muted">
                    {detail.featured_events_subtitle}
                  </p>
                </div>
              </div>
              <div
                className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={detail.featured_events_title}
              >
                {events.map((event) => (
                  <RegionEventCard
                    key={event.id}
                    event={event}
                    regionCover={region.cover}
                    regionName={region.name[localeKey]}
                    localeKey={localeKey}
                    labels={detail}
                    planTripHref={planTripHref}
                  />
                ))}
              </div>
              <Link
                href={planTripHref}
                className="mx-auto flex max-w-[720px] items-center gap-3 rounded-2xl border border-divider bg-surface px-4 py-3 text-fg shadow-xs transition-colors hover:bg-surface-hover"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Map className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">
                    {detail.trip_prompt_title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">
                    {detail.trip_prompt_body}
                  </span>
                </span>
                <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-white">
                  {detail.plan_trip_cta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </>
          ) : (
            <div
              className="rounded-2xl bg-surface px-4 py-5 text-[13px] leading-relaxed text-fg-muted"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              {detail.events_empty}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
