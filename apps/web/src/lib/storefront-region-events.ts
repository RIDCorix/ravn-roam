import {
  EUROPE_COUNTRY_REGION_SLUGS,
  type ShopRegion,
} from "@/lib/storefront-regions";
import type { ApiEvent } from "@/components/storefront/shop/region-detail/types";
import { serverApiBase } from "@/lib/server-api-base";

export async function loadRegionEvents(regionSlug: string): Promise<ApiEvent[]> {
  const base = serverApiBase();
  const url = new URL("/storefront/events", base);
  url.searchParams.set("upcoming", "1");
  url.searchParams.set("region", regionSlug);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: ApiEvent[] };
    return (data.events ?? []).slice(0, 12);
  } catch {
    return [];
  }
}

export function buildPlansHref(
  lang: string,
  region: ShopRegion,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const key of ["days", "gb", "qty", "coverage", "trip_id", "checklist_id"]) {
    const value = searchParams[key];
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw) params.set(key, raw);
  }
  if (region.esimRegionSlug && !params.has("coverage")) {
    params.set("coverage", region.esimRegionSlug);
  }
  const qs = params.toString();
  const plansRegionSlug = region.esimRegionSlug ?? region.slug;
  return `/${lang}/shop/${plansRegionSlug}/plans${qs ? `?${qs}` : ""}`;
}

export function timelineBackgroundForRegion(regionSlug: string): string {
  if (regionSlug === "taipei") {
    return "/illustrations/timeline/seasonal-timeline-taiwan.png";
  }
  if (
    [
      "europe",
      "western-northern-europe",
      "central-eastern-europe-balkans",
      "spain-camino",
      "turkey",
      ...EUROPE_COUNTRY_REGION_SLUGS,
    ].includes(regionSlug)
  ) {
    return "/illustrations/timeline/seasonal-timeline-europe.png";
  }
  return "/illustrations/timeline/seasonal-timeline-default.png";
}
