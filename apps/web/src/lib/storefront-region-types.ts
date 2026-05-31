export interface ShopRegion {
  slug: string;
  name: { "zh-TW": string; en: string };
  destinations: string[];
  aliases?: string[];
  esimRegionSlug?: string;
  introOnly?: boolean;
  cover: string;
}
