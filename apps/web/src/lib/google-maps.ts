"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

export const googleMapsMapId =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || undefined;

let loaderConfigured = false;
let configuredLocale: GoogleMapsLocale | null = null;
let mapsPromise: Promise<void> | null = null;
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;
let routesPromise: Promise<google.maps.RoutesLibrary> | null = null;

const GOOGLE_MAPS_LOCALE_STORAGE_KEY = "roam.googleMapsLocale";

type GoogleMapsLocale = {
  language: string;
  region: string;
};

function currentGoogleMapsLocale(): GoogleMapsLocale {
  if (typeof window !== "undefined") {
    const fromPath = window.location.pathname.split("/").filter(Boolean)[0];
    if (fromPath) return googleMapsLocaleFromAppLocale(fromPath);
  }
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return googleMapsLocaleFromAppLocale(document.documentElement.lang);
  }
  return googleMapsLocaleFromAppLocale("en");
}

function googleMapsLocaleFromAppLocale(locale: string): GoogleMapsLocale {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("zh")) {
    return { language: "zh-TW", region: "TW" };
  }
  return { language: "en", region: "US" };
}

function configureLoader() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }
  const locale = currentGoogleMapsLocale();
  if (hasExistingGoogleMapsImportLibrary()) {
    const previousLocale = readStoredLocaleKey();
    const nextLocale = localeKey(locale);
    if (typeof window !== "undefined" && previousLocale !== nextLocale) {
      writeStoredLocaleKey(nextLocale);
      window.location.reload();
      throw new Error("Reloading Google Maps with locale");
    }
    configuredLocale = locale;
    loaderConfigured = true;
    return;
  }
  if (loaderConfigured) return;
  setOptions({
    key: GOOGLE_MAPS_API_KEY,
    v: "weekly",
    language: locale.language,
    region: locale.region,
    authReferrerPolicy: "origin",
    ...(googleMapsMapId ? { mapIds: [googleMapsMapId] } : {}),
  });
  configuredLocale = locale;
  writeStoredLocaleKey(localeKey(locale));
  loaderConfigured = true;
}

export function getConfiguredGoogleMapsLocale(): GoogleMapsLocale | null {
  return configuredLocale;
}

function hasExistingGoogleMapsImportLibrary(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.google?.maps?.importLibrary === "function"
  );
}

function localeKey(locale: GoogleMapsLocale): string {
  return `${locale.language}:${locale.region}`;
}

function readStoredLocaleKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(GOOGLE_MAPS_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLocaleKey(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GOOGLE_MAPS_LOCALE_STORAGE_KEY, value);
  } catch {
    // Session storage can be unavailable in privacy-restricted contexts.
  }
}

export function loadGoogleMaps(): Promise<void> {
  try {
    configureLoader();
  } catch (error) {
    return Promise.reject(error);
  }
  if (!mapsPromise) {
    mapsPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
    ]).then(() => undefined);
  }
  return mapsPromise;
}

export function loadGooglePlaces(): Promise<google.maps.PlacesLibrary> {
  try {
    configureLoader();
  } catch (error) {
    return Promise.reject(error);
  }
  if (!placesPromise) {
    placesPromise = importLibrary("places");
  }
  return placesPromise;
}

export function loadGoogleRoutes(): Promise<google.maps.RoutesLibrary> {
  try {
    configureLoader();
  } catch (error) {
    return Promise.reject(error);
  }
  if (!routesPromise) {
    routesPromise = importLibrary("routes");
  }
  return routesPromise;
}
