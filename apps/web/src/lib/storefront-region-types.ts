export interface ShopRegion {
  slug: string;
  name: { "zh-TW": string; en: string };
  destinations: string[];
  aliases?: string[];
  intro?: { "zh-TW": string; en: string };
  esimRegionSlug?: string;
  introOnly?: boolean;
  cover: string;
}
