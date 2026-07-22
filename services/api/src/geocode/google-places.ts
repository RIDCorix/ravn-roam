import { env } from "../env.js";

export interface GooglePlaceResolution {
  name: string;
  lat: number;
  lng: number;
  place_id: string | null;
  formatted_address: string | null;
  country_code: string | null;
  primary_type?: string | null;
  types?: string[];
  rating?: number | null;
  user_rating_count?: number | null;
  maps_url?: string | null;
}

export interface ResolveGooglePlaceOptions {
  expectedCountry?: string | null;
  city?: string | null;
  center?: { lat: number; lng: number } | null;
  maxDistanceMeters?: number | null;
  fetchImpl?: typeof fetch;
}

export interface SearchGooglePlaceSuggestionsOptions extends ResolveGooglePlaceOptions {
  area?: string | null;
  placeTypes?: string[];
  maxResultCount?: number;
}

export function hasGooglePlacesKey(): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY);
}

export async function resolveGooglePlace(
  name: string,
  options: ResolveGooglePlaceOptions = {},
): Promise<GooglePlaceResolution | null> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const query = [name.trim(), options.city?.trim()].filter(Boolean).join(", ");
  if (!query) return null;

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 3,
    languageCode: "zh-TW",
  };
  const expectedCountry = options.expectedCountry?.trim().toUpperCase() ?? null;
  const maxDistanceMeters = options.maxDistanceMeters ?? 150_000;
  if (expectedCountry) body.regionCode = expectedCountry;
  if (options.center) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.center.lat,
          longitude: options.center.lng,
        },
        radius: 50_000,
      },
    };
  }

  const res = await (options.fetchImpl ?? fetch)(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: googlePlacesHeaders(
        apiKey,
        "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
      ),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as { places?: GooglePlaceApiRow[] };

  for (const place of json.places ?? []) {
    const normalized = normalizeGooglePlace(place);
    if (!normalized) continue;
    if (!googlePlaceFitsBounds(normalized, { expectedCountry, center: options.center, maxDistanceMeters })) continue;

    return {
      ...normalized,
      formatted_address: normalized.formatted_address,
    };
  }

  return null;
}

export async function searchGooglePlaceSuggestions(
  name: string,
  options: SearchGooglePlaceSuggestionsOptions = {},
): Promise<GooglePlaceResolution[]> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  const queryParts = [
    name.trim(),
    options.area?.trim(),
    options.city?.trim(),
  ].filter(Boolean);
  const query = queryParts.join(", ");
  if (!query) return [];

  const expectedCountry = options.expectedCountry?.trim().toUpperCase() ?? null;
  const maxDistanceMeters = options.maxDistanceMeters ?? 75_000;
  const maxResultCount = Math.max(
    1,
    Math.min(10, options.maxResultCount ?? 5),
  );
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount,
    languageCode: "zh-TW",
  };
  if (expectedCountry) body.regionCode = expectedCountry;
  if (options.center) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.center.lat,
          longitude: options.center.lng,
        },
        radius: 50_000,
      },
    };
  }

  const res = await (options.fetchImpl ?? fetch)(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: googlePlacesHeaders(
        apiKey,
        "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.primaryType,places.types,places.rating,places.userRatingCount,places.googleMapsUri",
      ),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) return [];

  const json = (await res.json()) as { places?: GooglePlaceApiRow[] };
  const desiredTypes = new Set(
    (options.placeTypes ?? [])
      .map((type) => type.trim().toLowerCase())
      .filter(Boolean),
  );
  const boundedSuggestions: GooglePlaceResolution[] = [];
  const typeMatchedSuggestions: GooglePlaceResolution[] = [];
  const seen = new Set<string>();
  for (const place of json.places ?? []) {
    const normalized = normalizeGooglePlace(place);
    if (!normalized) continue;
    if (!googlePlaceFitsBounds(normalized, { expectedCountry, center: options.center, maxDistanceMeters })) continue;
    const key = normalized.place_id ?? `${normalized.name}:${normalized.lat}:${normalized.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    boundedSuggestions.push(normalized);
    const placeTypes = [
      normalized.primary_type,
      ...(normalized.types ?? []),
    ].filter((type): type is string => Boolean(type));
    if (placeTypes.some((type) => desiredTypes.has(type.toLowerCase()))) {
      typeMatchedSuggestions.push(normalized);
    }
  }
  const suggestions =
    desiredTypes.size > 0 && typeMatchedSuggestions.length > 0
      ? typeMatchedSuggestions
      : boundedSuggestions;
  return suggestions.slice(0, maxResultCount);
}

type GooglePlaceApiRow = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    shortText?: string;
    types?: string[];
  }>;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

function normalizeGooglePlace(place: GooglePlaceApiRow): GooglePlaceResolution | null {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const countryCode =
    place.addressComponents
      ?.find((component) => component.types?.includes("country"))
      ?.shortText?.toLowerCase() ?? null;
  return {
    name: place.displayName?.text ?? place.formattedAddress ?? "Google Maps",
    lat: lat!,
    lng: lng!,
    place_id: place.id ?? null,
    formatted_address: place.formattedAddress ?? null,
    country_code: countryCode,
    primary_type: place.primaryType ?? null,
    types: place.types ?? [],
    rating: Number.isFinite(place.rating) ? place.rating! : null,
    user_rating_count: Number.isFinite(place.userRatingCount)
      ? place.userRatingCount!
      : null,
    maps_url: place.googleMapsUri ?? null,
  };
}

function googlePlaceFitsBounds(
  place: GooglePlaceResolution,
  options: {
    expectedCountry: string | null;
    center?: { lat: number; lng: number } | null;
    maxDistanceMeters: number;
  },
): boolean {
  if (
    options.expectedCountry &&
    place.country_code &&
    place.country_code !== options.expectedCountry.toLowerCase()
  ) {
    return false;
  }
  if (
    options.center &&
    options.maxDistanceMeters > 0 &&
    distanceMeters(options.center, place) > options.maxDistanceMeters
  ) {
    return false;
  }
  return true;
}

function googlePlacesHeaders(
  apiKey: string,
  fieldMask: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-goog-api-key": apiKey,
    "x-goog-fieldmask": fieldMask,
  };
  if (env.GOOGLE_MAPS_HTTP_REFERER) {
    headers.referer = env.GOOGLE_MAPS_HTTP_REFERER;
  }
  return headers;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radiusMeters = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusMeters * Math.asin(Math.sqrt(h));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
