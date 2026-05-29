// City name → ISO-3166-1 alpha-2 country code lookup for resolving
// "我的足跡" pins when the API trip rows don't carry an explicit
// country. Covers the cities that show up in seeded/mock trips. Keys
// are matched case-insensitively against trip.cities; both Chinese and
// English aliases are supported.

const RAW: Record<string, string> = {
  // Japan
  東京: "JP", 京都: "JP", 大阪: "JP", 札幌: "JP", 福岡: "JP", 名古屋: "JP",
  Tokyo: "JP", Kyoto: "JP", Osaka: "JP", Sapporo: "JP", Fukuoka: "JP",
  // Korea
  首爾: "KR", 釜山: "KR", 濟州: "KR",
  Seoul: "KR", Busan: "KR", Jeju: "KR",
  // Taiwan
  台北: "TW", 台中: "TW", 高雄: "TW", 花蓮: "TW",
  Taipei: "TW", Taichung: "TW", Kaohsiung: "TW", Hualien: "TW",
  // Greater China
  香港: "HK", 澳門: "MO",
  "Hong Kong": "HK", Macau: "MO", Macao: "MO",
  北京: "CN", 上海: "CN", 廣州: "CN", 深圳: "CN", 杭州: "CN", 成都: "CN",
  Beijing: "CN", Shanghai: "CN", Guangzhou: "CN", Shenzhen: "CN",
  // SEA
  新加坡: "SG", 吉隆坡: "MY", 檳城: "MY",
  Singapore: "SG", "Kuala Lumpur": "MY", Penang: "MY",
  曼谷: "TH", 清邁: "TH", 普吉: "TH",
  Bangkok: "TH", "Chiang Mai": "TH", Phuket: "TH",
  河內: "VN", 胡志明市: "VN", 峴港: "VN",
  Hanoi: "VN", "Ho Chi Minh City": "VN", "Da Nang": "VN",
  雅加達: "ID", 峇里島: "ID", 巴里島: "ID",
  Jakarta: "ID", Bali: "ID", Denpasar: "ID",
  馬尼拉: "PH", 宿霧: "PH",
  Manila: "PH", Cebu: "PH",
  // India / ME
  新德里: "IN", 孟買: "IN", 班加羅爾: "IN",
  Delhi: "IN", "New Delhi": "IN", Mumbai: "IN", Bengaluru: "IN",
  杜拜: "AE", Dubai: "AE",
  // Oceania
  雪梨: "AU", 墨爾本: "AU", 布里斯本: "AU",
  Sydney: "AU", Melbourne: "AU", Brisbane: "AU",
  奧克蘭: "NZ", 皇后鎮: "NZ",
  Auckland: "NZ", Queenstown: "NZ",
  // Americas
  紐約: "US", 洛杉磯: "US", 舊金山: "US", 西雅圖: "US", 拉斯維加斯: "US", 芝加哥: "US",
  "New York": "US", "Los Angeles": "US", "San Francisco": "US",
  Seattle: "US", "Las Vegas": "US", Chicago: "US",
  溫哥華: "CA", 多倫多: "CA",
  Vancouver: "CA", Toronto: "CA",
  墨西哥市: "MX", "Mexico City": "MX",
  里約: "BR", 聖保羅: "BR",
  Rio: "BR", "Rio de Janeiro": "BR", "São Paulo": "BR",
  // Europe
  倫敦: "GB", 愛丁堡: "GB",
  London: "GB", Edinburgh: "GB",
  巴黎: "FR", 尼斯: "FR",
  Paris: "FR", Nice: "FR",
  柏林: "DE", 慕尼黑: "DE",
  Berlin: "DE", Munich: "DE", München: "DE",
  羅馬: "IT", 米蘭: "IT", 威尼斯: "IT", 佛羅倫斯: "IT",
  Rome: "IT", Milan: "IT", Venice: "IT", Florence: "IT",
  巴塞隆納: "ES", 馬德里: "ES",
  Barcelona: "ES", Madrid: "ES",
  阿姆斯特丹: "NL", Amsterdam: "NL",
  蘇黎世: "CH", "Zurich": "CH", Zürich: "CH",
  維也納: "AT", Vienna: "AT", Wien: "AT",
  布拉格: "CZ", Prague: "CZ",
  布達佩斯: "HU", Budapest: "HU",
  華沙: "PL", Warsaw: "PL",
  雅典: "GR", Athens: "GR",
  伊斯坦堡: "TR", Istanbul: "TR",
  // Africa
  開羅: "EG", Cairo: "EG",
  開普敦: "ZA", "Cape Town": "ZA",
  奈洛比: "KE", Nairobi: "KE",
};

const LOOKUP = new Map<string, string>(
  Object.entries(RAW).map(([k, v]) => [k.toLowerCase(), v]),
);

export function cityToIso(city: string): string | null {
  if (!city) return null;
  return LOOKUP.get(city.trim().toLowerCase()) ?? null;
}
