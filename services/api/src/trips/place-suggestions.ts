import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { geocodeCities } from "../geocode/nominatim.js";
import {
  hasGooglePlacesKey,
  searchGooglePlaceSuggestions,
} from "../geocode/google-places.js";
import type { TripPlaceSuggestion } from "../db/schema/trip.js";

const activeTripSuggestionJobs = new Set<string>();

export function scheduleTripPlaceSuggestionRefresh(tripId: string): void {
  if (!tripId || activeTripSuggestionJobs.has(tripId)) return;
  activeTripSuggestionJobs.add(tripId);
  setTimeout(() => {
    void refreshTripPlaceSuggestions(tripId).finally(() => {
      activeTripSuggestionJobs.delete(tripId);
    });
  }, 0);
}

export async function refreshTripPlaceSuggestions(tripId: string): Promise<void> {
  if (!hasGooglePlacesKey()) return;
  const db = getDb();
  const rows = await db
    .select({
      stop: schema.tripDayStop,
      day: schema.tripDay,
    })
    .from(schema.tripDayStop)
    .innerJoin(schema.tripDay, eq(schema.tripDayStop.dayId, schema.tripDay.id))
    .where(
      and(
        eq(schema.tripDay.tripId, tripId),
        inArray(schema.tripDayStop.anchorMode, ["regional", "suggested_places"]),
      ),
    );

  for (const { stop, day } of rows) {
    const existing = normalizePlaceSuggestions(stop.placeSuggestions);
    if (existing.length > 0 && stop.suggestionsStatus === "resolved") continue;

    const searchQuery = stop.searchQuery?.trim() || stop.name.trim();
    if (!searchQuery) continue;

    await db
      .update(schema.tripDayStop)
      .set({ anchorMode: "regional", suggestionsStatus: "searching" })
      .where(eq(schema.tripDayStop.id, stop.id));

    try {
      const cityName = day.cities[0] ?? day.city;
      const [city] = await geocodeCities([cityName], { fetchMisses: true });
      const expectedCountry =
        stop.countryCode?.trim().toLowerCase() ??
        city?.country_code ??
        null;
      const suggestions = await searchGooglePlaceSuggestions(searchQuery, {
        area: stop.areaName,
        city: cityName,
        expectedCountry,
        center: city ? { lat: city.lat, lng: city.lng } : null,
        placeTypes: stop.placeTypes,
        maxResultCount: stop.suggestionCount,
        maxDistanceMeters: 75_000,
      });
      const normalized = suggestions.map(
        (place, index): TripPlaceSuggestion => ({
          id:
            place.place_id ??
            `${stop.id}:${index}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}`,
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          lat: place.lat,
          lng: place.lng,
          primary_type: place.primary_type ?? null,
          types: place.types ?? [],
          rating: place.rating ?? null,
          user_rating_count: place.user_rating_count ?? null,
          maps_url: place.maps_url ?? null,
        }),
      );
      await db
        .update(schema.tripDayStop)
        .set({
          placeSuggestions: normalized,
          suggestionsStatus: normalized.length > 0 ? "resolved" : "empty",
        })
        .where(eq(schema.tripDayStop.id, stop.id));
    } catch {
      await db
        .update(schema.tripDayStop)
        .set({ suggestionsStatus: "error" })
        .where(eq(schema.tripDayStop.id, stop.id));
    }
  }
}

export function normalizePlaceSuggestions(value: unknown): TripPlaceSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const lat = typeof record.lat === "number" ? record.lat : Number.NaN;
    const lng = typeof record.lng === "number" ? record.lng : Number.NaN;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : `${name}:${lat}:${lng}`,
      place_id:
        typeof record.place_id === "string" && record.place_id.trim()
          ? record.place_id.trim()
          : null,
      name,
      address: typeof record.address === "string" ? record.address : null,
      lat,
      lng,
      primary_type:
        typeof record.primary_type === "string" ? record.primary_type : null,
      types: Array.isArray(record.types)
        ? record.types.filter((type): type is string => typeof type === "string")
        : [],
      rating: typeof record.rating === "number" ? record.rating : null,
      user_rating_count:
        typeof record.user_rating_count === "number"
          ? record.user_rating_count
          : null,
      maps_url: typeof record.maps_url === "string" ? record.maps_url : null,
      selected: record.selected === true,
    }];
  });
}
