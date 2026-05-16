// Nominatim-backed geocoder with a DB cache. Every city the storefront
// ever asked about lives in `roam_poc.city_geocode`, so we hit OSM at
// most once per unique city name across the lifetime of the service.
//
// Nominatim usage policy reminders (https://operations.osmfoundation.org/
// policies/nominatim/):
//   * meaningful User-Agent — done below
//   * max 1 request per second  — enforced via a chained promise
//   * cache results aggressively — handled by city_geocode table
//
// Context-aware disambiguation: when geocoding a batch of city names from
// the same trip, we infer the dominant country from already-resolved
// names and constrain Nominatim with `countrycodes` for the rest. This
// stops generic words like 近郊 ("suburbs", JP) from mis-matching to a
// homograph place name in China.

import { eq, inArray } from "drizzle-orm";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";

export interface Geocoded {
  name: string;
  lat: number;
  lng: number;
  display_name: string | null;
  country_code: string | null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

let chain: Promise<unknown> = Promise.resolve();
// Serialize Nominatim calls so we never exceed 1 req/s, even when several
// trip pages render in parallel.
function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      const wait = 1000 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  });
  chain = next.catch(() => undefined);
  return next as Promise<T>;
}

async function callNominatim(
  name: string,
  countryHint?: string | null,
): Promise<Geocoded | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", name);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "zh-TW,en");
  if (countryHint) url.searchParams.set("countrycodes", countryHint);
  const res = await fetch(url, {
    headers: {
      "user-agent": "RoamApp/0.1 (https://roam.example; contact@roam.example)",
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    address?: { country_code?: string };
  }>;
  const hit = rows[0];
  if (!hit) return null;
  const lat = Number.parseFloat(hit.lat);
  const lng = Number.parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name,
    lat,
    lng,
    display_name: hit.display_name ?? null,
    country_code: hit.address?.country_code ?? null,
  };
}

function dominantCountry(
  countries: (string | null | undefined)[],
): string | null {
  const counts = new Map<string, number>();
  for (const c of countries) {
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: { code: string; n: number } | null = null;
  for (const [code, n] of counts) {
    if (!best || n > best.n) best = { code, n };
  }
  return best?.code ?? null;
}

export interface GeocodeOptions {
  /* When set, EVERY query is constrained to this country code and the
     no-hint fallback is disabled. Used for stop-level geocoding where
     the day's city already pins the right country — falling back
     globally would cross-language-match foreign names onto unrelated
     places (e.g. "米蘭時尚區" with country=IT falls back to a Chinese
     place in CN). Prefer null lat/lng over a wrong-country pin. */
  strictCountry?: string | null;
}

export async function geocodeCities(
  rawNames: string[],
  opts: GeocodeOptions = {},
): Promise<Geocoded[]> {
  const unique = Array.from(
    new Map(rawNames.map((n) => [normalize(n), n] as const)).values(),
  );
  if (unique.length === 0) return [];

  const db = getDb();
  const cached = await db
    .select()
    .from(schema.cityGeocode)
    .where(
      inArray(
        schema.cityGeocode.nameNormalized,
        unique.map(normalize),
      ),
    );

  const byKey = new Map<string, Geocoded>();
  for (const row of cached) {
    byKey.set(row.nameNormalized, {
      name: row.nameNormalized,
      lat: Number(row.lat),
      lng: Number(row.lng),
      display_name: row.displayName,
      country_code: row.countryCode,
    });
  }

  /* In strict mode the caller already knows the country (e.g. stops on a
     trip in IT); otherwise infer from cached hits and let the loop refine
     the dominant country as more names resolve. */
  let hint = opts.strictCountry
    ? opts.strictCountry
    : dominantCountry(Array.from(byKey.values()).map((g) => g.country_code));

  /* In strict mode, drop any cached rows whose country disagrees with
     the required one — they likely landed wrong on a prior batch and
     shouldn't poison the current call. */
  if (opts.strictCountry) {
    for (const [k, g] of byKey) {
      if (g.country_code && g.country_code !== opts.strictCountry) {
        byKey.delete(k);
      }
    }
  }

  const misses = unique.filter((n) => !byKey.has(normalize(n)));
  // Geocode misses first — they may bring more country evidence.
  for (const name of misses) {
    let result = await rateLimited(() => callNominatim(name, hint));
    /* No-hint fallback is helpful for multi-country trips
       (Paris → Amsterdam → Berlin) but catastrophic for stops where the
       country is fixed — Chinese-script foreign place names cross-match
       to Asian cities. Skip the fallback in strict mode. */
    if (!result && hint && !opts.strictCountry) {
      result = await rateLimited(() => callNominatim(name, null));
    }
    if (!result) continue;
    /* Strict mode + result lands in the wrong country (rare — nominatim
       respects countrycodes) → reject. */
    if (
      opts.strictCountry &&
      result.country_code &&
      result.country_code !== opts.strictCountry
    ) {
      continue;
    }
    byKey.set(normalize(name), { ...result, name });
    if (!hint && result.country_code) hint = result.country_code;
    try {
      await db
        .insert(schema.cityGeocode)
        .values({
          nameNormalized: normalize(name),
          displayName: result.display_name,
          lat: String(result.lat),
          lng: String(result.lng),
          countryCode: result.country_code,
        })
        .onConflictDoNothing({
          target: schema.cityGeocode.nameNormalized,
        });
    } catch {
      // Cache write is best-effort — render path is the priority.
    }
  }

  // Pass 2: invalidate cached rows whose country fights the dominant one.
  // The dominant country may have changed after pass 1 if misses brought
  // in new evidence, so recompute.
  hint = dominantCountry(Array.from(byKey.values()).map((g) => g.country_code));
  if (hint) {
    const disagreeing = Array.from(byKey.entries()).filter(
      ([, g]) => g.country_code && g.country_code !== hint,
    );
    for (const [key] of disagreeing) {
      const original = unique.find((n) => normalize(n) === key) ?? key;
      let refreshed = await rateLimited(() => callNominatim(original, hint));
      if (!refreshed) {
        refreshed = await rateLimited(() => callNominatim(original, null));
      }
      if (!refreshed) continue;
      byKey.set(key, { ...refreshed, name: original });
      try {
        await db
          .update(schema.cityGeocode)
          .set({
            displayName: refreshed.display_name,
            lat: String(refreshed.lat),
            lng: String(refreshed.lng),
            countryCode: refreshed.country_code,
          })
          .where(eq(schema.cityGeocode.nameNormalized, key));
      } catch {
        // Cache write is best-effort.
      }
    }
  }

  return unique
    .map((name) => byKey.get(normalize(name)))
    .filter((c): c is Geocoded => c != null);
}
