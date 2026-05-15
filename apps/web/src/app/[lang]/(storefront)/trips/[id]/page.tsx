import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  TripDetailTabs,
  type TripDetailLabels,
} from "@/components/storefront/trips/trip-detail-tabs";
import { TRIPS } from "@/lib/mock/consumer";

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
  const t = dict.storefront.trips;

  const trip = TRIPS.find((candidate) => candidate.id === id);
  if (!trip) {
    return <TripNotFound lang={lang} title={t.detail.not_found} back={t.detail.back} />;
  }

  const labels: TripDetailLabels = {
    tabs: {
      overview: t.tabs.overview,
      checklist: t.tabs.checklist,
    },
    timelineSection: t.detail.timeline_section,
    todayBadge: t.detail.today,
    dayWord: t.detail.day_word,
    checklistGroups: {
      suggested: t.checklist.suggested,
      pending: t.checklist.pending,
      done: t.checklist.done,
    },
    shopCta: t.checklist.shop_cta,
    emptyChecklist: t.checklist.empty,
  };

  return (
    <div>
      <header
        className="sticky top-0 z-10 flex items-center gap-2.5 px-5 py-3.5 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "rgba(247,247,245,0.85)" }}
      >
        <Link
          href={`/${lang}/trips`}
          aria-label={t.detail.back}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-semibold tracking-[-0.015em]">
            {trip.title}
          </h1>
          <div className="whitespace-nowrap text-[12px] text-fg-muted">
            {trip.start} → {trip.end}
            {trip.days.length > 0
              ? ` · ${trip.days.length} ${t.detail.day_unit}`
              : ""}
          </div>
        </div>
      </header>

      <TripDetailTabs trip={trip} lang={lang} labels={labels} />
    </div>
  );
}

function TripNotFound({
  lang,
  title,
  back,
}: {
  lang: string;
  title: string;
  back: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-[16px] text-fg-muted">{title}</div>
      <Link
        href={`/${lang}/trips`}
        className="rounded-[10px] bg-fg px-4 py-2 text-[13px] font-semibold text-white"
      >
        {back}
      </Link>
    </div>
  );
}
