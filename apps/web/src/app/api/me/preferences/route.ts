import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

type UserHomePlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
};

type UserDeparturePlace = UserHomePlace & {
  id: string;
};

const HOME_PLACE_METADATA_KEY = "roam_home_place";
const DEPARTURE_PLACES_METADATA_KEY = "roam_departure_places";
const SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY = "roam_selected_departure_place_id";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const homePlace = normalizeHomePlace(user.user_metadata?.[HOME_PLACE_METADATA_KEY]);
  const departurePlaces = normalizeDeparturePlaces(
    user.user_metadata?.[DEPARTURE_PLACES_METADATA_KEY],
    homePlace,
  );
  const selectedDeparturePlaceId =
    normalizeSelectedDeparturePlaceId(
      user.user_metadata?.[SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY],
      departurePlaces,
    ) ?? departurePlaces[0]?.id ?? null;
  return NextResponse.json({
    home_place: homePlace,
    departure_places: departurePlaces,
    selected_departure_place_id: selectedDeparturePlaceId,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as {
    home_place?: unknown;
    departure_places?: unknown;
    selected_departure_place_id?: unknown;
  };
  const currentHomePlace = normalizeHomePlace(
    user.user_metadata?.[HOME_PLACE_METADATA_KEY],
  );
  const currentDeparturePlaces = normalizeDeparturePlaces(
    user.user_metadata?.[DEPARTURE_PLACES_METADATA_KEY],
    currentHomePlace,
  );
  const hasHomePlaceInput = Object.prototype.hasOwnProperty.call(input, "home_place");
  const hasDeparturePlacesInput = Object.prototype.hasOwnProperty.call(
    input,
    "departure_places",
  );
  const hasSelectedDepartureInput = Object.prototype.hasOwnProperty.call(
    input,
    "selected_departure_place_id",
  );
  const homePlace =
    !hasHomePlaceInput || input.home_place == null
      ? null
      : normalizeHomePlace(input.home_place);
  if (hasHomePlaceInput && input.home_place != null && !homePlace) {
    return NextResponse.json({ error: "invalid_home_place" }, { status: 400 });
  }

  let departurePlaces = currentDeparturePlaces;
  if (hasDeparturePlacesInput) {
    const normalized = normalizeDeparturePlaces(input.departure_places, null);
    if (!Array.isArray(input.departure_places)) {
      return NextResponse.json(
        { error: "invalid_departure_places" },
        { status: 400 },
      );
    }
    departurePlaces = normalized;
  }
  if (hasHomePlaceInput && homePlace) {
    departurePlaces = upsertDeparturePlace(
      departurePlaces,
      homePlaceToDeparturePlace(homePlace),
    );
  }
  const selectedDeparturePlaceId = hasSelectedDepartureInput
    ? typeof input.selected_departure_place_id === "string"
      ? input.selected_departure_place_id
      : null
    : normalizeSelectedDeparturePlaceId(
        user.user_metadata?.[SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY],
        departurePlaces,
      );
  const normalizedSelectedDeparturePlaceId =
    normalizeSelectedDeparturePlaceId(selectedDeparturePlaceId, departurePlaces) ??
    departurePlaces[0]?.id ??
    null;

  const nextMetadata = { ...(user.user_metadata ?? {}) };
  if (hasHomePlaceInput && homePlace) {
    nextMetadata[HOME_PLACE_METADATA_KEY] = homePlace;
  } else if (hasHomePlaceInput) {
    delete nextMetadata[HOME_PLACE_METADATA_KEY];
  }
  if (departurePlaces.length > 0) {
    nextMetadata[DEPARTURE_PLACES_METADATA_KEY] = departurePlaces;
    nextMetadata[SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY] =
      normalizedSelectedDeparturePlaceId;
  } else {
    delete nextMetadata[DEPARTURE_PLACES_METADATA_KEY];
    delete nextMetadata[SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY];
  }

  const { data, error } = await supabase.auth.updateUser({
    data: nextMetadata,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    home_place: normalizeHomePlace(
      data.user?.user_metadata?.[HOME_PLACE_METADATA_KEY] ??
        (hasHomePlaceInput ? homePlace : currentHomePlace),
    ),
    departure_places: normalizeDeparturePlaces(
      data.user?.user_metadata?.[DEPARTURE_PLACES_METADATA_KEY] ?? departurePlaces,
      null,
    ),
    selected_departure_place_id:
      normalizeSelectedDeparturePlaceId(
        data.user?.user_metadata?.[SELECTED_DEPARTURE_PLACE_ID_METADATA_KEY] ??
          normalizedSelectedDeparturePlaceId,
        departurePlaces,
      ) ?? departurePlaces[0]?.id ?? null,
  });
}

function normalizeHomePlace(value: unknown): UserHomePlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const address =
    typeof record.address === "string" ? record.address.trim() : "";
  const lat = typeof record.lat === "number" ? record.lat : Number.NaN;
  const lng = typeof record.lng === "number" ? record.lng : Number.NaN;
  const placeId =
    typeof record.placeId === "string" && record.placeId.trim()
      ? record.placeId.trim()
      : null;
  if (!name || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { name, address, lat, lng, placeId };
}

function normalizeDeparturePlaces(
  value: unknown,
  fallbackHomePlace: UserHomePlace | null,
): UserDeparturePlace[] {
  const places = Array.isArray(value)
    ? value.flatMap((item) => {
        const place = normalizeDeparturePlace(item);
        return place ? [place] : [];
      })
    : [];
  const withFallback =
    places.length === 0 && fallbackHomePlace
      ? [homePlaceToDeparturePlace(fallbackHomePlace)]
      : places;
  return dedupeDeparturePlaces(withFallback);
}

function normalizeDeparturePlace(value: unknown): UserDeparturePlace | null {
  if (!value || typeof value !== "object") return null;
  const homePlace = normalizeHomePlace(value);
  if (!homePlace) return null;
  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : departurePlaceId(homePlace);
  return { id, ...homePlace };
}

function homePlaceToDeparturePlace(homePlace: UserHomePlace): UserDeparturePlace {
  return { id: departurePlaceId(homePlace), ...homePlace };
}

function upsertDeparturePlace(
  places: UserDeparturePlace[],
  place: UserDeparturePlace,
): UserDeparturePlace[] {
  return dedupeDeparturePlaces([
    place,
    ...places.filter((current) => current.id !== place.id),
  ]);
}

function dedupeDeparturePlaces(
  places: UserDeparturePlace[],
): UserDeparturePlace[] {
  const seen = new Set<string>();
  const result: UserDeparturePlace[] = [];
  for (const place of places) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    result.push(place);
  }
  return result.slice(0, 12);
}

function normalizeSelectedDeparturePlaceId(
  value: unknown,
  places: UserDeparturePlace[],
): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id) return null;
  return places.some((place) => place.id === id) ? id : null;
}

function departurePlaceId(place: UserHomePlace): string {
  const stable = place.placeId ?? `${place.name}:${place.address}:${place.lat}:${place.lng}`;
  return `departure:${stable.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
