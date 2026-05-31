import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { TripDetailClient } from "@/components/storefront/trips/trip-detail-client";
import type { TripDetailClientLabels } from "@/components/storefront/trips/trip-detail-client";

import { getDictionary, hasLocale } from "../../../dictionaries";

// Do not block route entry on the trip payload. The client renders a
// skeleton immediately, then hydrates the itinerary via SWR.
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/${lang}/login?next=${encodeURIComponent(`/${lang}/trips/${id}`)}`,
    );
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
    checklistFilters: {
      all: t.checklist.filter_all,
      mine: t.checklist.filter_mine,
    },
    shopCta: t.checklist.shop_cta,
    esimOrderLabels: {
      pending: t.checklist.esim_order_pending,
      ready: t.checklist.esim_order_ready,
      shared: t.checklist.esim_order_shared,
    },
    esimShareLabels: {
      title: t.checklist.esim_share_title,
      description: t.checklist.esim_share_description,
      cta: t.checklist.esim_share_cta,
      sharing: t.checklist.esim_share_sharing,
      shared: t.checklist.esim_share_shared,
      empty: t.checklist.esim_share_empty,
      error: t.checklist.esim_share_error,
    },
    emptyChecklist: t.checklist.empty,
    assigneeLabels: {
      assign: t.checklist.assign,
      assigned_to: t.checklist.assigned_to,
      unassigned: t.checklist.unassigned,
    },
    quickInfo: {
      title: t.quick_info.title,
      ready: t.quick_info.ready,
      prepare: t.quick_info.prepare,
      view: t.quick_info.view,
      empty: t.quick_info.empty,
      source_task: t.quick_info.source_task,
      install_esim_cta: t.quick_info.install_esim_cta,
      install_esim: t.quick_info.install_esim,
      copy_activation_code: t.quick_info.copy_activation_code,
      copied: t.quick_info.copied,
      open_qr_code: t.quick_info.open_qr_code,
    },
    back: t.detail.back,
    dayUnit: t.detail.day_unit,
    settings: {
      title: t.settings.title,
      aria: t.settings.aria,
      trip_section: t.settings.trip_section,
      delete_trip: t.settings.delete_trip,
      delete_confirm: t.settings.delete_confirm,
      delete_cancel: t.settings.delete_cancel,
      deleting: t.settings.deleting,
      delete_error: t.settings.delete_error,
    },
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
    notFound: t.detail.not_found,
  };

  return (
    <TripDetailClient
      tripId={id}
      lang={lang}
      labels={labels}
    />
  );
}
