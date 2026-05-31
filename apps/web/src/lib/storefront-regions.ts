import {
  EUROPE_COUNTRY_REGIONS,
  EUROPE_COUNTRY_REGION_SLUGS,
} from "@/lib/storefront-destinations";
import type { ShopRegion } from "@/lib/storefront-region-types";

export type { ShopRegion } from "@/lib/storefront-region-types";
export {
  EUROPE_COUNTRY_REGIONS,
  EUROPE_COUNTRY_REGION_SLUGS,
} from "@/lib/storefront-destinations";

// Canonical region catalog for the storefront shop. Mirrors the slugs
// used by the cleaned Caffeine catalog importer
// (services/api/src/cli/import-caffeine-catalog.ts) so a region card on
// /shop maps cleanly to the ISO destinations that products carry in
// `marketing_destinations`.
//
// Single source of truth — both the region grid (/shop) and the
// detail page (/shop/[region]) read from here.

export const SHOP_REGIONS: ShopRegion[] = [
  { slug: "japan",       name: { "zh-TW": "日本",   en: "Japan"  }, destinations: ["JP"],       cover: "/illustrations/cities/tokyo.jpg" },
  { slug: "korea",       name: { "zh-TW": "韓國",   en: "Korea"  }, destinations: ["KR"],       cover: "/illustrations/cities/seoul.jpg" },
  { slug: "taipei",      name: { "zh-TW": "台灣",   en: "Taiwan" }, destinations: ["TW"],       cover: "/illustrations/cities/taipei.jpg" },
  { slug: "hong-kong",   name: { "zh-TW": "香港",   en: "Hong Kong" }, destinations: ["HK"],   cover: "/illustrations/cities/hong-kong.jpg" },
  { slug: "macau",       name: { "zh-TW": "澳門",   en: "Macau" }, destinations: ["MO"],        cover: "/illustrations/cities/macau.jpg" },
  { slug: "china",       name: { "zh-TW": "中國大陸", en: "China" }, destinations: ["CN"],      cover: "/illustrations/cities/beijing.jpg" },
  { slug: "greater-china", name: { "zh-TW": "中港澳", en: "Greater China" }, destinations: ["CN","HK","MO"], cover: "/illustrations/cities/beijing.jpg" },
  { slug: "singapore-malaysia", name: { "zh-TW": "新馬", en: "Singapore & Malaysia" }, destinations: ["SG","MY"], cover: "/illustrations/cities/singapore.jpg" },
  { slug: "thailand",    name: { "zh-TW": "泰國",   en: "Thailand"  }, destinations: ["TH"],    cover: "/illustrations/cities/bangkok.jpg" },
  { slug: "vietnam",     name: { "zh-TW": "越南",   en: "Vietnam"   }, destinations: ["VN"],    cover: "/illustrations/cities/hanoi.jpg" },
  { slug: "indonesia",   name: { "zh-TW": "印尼",   en: "Indonesia" }, destinations: ["ID"],    cover: "/illustrations/cities/jakarta.jpg" },
  { slug: "anz",         name: { "zh-TW": "紐澳",   en: "Australia & NZ" }, destinations: ["AU","NZ"], cover: "/illustrations/cities/sydney.jpg" },
  { slug: "saipan-guam", name: { "zh-TW": "塞班 & 關島", en: "Saipan & Guam" }, destinations: ["MP","GU"], cover: "/illustrations/cities/okinawa.jpg" },
  { slug: "europe",      name: { "zh-TW": "歐洲",   en: "Europe"    }, destinations: ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","GB","NO","CH","IS","LI"], cover: "/illustrations/cities/vienna.jpg" },
  { slug: "western-northern-europe", name: { "zh-TW": "西歐 / 北歐", en: "Western & Northern Europe" }, destinations: ["FR","DE","NL","BE","LU","GB","IE","DK","SE","NO","FI","IS","CH","AT"], cover: "/illustrations/cities/paris.jpg" },
  { slug: "central-eastern-europe-balkans", name: { "zh-TW": "中歐 / 東歐 / 巴爾幹", en: "Central, Eastern Europe & Balkans" }, destinations: ["PL","CZ","SK","HU","RO","BG","HR","SI","RS","BA","ME","MK","AL","GR","EE","LV","LT"], cover: "/illustrations/cities/prague.jpg" },
  { slug: "spain-camino", name: { "zh-TW": "西班牙朝聖", en: "Spain – Camino" }, destinations: ["ES"], cover: "/illustrations/cities/barcelona.jpg" },
  ...EUROPE_COUNTRY_REGIONS,
  { slug: "turkey",      name: { "zh-TW": "土耳其", en: "Turkey"    }, destinations: ["TR"],    cover: "/illustrations/cities/istanbul.jpg" },
  { slug: "usa",         name: { "zh-TW": "美國",   en: "USA"       }, destinations: ["US"],    cover: "/illustrations/cities/new-york.jpg" },
  { slug: "north-america", name: { "zh-TW": "北美", en: "North America" }, destinations: ["US","CA","MX"], cover: "/illustrations/cities/los-angeles.jpg" },
  { slug: "south-america", name: { "zh-TW": "南美", en: "South America" }, destinations: ["AR","BO","BR","CL","CO","EC","GY","PY","PE","SR","UY","VE"], cover: "/illustrations/cities/rio.jpg" },
  { slug: "africa",      name: { "zh-TW": "非洲",   en: "Africa"    }, destinations: ["ZA","EG","KE","MA","TZ","GH","NG","ET","UG","RW","TN","ZW","BW","NA","SN","CI"], cover: "/illustrations/cities/nairobi.jpg" },
  { slug: "india",       name: { "zh-TW": "印度",   en: "India"     }, destinations: ["IN"],    cover: "/illustrations/cities/mumbai.jpg" },
];

// Geographic groups for the /shop landing — drives the section headers
// so the grid isn't 23 visually-equal cards but a structured catalog.
export interface RegionGroup {
  id: string;
  name: { "zh-TW": string; en: string };
  slugs: string[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    id: "popular",
    name: { "zh-TW": "熱門目的地", en: "Popular" },
    slugs: ["japan", "korea", "taipei", "hong-kong", "singapore-malaysia"],
  },
  {
    id: "asia",
    name: { "zh-TW": "亞洲", en: "Asia" },
    slugs: [
      "thailand",
      "vietnam",
      "indonesia",
      "macau",
      "china",
      "greater-china",
      "india",
    ],
  },
  {
    id: "europe",
    name: { "zh-TW": "歐洲", en: "Europe" },
    slugs: [
      "europe",
      "western-northern-europe",
      "central-eastern-europe-balkans",
      "spain-camino",
      "turkey",
    ],
  },
  {
    id: "europe-countries",
    name: { "zh-TW": "歐洲國家", en: "European countries" },
    slugs: EUROPE_COUNTRY_REGION_SLUGS,
  },
  {
    id: "americas-oceania",
    name: { "zh-TW": "美洲 & 大洋洲", en: "Americas & Oceania" },
    slugs: ["usa", "north-america", "south-america", "anz", "saipan-guam"],
  },
  {
    id: "africa",
    name: { "zh-TW": "非洲", en: "Africa" },
    slugs: ["africa"],
  },
];

export function findRegionBySlug(slug: string): ShopRegion | undefined {
  return SHOP_REGIONS.find((r) => r.slug === slug);
}

export function getRegionSearchText(region: ShopRegion): string {
  return [
    region.name["zh-TW"],
    region.name.en,
    region.slug,
    ...region.destinations,
    ...(region.aliases ?? []),
  ].join(" ");
}

/**
 * Given a plan's `marketing_destinations`, return a human-readable
 * coverage label by matching against known sub-regions.
 *
 *   [ES]                                           → "西班牙"          (single country slug match)
 *   [FR,DE,NL,BE,...14 western/northern countries] → "西歐/北歐"        (sub-region match)
 *   [AT,BE,BG,HR,...all 32 EU+ countries]          → "歐洲全境"         (matches parent)
 *   [some odd subset]                              → "N 國"             (fallback)
 *
 * `parent` lets us flag whether the plan covers the FULL parent region
 * or just a subset — the storefront highlights "全境" vs "部分" so the
 * user knows whether their destination is included.
 */
export function getCoverageInfo(
  destinations: string[],
  parent: ShopRegion,
  localeKey: "zh-TW" | "en" = "zh-TW",
): { label: string; isFullCoverage: boolean; matchedSlug: string | null } {
  if (destinations.length === 0) {
    return { label: "—", isFullCoverage: false, matchedSlug: null };
  }
  const destSet = new Set(destinations);
  const parentSet = new Set(parent.destinations);
  // Coverage of parent: how many of the parent's countries this plan
  // actually includes.
  const parentOverlap = parent.destinations.filter((d) =>
    destSet.has(d),
  ).length;
  const isFullCoverage =
    parentOverlap === parent.destinations.length &&
    destinations.length >= parent.destinations.length;

  if (isFullCoverage) {
    return {
      label: localeKey === "en" ? "Full coverage" : `${parent.name[localeKey]}全境`,
      isFullCoverage: true,
      matchedSlug: parent.slug,
    };
  }

  // Try to match against a known sub-region whose destinations are
  // exactly contained in this plan. Prefer the largest match.
  const candidates = SHOP_REGIONS.filter((r) => {
    if (r.slug === parent.slug) return false;
    return r.destinations.every((d) => destSet.has(d));
  }).sort((a, b) => b.destinations.length - a.destinations.length);

  if (candidates[0] && candidates[0].destinations.length >= 2) {
    return {
      label: candidates[0].name[localeKey],
      isFullCoverage: false,
      matchedSlug: candidates[0].slug,
    };
  }

  // Single-country plans
  if (destinations.length === 1) {
    const single = SHOP_REGIONS.find(
      (r) => r.destinations.length === 1 && r.destinations[0] === destinations[0],
    );
    return {
      label: single ? single.name[localeKey] : destinations[0]!,
      isFullCoverage: false,
      matchedSlug: single?.slug ?? null,
    };
  }

  // Fallback — show the count, scoped to the parent so the user sees
  // "covers 14 of the 32 European countries"
  const inParent = destinations.filter((d) => parentSet.has(d)).length;
  const suffix = localeKey === "en" ? "countries" : "國";
  return {
    label: `${inParent || destinations.length} ${suffix}`,
    isFullCoverage: false,
    matchedSlug: null,
  };
}
