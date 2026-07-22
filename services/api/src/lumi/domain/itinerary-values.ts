const CANONICAL_ITINERARY_CITY_BY_KEY = new Map([
  ["taipei", "台北"], ["台北", "台北"], ["臺北", "台北"],
  ["milan", "米蘭"], ["milano", "米蘭"], ["米蘭", "米蘭"], ["米兰", "米蘭"],
  ["paris", "巴黎"], ["巴黎", "巴黎"],
  ["barcelona", "巴塞隆納"], ["巴塞隆納", "巴塞隆納"], ["巴塞罗那", "巴塞隆納"],
  ["london", "倫敦"], ["倫敦", "倫敦"], ["伦敦", "倫敦"],
]);

const AIRPORT_OVERVIEW_CITY_TOKENS = [
  "機場", "airport", "aéroport", "aeroporto", "aeropuerto",
  "tpe", "tsa", "mxp", "lin", "cdg", "lhr", "bcn",
];

function canonicalItineraryCity(value: string): string {
  const trimmed = value.trim();
  return CANONICAL_ITINERARY_CITY_BY_KEY.get(trimmed.toLowerCase()) ?? trimmed;
}

function isAirportOverviewCity(value: string): boolean {
  const key = value.trim().toLowerCase();
  return AIRPORT_OVERVIEW_CITY_TOKENS.some((token) => key.includes(token));
}

export function normalizeLumiDayCities(day: { city: string; cities?: readonly string[] | null }): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const city = value?.trim();
    if (!city || isAirportOverviewCity(city)) return;
    const canonical = canonicalItineraryCity(city);
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(canonical || city);
  };
  push(day.city);
  for (const city of day.cities ?? []) push(city);
  return ordered;
}
