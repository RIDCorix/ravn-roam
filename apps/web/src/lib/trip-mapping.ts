// Adapter: API shapes (snake_case, separate day/checklist arrays) → the
// `Trip` UI shape the storefront components already render. Lets us swap
// data sources without rewriting trip-card, daily-timeline, etc.

import type {
  ApiChecklistItem,
  ApiTrip,
  ApiTripDay,
  ApiTripStop,
  TripDetailPayload,
} from "@/lib/trips-api";
import {
  normalizeTripStopAnchorMode,
  type ChecklistItem,
  type Trip,
  type TripStop,
} from "@/lib/trip-types";

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
        cities: trip.cities?.[i] ? [trip.cities[i]!] : [],
        segments: trip.cities?.[i]
          ? [defaultDaySegment(trip.cities[i]!)]
          : [],
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
        cities: d.cities?.length ? d.cities : [d.city].filter(Boolean),
        segments: normalizeDaySegments(
          d.segments,
          d.cities?.length ? d.cities : [d.city].filter(Boolean),
        ),
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
    anchorMode: normalizeTripStopAnchorMode(s.anchor_mode),
    placeName: s.place_name,
    placeId: s.place_id,
    placeAddress: s.place_address,
    areaName: s.area_name,
    searchQuery: s.search_query,
    countryCode: s.country_code,
    placeTypes: s.place_types,
    suggestionCount: s.suggestion_count,
    placeSuggestions: s.place_suggestions.map((suggestion) => ({
      id: suggestion.id,
      placeId: suggestion.place_id,
      name: suggestion.name,
      address: suggestion.address,
      lat: suggestion.lat,
      lng: suggestion.lng,
      primaryType: suggestion.primary_type,
      types: suggestion.types,
      rating: suggestion.rating,
      userRatingCount: suggestion.user_rating_count,
      mapsUrl: suggestion.maps_url,
      selected: suggestion.selected ?? false,
    })),
    suggestionsStatus: s.suggestions_status,
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

function defaultDaySegment(city: string) {
  return {
    city,
    start_part: "full_day" as const,
    end_part: "full_day" as const,
    note: "",
  };
}

function normalizeDaySegments(
  segments: ApiTripDay["segments"] | undefined,
  cities: string[],
): ApiTripDay["segments"] {
  const normalized = (segments ?? [])
    .map((segment) => ({
      city: segment.city.trim(),
      start_part: segment.start_part,
      end_part: segment.end_part,
      note: segment.note ?? "",
    }))
    .filter((segment) => segment.city);
  if (normalized.length > 0) return normalized;
  return cities.filter(Boolean).map(defaultDaySegment);
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
