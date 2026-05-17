import Link from "next/link";
import { notFound } from "next/navigation";

import { TripDetailClient } from "@/components/storefront/trips/trip-detail-client";
import type { TripDetailClientLabels } from "@/components/storefront/trips/trip-detail-client";
import { getTrip, TripApiError } from "@/lib/trips-api";

import { getDictionary, hasLocale } from "../../../dictionaries";

// Auth gate + initial RSC paint only — every interaction after first
// load reads from the SWR cache on the client (see TripDetailClient).
// `force-dynamic` so the auth check + Bearer-forwarded fetch stay
// per-request; static caching is meaningless for a user's own trips.
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

  let initialPayload;
  try {
    initialPayload = await getTrip(id);
  } catch (err) {
    if (err instanceof TripApiError && err.status === 404) {
      return (
        <TripNotFound lang={lang} title={t.detail.not_found} back={t.detail.back} />
      );
    }
    throw err;
  }

  const labels: TripDetailClientLabels = {
    tabs: {
      overview: t.tabs.overview,
      checklist: t.tabs.checklist,
      day_short: t.tabs.day_short,
    },
    timelineSection: t.detail.timeline_section,
    todayBadge: t.detail.today,
    dayLabelTemplate: t.detail.day_label,
    checklistGroups: {
      suggested: t.checklist.suggested,
      pending: t.checklist.pending,
      done: t.checklist.done,
    },
    shopCta: t.checklist.shop_cta,
    emptyChecklist: t.checklist.empty,
    assigneeLabels: {
      assign: t.checklist.assign,
      assigned_to: t.checklist.assigned_to,
      unassigned: t.checklist.unassigned,
    },
    back: t.detail.back,
    dayUnit: t.detail.day_unit,
    companions: {
      manage_title: t.companions.manage_title,
      manage_aria: t.companions.manage_aria,
      add: t.companions.add,
      rename_placeholder: t.companions.rename_placeholder,
      copy_invite: t.companions.copy_invite,
      copied: t.companions.copied,
      link_only: t.companions.link_only,
      joined: t.companions.joined,
      delete: t.companions.delete,
      pick_friend: t.companions.pick_friend,
      pick_friend_soon: t.companions.pick_friend_soon,
    },
  };

  return (
    <TripDetailClient
      tripId={id}
      lang={lang}
      initialPayload={initialPayload}
      labels={labels}
    />
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
