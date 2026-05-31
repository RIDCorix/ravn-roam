// Build a /shop URL from a checklist item's `shopFilter` so eSIM todos
// can deep-link straight to the matching region page with the slider
// pre-positioned. Single source of truth shared by the home page todo
// list, the trip-detail checklist row, and (downstream) any Lumi tool
// output that surfaces a buyable plan.
//
// `shopFilter.country` accepts either:
//   • An ISO 3166-1 alpha-2 code  ("JP", "KR", "ES")
//   • A region slug we defined    ("japan", "western-northern-europe")
//   • A free-form label           ("EU+UK", "歐洲")   → falls back to /shop
//
// The trailing query string carries `days` and `gb` so the region page
// can snap the slider + scroll to the matching plan.

import { SHOP_REGIONS, findRegionBySlug } from "./storefront-regions";

export interface ShopFilter {
  country?: string;
  days?: number;
  gb?: number;
  coverage?: string[];
}

export interface ShopHrefContext {
  tripId?: string;
  checklistItemId?: string;
  quantity?: number;
}

const COUNTRY_ALIASES: Record<string, string> = {
  日本: "JP",
  japan: "JP",
  韓國: "KR",
  南韓: "KR",
  korea: "KR",
  台灣: "TW",
  臺灣: "TW",
  taiwan: "TW",
  香港: "HK",
  hongkong: "HK",
  "hong kong": "HK",
  新加坡: "SG",
  singapore: "SG",
  馬來西亞: "MY",
  malaysia: "MY",
  泰國: "TH",
  thailand: "TH",
  越南: "VN",
  vietnam: "VN",
  印尼: "ID",
  indonesia: "ID",
  澳洲: "AU",
  澳大利亞: "AU",
  australia: "AU",
  紐西蘭: "NZ",
  newzealand: "NZ",
  "new zealand": "NZ",
  歐洲: "europe",
  europe: "europe",
  中歐: "central-eastern-europe-balkans",
  東歐: "central-eastern-europe-balkans",
  巴爾幹: "central-eastern-europe-balkans",
  西歐: "western-northern-europe",
  北歐: "western-northern-europe",
  義大利: "IT",
  意大利: "IT",
  italy: "IT",
  羅馬: "IT",
  rome: "IT",
  roma: "IT",
  milan: "IT",
  米蘭: "IT",
  法國: "FR",
  france: "FR",
  德國: "DE",
  germany: "DE",
  英國: "GB",
  uk: "GB",
  "united kingdom": "GB",
  美國: "US",
  usa: "US",
  "united states": "US",
  西班牙: "ES",
  spain: "ES",
  土耳其: "TR",
  turkey: "TR",
  印度: "IN",
  india: "IN",
};

const EUROPE_PARENT_SLUG = "europe";
const EUROPE_PARENT = SHOP_REGIONS.find((r) => r.slug === EUROPE_PARENT_SLUG);
const EUROPE_SUBREGION_SLUGS = new Set([
  "western-northern-europe",
  "central-eastern-europe-balkans",
  "spain-camino",
]);

/** Find which region slug best covers a given ISO code. Single-country
 *  regions win over multi-country (e.g. JP → "japan" not "asia"). */
export function findRegionByDestination(iso: string): string | undefined {
  const code = iso.trim().toUpperCase();
  // Single-country region first
  const single = SHOP_REGIONS.find(
    (r) => r.destinations.length === 1 && r.destinations[0] === code,
  );
  if (single) return single.slug;
  // Otherwise smallest region containing it
  const candidates = SHOP_REGIONS.filter((r) => r.destinations.includes(code));
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => a.destinations.length - b.destinations.length);
  return candidates[0]!.slug;
}

export function buildShopHref(
  lang: string,
  filter: ShopFilter | null | undefined,
  context: ShopHrefContext = {},
): string {
  if (!filter) return `/${lang}/shop`;

  // 1. Try slug match first (Lumi may emit a slug directly).
  let slug =
    filter.country && findRegionBySlug(filter.country) ? filter.country : null;
  let coverage = filter.coverage?.filter((s) => Boolean(findRegionBySlug(s))) ?? [];

  // 2. Otherwise ISO lookup.
  if (!slug && filter.country) {
    slug = findRegionByDestination(filter.country) ?? null;
  }
  if (slug) {
    const upperCountry = filter.country?.trim().toUpperCase();
    const isEuropeanIso =
      upperCountry &&
      EUROPE_PARENT?.destinations.includes(upperCountry);
    const isEuropeSubregion = EUROPE_SUBREGION_SLUGS.has(slug);
    if (isEuropeanIso || slug === EUROPE_PARENT_SLUG || isEuropeSubregion) {
      coverage = Array.from(
        new Set([
          EUROPE_PARENT_SLUG,
          ...(isEuropeSubregion ? [slug] : []),
          ...coverage,
        ]),
      );
      slug = EUROPE_PARENT_SLUG;
    }
  }

  const params = new URLSearchParams();
  if (filter.days != null && Number.isFinite(filter.days)) {
    params.set("days", String(filter.days));
  }
  if (filter.gb != null && Number.isFinite(filter.gb)) {
    params.set("gb", String(filter.gb));
  }
  if (coverage.length > 0) {
    params.set("coverage", coverage.join(","));
  }
  if (context.tripId) params.set("trip_id", context.tripId);
  if (context.checklistItemId) params.set("checklist_id", context.checklistItemId);
  if (context.quantity && Number.isFinite(context.quantity)) {
    params.set("qty", String(Math.max(1, Math.trunc(context.quantity))));
  }
  const qs = params.toString();

  if (slug) {
    return qs
      ? `/${lang}/shop/${slug}/plans?${qs}`
      : `/${lang}/shop/${slug}/plans`;
  }
  // No resolvable region — drop the user on the grid; query string lives
  // on as a hint for any future cross-region search UI.
  return qs ? `/${lang}/shop?${qs}` : `/${lang}/shop`;
}

export function inferEsimShopFilterFromText(
  text: string,
): ShopFilter | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  let country: string | undefined;
  for (const [needle, code] of Object.entries(COUNTRY_ALIASES)) {
    if (normalized.includes(needle.toLowerCase())) {
      country = code;
      break;
    }
  }
  if (!country) {
    for (const region of SHOP_REGIONS) {
      if (
        normalized.includes(region.slug) ||
        normalized.includes(region.name["zh-TW"].toLowerCase()) ||
        normalized.includes(region.name.en.toLowerCase())
      ) {
        country = region.slug;
        break;
      }
    }
  }

  const daysMatch = normalized.match(/(\d{1,2})\s*(?:日|天|day|days)/i);
  const gbMatch = normalized.match(/(\d{1,3}(?:\.\d+)?)\s*gb/i);
  if (!country && !daysMatch && !gbMatch) return null;
  return {
    country,
    days: daysMatch ? Number(daysMatch[1]) : undefined,
    gb: gbMatch ? Number(gbMatch[1]) : undefined,
  };
}

export function buildChecklistEsimShopHref(
  lang: string,
  item: { kind?: string; text?: string; shopFilter?: ShopFilter | null },
  context: ShopHrefContext = {},
): string | null {
  if (item.kind !== "esim") return null;
  return buildShopHref(
    lang,
    item.shopFilter ?? inferEsimShopFilterFromText(item.text ?? ""),
    context,
  );
}
