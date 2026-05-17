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
  return {
    id: trip.id,
    title: trip.title,
    cover: trip.cover ?? coverFromTitle(trip.title),
    start: trip.start_date,
    end: trip.end_date,
    status: trip.status === "cancelled" ? "past" : trip.status,
    days: [...days]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => ({
        d: d.day_date,
        city: d.city,
        note: d.note,
        stops: (d.stops ?? []).map(apiToStop),
      })),
    checklist: checklist.map(apiToChecklist),
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
    done: item.done,
    kind: item.kind as ChecklistItem["kind"],
    shortcut: (item.shortcut ?? undefined) as ChecklistItem["shortcut"],
    shopFilter: (item.shop_filter ?? undefined) as ChecklistItem["shopFilter"],
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
