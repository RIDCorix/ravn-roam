// The slug set maps directly into apps/web's storefront region catalog.
// The crawler passes it to model schemas so providers cannot invent unknown
// storefront regions.
export const REGION_SLUGS = [
  "japan",
  "korea",
  "taipei",
  "hong-kong",
  "macau",
  "china",
  "greater-china",
  "singapore-malaysia",
  "thailand",
  "vietnam",
  "indonesia",
  "anz",
  "saipan-guam",
  "europe",
  "western-northern-europe",
  "central-eastern-europe-balkans",
  "spain-camino",
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "cyprus",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "ireland",
  "italy",
  "latvia",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
  "united-kingdom",
  "norway",
  "switzerland",
  "iceland",
  "liechtenstein",
  "serbia",
  "bosnia-herzegovina",
  "montenegro",
  "north-macedonia",
  "albania",
  "turkey",
  "usa",
  "north-america",
  "south-america",
  "africa",
  "india",
] as const;

export const EVENT_TYPES = [
  "festival",
  "carnival",
  "religious",
  "music",
  "sports",
  "food",
  "seasonal",
  "cultural",
  "other",
] as const;

export const TINTS = ["warm", "cool", "violet", "ember", "spring"] as const;

export type RegionSlug = (typeof REGION_SLUGS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type Tint = (typeof TINTS)[number];
export type EventCrawlerProvider = "gemini" | "openai";

export interface HotMarket {
  id: string;
  country_zh: string;
  country_en: string;
  region_slug: RegionSlug;
  country_codes: string[];
}

export interface EventCategory {
  id: string;
  label_zh: string;
  label_en: string;
  event_types: EventType[];
  search_focus: string;
}

export const HOT_MARKETS = [
  { id: "japan", country_zh: "日本", country_en: "Japan", region_slug: "japan", country_codes: ["JP"] },
  { id: "korea", country_zh: "韓國", country_en: "South Korea", region_slug: "korea", country_codes: ["KR"] },
  { id: "taiwan", country_zh: "台灣", country_en: "Taiwan", region_slug: "taipei", country_codes: ["TW"] },
  { id: "hong-kong", country_zh: "香港", country_en: "Hong Kong", region_slug: "hong-kong", country_codes: ["HK"] },
  { id: "macau", country_zh: "澳門", country_en: "Macau", region_slug: "macau", country_codes: ["MO"] },
  { id: "china", country_zh: "中國大陸", country_en: "China", region_slug: "china", country_codes: ["CN"] },
  { id: "singapore", country_zh: "新加坡", country_en: "Singapore", region_slug: "singapore-malaysia", country_codes: ["SG"] },
  { id: "malaysia", country_zh: "馬來西亞", country_en: "Malaysia", region_slug: "singapore-malaysia", country_codes: ["MY"] },
  { id: "thailand", country_zh: "泰國", country_en: "Thailand", region_slug: "thailand", country_codes: ["TH"] },
  { id: "vietnam", country_zh: "越南", country_en: "Vietnam", region_slug: "vietnam", country_codes: ["VN"] },
  { id: "indonesia", country_zh: "印尼", country_en: "Indonesia", region_slug: "indonesia", country_codes: ["ID"] },
  { id: "australia", country_zh: "澳洲", country_en: "Australia", region_slug: "anz", country_codes: ["AU"] },
  { id: "new-zealand", country_zh: "紐西蘭", country_en: "New Zealand", region_slug: "anz", country_codes: ["NZ"] },
  { id: "usa", country_zh: "美國", country_en: "United States", region_slug: "usa", country_codes: ["US"] },
  { id: "canada", country_zh: "加拿大", country_en: "Canada", region_slug: "north-america", country_codes: ["CA"] },
  { id: "austria", country_zh: "奧地利", country_en: "Austria", region_slug: "austria", country_codes: ["AT"] },
  { id: "belgium", country_zh: "比利時", country_en: "Belgium", region_slug: "belgium", country_codes: ["BE"] },
  { id: "bulgaria", country_zh: "保加利亞", country_en: "Bulgaria", region_slug: "bulgaria", country_codes: ["BG"] },
  { id: "croatia", country_zh: "克羅埃西亞", country_en: "Croatia", region_slug: "croatia", country_codes: ["HR"] },
  { id: "cyprus", country_zh: "賽普勒斯", country_en: "Cyprus", region_slug: "cyprus", country_codes: ["CY"] },
  { id: "czechia", country_zh: "捷克", country_en: "Czechia", region_slug: "czechia", country_codes: ["CZ"] },
  { id: "denmark", country_zh: "丹麥", country_en: "Denmark", region_slug: "denmark", country_codes: ["DK"] },
  { id: "estonia", country_zh: "愛沙尼亞", country_en: "Estonia", region_slug: "estonia", country_codes: ["EE"] },
  { id: "finland", country_zh: "芬蘭", country_en: "Finland", region_slug: "finland", country_codes: ["FI"] },
  { id: "france", country_zh: "法國", country_en: "France", region_slug: "france", country_codes: ["FR"] },
  { id: "germany", country_zh: "德國", country_en: "Germany", region_slug: "germany", country_codes: ["DE"] },
  { id: "greece", country_zh: "希臘", country_en: "Greece", region_slug: "greece", country_codes: ["GR"] },
  { id: "hungary", country_zh: "匈牙利", country_en: "Hungary", region_slug: "hungary", country_codes: ["HU"] },
  { id: "ireland", country_zh: "愛爾蘭", country_en: "Ireland", region_slug: "ireland", country_codes: ["IE"] },
  { id: "italy", country_zh: "義大利", country_en: "Italy", region_slug: "italy", country_codes: ["IT"] },
  { id: "latvia", country_zh: "拉脫維亞", country_en: "Latvia", region_slug: "latvia", country_codes: ["LV"] },
  { id: "lithuania", country_zh: "立陶宛", country_en: "Lithuania", region_slug: "lithuania", country_codes: ["LT"] },
  { id: "luxembourg", country_zh: "盧森堡", country_en: "Luxembourg", region_slug: "luxembourg", country_codes: ["LU"] },
  { id: "malta", country_zh: "馬爾他", country_en: "Malta", region_slug: "malta", country_codes: ["MT"] },
  { id: "netherlands", country_zh: "荷蘭", country_en: "Netherlands", region_slug: "netherlands", country_codes: ["NL"] },
  { id: "poland", country_zh: "波蘭", country_en: "Poland", region_slug: "poland", country_codes: ["PL"] },
  { id: "portugal", country_zh: "葡萄牙", country_en: "Portugal", region_slug: "portugal", country_codes: ["PT"] },
  { id: "romania", country_zh: "羅馬尼亞", country_en: "Romania", region_slug: "romania", country_codes: ["RO"] },
  { id: "slovakia", country_zh: "斯洛伐克", country_en: "Slovakia", region_slug: "slovakia", country_codes: ["SK"] },
  { id: "slovenia", country_zh: "斯洛維尼亞", country_en: "Slovenia", region_slug: "slovenia", country_codes: ["SI"] },
  { id: "spain", country_zh: "西班牙", country_en: "Spain", region_slug: "spain", country_codes: ["ES"] },
  { id: "sweden", country_zh: "瑞典", country_en: "Sweden", region_slug: "sweden", country_codes: ["SE"] },
  { id: "uk", country_zh: "英國", country_en: "United Kingdom", region_slug: "united-kingdom", country_codes: ["GB"] },
  { id: "norway", country_zh: "挪威", country_en: "Norway", region_slug: "norway", country_codes: ["NO"] },
  { id: "switzerland", country_zh: "瑞士", country_en: "Switzerland", region_slug: "switzerland", country_codes: ["CH"] },
  { id: "iceland", country_zh: "冰島", country_en: "Iceland", region_slug: "iceland", country_codes: ["IS"] },
  { id: "liechtenstein", country_zh: "列支敦士登", country_en: "Liechtenstein", region_slug: "liechtenstein", country_codes: ["LI"] },
  { id: "serbia", country_zh: "塞爾維亞", country_en: "Serbia", region_slug: "serbia", country_codes: ["RS"] },
  { id: "bosnia-herzegovina", country_zh: "波士尼亞與赫塞哥維納", country_en: "Bosnia & Herzegovina", region_slug: "bosnia-herzegovina", country_codes: ["BA"] },
  { id: "montenegro", country_zh: "蒙特內哥羅", country_en: "Montenegro", region_slug: "montenegro", country_codes: ["ME"] },
  { id: "north-macedonia", country_zh: "北馬其頓", country_en: "North Macedonia", region_slug: "north-macedonia", country_codes: ["MK"] },
  { id: "albania", country_zh: "阿爾巴尼亞", country_en: "Albania", region_slug: "albania", country_codes: ["AL"] },
  { id: "turkey", country_zh: "土耳其", country_en: "Turkey", region_slug: "turkey", country_codes: ["TR"] },
  { id: "india", country_zh: "印度", country_en: "India", region_slug: "india", country_codes: ["IN"] },
  { id: "brazil", country_zh: "巴西", country_en: "Brazil", region_slug: "south-america", country_codes: ["BR"] },
  { id: "south-africa", country_zh: "南非", country_en: "South Africa", region_slug: "africa", country_codes: ["ZA"] },
] as const satisfies readonly HotMarket[];

export const EVENT_CATEGORIES = [
  {
    id: "seasonal",
    label_zh: "季節（植物、作物）",
    label_en: "seasonal plants, harvests, and natural phenomena",
    event_types: ["seasonal", "food"],
    search_focus:
      "flower seasons, foliage, harvest festivals, fruit/crop seasons, natural phenomena, and seasonal tourism peaks",
  },
  {
    id: "religious",
    label_zh: "宗教",
    label_en: "religious holidays and pilgrimages",
    event_types: ["religious", "cultural"],
    search_focus:
      "religious holidays, pilgrimages, temple/shrine/church festivals, and spiritual travel events",
  },
  {
    id: "music",
    label_zh: "音樂（音樂季/演唱會）",
    label_en: "music festivals and major concerts",
    event_types: ["music"],
    search_focus:
      "music festivals, concert seasons, world tours with strong travel demand, and venue-led destination events",
  },
  {
    id: "sports",
    label_zh: "運動（運動會、體育賽事）",
    label_en: "sports meets and major competitions",
    event_types: ["sports"],
    search_focus:
      "marathons, grand prix, tournaments, games, championships, and spectator sports that drive inbound travel",
  },
  {
    id: "cultural",
    label_zh: "文化（祭典/狂歡季）",
    label_en: "cultural festivals and carnivals",
    event_types: ["festival", "carnival", "cultural"],
    search_focus:
      "festivals, carnivals, parades, matsuri, cultural weeks, public celebrations, and major civic events",
  },
] as const satisfies readonly EventCategory[];
