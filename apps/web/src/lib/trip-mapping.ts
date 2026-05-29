// Adapter: API shapes (snake_case, separate day/checklist arrays) → the
// `Trip` UI shape the storefront components already render. Lets us swap
// data sources without rewriting trip-card, daily-timeline, etc.

import type { ChecklistItem, Trip, TripStop } from "@/lib/mock/consumer";
import type {
  ApiChecklistItem,
  ApiTrip,
  ApiTripDay,
  ApiTripStop,
  TripDetailPayload,
} from "@/lib/trips-api";

export function apiToTrip(
  trip: ApiTrip,
  days: ApiTripDay[] = [],
  checklist: ApiChecklistItem[] = [],
): Trip {
  const summaryDays =
    days.length === 0 && trip.days_count
      ? Array.from({ length: trip.days_count }, (_, i) => ({
          d: i === 0 ? trip.start_date : "",
          city: trip.cities?.[i] ?? "",
          note: "",
          stops: [],
        }))
      : [];
  const summaryChecklist =
    checklist.length === 0 && trip.checklist_total
      ? Array.from({ length: trip.checklist_total }, (_, i) => ({
          id: `summary-${trip.id}-${i}`,
          text: "",
          done: i < (trip.checklist_done ?? 0),
          kind: "doc" as const,
        }))
      : [];
  return {
    id: trip.id,
    title: trip.title,
    cover: trip.cover ?? coverFromTitle(trip.title),
    start: trip.start_date,
    end: trip.end_date,
    status: trip.status === "cancelled" ? "past" : trip.status,
    metadata: trip.metadata ?? {},
    days: days.length > 0 ? [...days]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => ({
        d: d.day_date,
        city: d.city,
        note: d.note,
        stops: (d.stops ?? []).map(apiToStop),
      })) : summaryDays,
    checklist:
      checklist.length > 0 ? checklist.map(apiToChecklist) : summaryChecklist,
  };
}

function apiToStop(s: ApiTripStop): TripStop {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    arrival_time: s.arrival_time,
    duration_min: s.duration_min,
    note: s.note,
    attachments: s.attachments.map((a) => ({
      id: a.id,
      type: a.type,
      label: a.label,
      url: a.url,
      amount: a.amount,
      actionLabel: a.action_label,
      checklistItemId: a.checklist_item_id,
      checklistText: a.checklist_text,
      checklistKind: a.checklist_kind,
      imageName: a.image_name,
      imageDataUrl: a.image_data_url,
      status: a.status,
      done: a.done,
    })),
    lat: s.lat,
    lng: s.lng,
  };
}

export function apiDetailToTrip(payload: TripDetailPayload): Trip {
  return apiToTrip(payload.trip, payload.days, payload.checklist);
}

function apiToChecklist(item: ApiChecklistItem): ChecklistItem {
  return {
    id: item.id,
    text: item.text,
    description: item.description ?? null,
    done: item.done,
    kind: item.kind as ChecklistItem["kind"],
    start: item.start_date ?? null,
    phase: item.phase ?? null,
    groupLabel: item.group_label ?? null,
    subtasks: (item.subtasks ?? []).map((subtask) => ({
      text: subtask.text,
      done: subtask.done,
      imageName: subtask.image_name ?? null,
      imageDataUrl: subtask.image_data_url ?? null,
    })),
    shortcut: (item.shortcut ?? undefined) as ChecklistItem["shortcut"],
    shopFilter: (item.shop_filter ?? undefined) as ChecklistItem["shopFilter"],
    esimOrder: item.esim_order
      ? {
          orderId: item.esim_order.order_id,
          orderNumber: item.esim_order.order_number,
          status: item.esim_order.status,
          profileCount: item.esim_order.profile_count,
          assignedCount: item.esim_order.assigned_count,
        }
      : null,
    due: item.due_date ?? undefined,
    suggested: item.suggested,
    suggestedBy:
      (item.suggested_by ?? undefined) as ChecklistItem["suggestedBy"],
    assignedCompanionId: item.assigned_companion_id ?? null,
  };
}

function coverFromTitle(title: string): string {
  // Match the look of the design's mock data — a tiny country/region tag.
  const tag = title
    .match(/[A-Za-z]+/g)
    ?.join("")
    .slice(0, 2)
    .toUpperCase();
  return tag && tag.length >= 2 ? tag : title.slice(0, 2);
}
