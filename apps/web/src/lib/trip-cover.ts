// Map a trip (title + optional cities) to an illustration URL. Keywords
// scan left-to-right; the first hit wins, so order from specific → broad.
// Generic regional slugs (e.g. "europe") live at the bottom as fallback
// for trips that don't name a single city ("歐洲 5 國", "Europe road
// trip", …).

type CityRule = [keywords: string[], slug: string];

const CITY_RULES: CityRule[] = [
  [["東京", "Tokyo"], "tokyo"],
  [["京都", "Kyoto"], "kyoto"],
  [["大阪", "Osaka"], "osaka"],
  [["北海道", "札幌", "Hokkaido", "Sapporo"], "hokkaido"],
  [["沖繩", "Okinawa"], "okinawa"],
  [["首爾", "Seoul"], "seoul"],
  [["釜山", "Busan"], "busan"],
  [["台北", "Taipei"], "taipei"],
  [["曼谷", "Bangkok"], "bangkok"],
  [["新加坡", "Singapore"], "singapore"],
  [["香港", "Hong Kong", "HK"], "hong-kong"],
  [["河內", "Hanoi", "Hà Nội"], "hanoi"],
  [["胡志明", "西貢", "Ho Chi Minh", "Saigon"], "ho-chi-minh"],
  [["巴黎", "Paris"], "paris"],
  [["倫敦", "London"], "london"],
  [["羅馬", "Rome", "Roma"], "rome"],
  [["米蘭", "Milan", "Milano"], "milan"],
  [["巴塞隆納", "Barcelona"], "barcelona"],
  [["阿姆斯特丹", "Amsterdam"], "amsterdam"],
  [["布拉格", "Prague", "Praha"], "prague"],
  [["紐約", "New York", "NYC"], "new-york"],
  [["洛杉磯", "Los Angeles", " LA "], "los-angeles"],
  [["雪梨", "悉尼", "Sydney"], "sydney"],
  // Regional fallback — keep last so city-specific matches win.
  [["歐洲", "Europe"], "europe"],
];

const FALLBACK = "/illustrations/trip-cover.png";

export function tripCoverUrl(trip: {
  title?: string | null;
  cities?: string[] | null;
}): string {
  const haystack = [trip.title ?? "", ...(trip.cities ?? [])]
    .join(" ")
    .toLowerCase();
  for (const [keywords, slug] of CITY_RULES) {
    if (keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      return `/illustrations/cities/${slug}.jpg`;
    }
  }
  return FALLBACK;
}
