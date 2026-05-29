// Curated promotional / seasonal events that surface in the /shop
// carousel. Stays in code (no CMS yet) — ops swap text/dates/links
// here and ship. Each event deep-links to a shop region (optionally
// pre-setting days/gb so the slider lands sensibly).

export interface ShopEvent {
  id: string;
  title: string; // event name in zh-TW
  subtitle?: string; // city / region context
  badge: string; // small date chip e.g. "3-4 月" / "現在熱門"
  cover: string; // /illustrations/cities/...
  regionSlug: string; // links into /shop/[slug]
  days?: number;
  gb?: number;
  /** Tinted accent over the photo for variety */
  tint?: "warm" | "cool" | "violet" | "ember" | "spring";
}

export const SHOP_EVENTS: ShopEvent[] = [
  {
    id: "jp-sakura",
    title: "日本櫻花季",
    subtitle: "東京 · 京都",
    badge: "3-4 月",
    cover: "/illustrations/cities/kyoto.jpg",
    regionSlug: "japan",
    days: 7,
    gb: 5,
    tint: "spring",
  },
  {
    id: "kr-foliage",
    title: "韓國楓葉季",
    subtitle: "首爾 · 釜山",
    badge: "10-11 月",
    cover: "/illustrations/cities/seoul.jpg",
    regionSlug: "korea",
    days: 6,
    gb: 5,
    tint: "ember",
  },
  {
    id: "okinawa-summer",
    title: "沖繩海祭",
    subtitle: "夏日離島",
    badge: "7 月",
    cover: "/illustrations/cities/okinawa.jpg",
    regionSlug: "japan",
    days: 5,
    gb: 3,
    tint: "cool",
  },
  {
    id: "kyoto-gion",
    title: "祇園祭",
    subtitle: "京都最大祭典",
    badge: "7 月",
    cover: "/illustrations/cities/kyoto.jpg",
    regionSlug: "japan",
    days: 4,
    gb: 3,
    tint: "ember",
  },
  {
    id: "paris-xmas",
    title: "巴黎聖誕市集",
    subtitle: "西歐冬季",
    badge: "12 月",
    cover: "/illustrations/cities/paris.jpg",
    regionSlug: "western-northern-europe",
    days: 10,
    gb: 8,
    tint: "violet",
  },
  {
    id: "venice-carnival",
    title: "威尼斯嘉年華",
    subtitle: "義大利面具狂歡",
    badge: "2 月",
    cover: "/illustrations/cities/rome.jpg",
    regionSlug: "europe",
    days: 7,
    gb: 5,
    tint: "warm",
  },
  {
    id: "nyc-newyear",
    title: "紐約跨年",
    subtitle: "Times Square 倒數",
    badge: "12 月底",
    cover: "/illustrations/cities/new-york.jpg",
    regionSlug: "usa",
    days: 5,
    gb: 5,
    tint: "cool",
  },
  {
    id: "sydney-nye",
    title: "雪梨跨年煙火",
    subtitle: "歌劇院 + 港灣大橋",
    badge: "12 月底",
    cover: "/illustrations/cities/sydney.jpg",
    regionSlug: "anz",
    days: 5,
    gb: 5,
    tint: "violet",
  },
];

export const TINT_GRADIENTS: Record<NonNullable<ShopEvent["tint"]>, string> = {
  warm: "linear-gradient(180deg, rgba(251,113,133,0.0) 30%, rgba(190,18,60,0.65) 100%)",
  cool: "linear-gradient(180deg, rgba(56,189,248,0.0) 30%, rgba(2,132,199,0.65) 100%)",
  violet:
    "linear-gradient(180deg, rgba(167,139,250,0.0) 30%, rgba(88,28,135,0.65) 100%)",
  ember:
    "linear-gradient(180deg, rgba(251,146,60,0.0) 30%, rgba(154,52,18,0.65) 100%)",
  spring:
    "linear-gradient(180deg, rgba(244,114,182,0.0) 30%, rgba(157,23,77,0.55) 100%)",
};
