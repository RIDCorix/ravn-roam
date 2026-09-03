// Fixture trip for the R-301 planner. Content, not product copy — it plays
// the role `lib/mock/consumer.ts` plays for the storefront, so the strings
// live here keyed by locale rather than in the dictionaries.
//
// The shape is chosen to exercise every acceptance criterion: two
// relocations (so stay segments and travel days both appear), all four item
// types, deliberately long titles in both locales, and a country/day count
// that resolves to a single-country shop region.

import type {
  PlannerChecklistItem,
  PlannerDay,
  PlannerItem,
  PlannerPlace,
  PlannerTrip,
} from "@/components/storefront/trips/planner/planner-model";

type Locale = "en" | "zh-TW";

type L = Record<Locale, string>;

function t(value: L, lang: Locale): string {
  return value[lang];
}

const PLACES: { key: string; name: L; lat: number; lng: number }[] = [
  { key: "tokyo", name: { en: "Tokyo", "zh-TW": "東京" }, lat: 35.6762, lng: 139.6503 },
  { key: "kyoto", name: { en: "Kyoto", "zh-TW": "京都" }, lat: 35.0116, lng: 135.7681 },
  { key: "osaka", name: { en: "Osaka", "zh-TW": "大阪" }, lat: 34.6937, lng: 135.5023 },
];

const TRIP_TITLE: L = {
  en: "Autumn in Honshu: Tokyo, Kyoto and Osaka in late November",
  "zh-TW": "晚秋本州：東京、京都與大阪的十一月行程",
};

const COUNTRY: L = { en: "Japan", "zh-TW": "日本" };

interface RawItem {
  id: string;
  type: PlannerItem["type"];
  title: L;
  date: string;
  startTime: string;
  durationMin: number;
  ticket: { state: PlannerItem["ticket"]["state"]; label: L };
  lat?: number;
  lng?: number;
  fields: Record<string, L>;
}

const ITEMS: RawItem[] = [
  {
    id: "item-flight-in",
    type: "flight",
    title: { en: "Flight to Haneda", "zh-TW": "飛往羽田" },
    date: "2026-11-10",
    startTime: "08:40",
    durationMin: 235,
    ticket: { state: "attached", label: { en: "boarding-pass.pdf", "zh-TW": "boarding-pass.pdf" } },
    fields: {
      airline: { en: "Japan Airlines", "zh-TW": "日本航空" },
      flightNumber: { en: "JL 802", "zh-TW": "JL 802" },
      origin: { en: "Taipei Taoyuan (TPE)", "zh-TW": "臺北桃園 (TPE)" },
      destination: { en: "Tokyo Haneda (HND)", "zh-TW": "東京羽田 (HND)" },
      ticketReference: { en: "JL-4471-QX", "zh-TW": "JL-4471-QX" },
    },
  },
  {
    id: "item-stay-tokyo",
    type: "stay",
    title: { en: "Check in, Shinjuku", "zh-TW": "入住新宿" },
    date: "2026-11-10",
    startTime: "15:00",
    durationMin: 60,
    ticket: { state: "needed", label: { en: "Upload the confirmation", "zh-TW": "上傳訂房確認信" } },
    lat: 35.6895,
    lng: 139.7004,
    fields: {
      property: { en: "Hotel Kanade Shinjuku", "zh-TW": "新宿奏飯店" },
      checkIn: { en: "2026-11-10", "zh-TW": "2026-11-10" },
      checkOut: { en: "2026-11-13", "zh-TW": "2026-11-13" },
      bookingReference: { en: "HK-2026-118", "zh-TW": "HK-2026-118" },
    },
  },
  {
    id: "item-sensoji",
    type: "place",
    title: { en: "Sensō-ji at dusk", "zh-TW": "黃昏的淺草寺" },
    date: "2026-11-10",
    startTime: "17:30",
    durationMin: 90,
    ticket: { state: "missing", label: { en: "No ticket needed", "zh-TW": "不需要票券" } },
    lat: 35.7148,
    lng: 139.7967,
    fields: {
      placeName: { en: "Sensō-ji", "zh-TW": "淺草寺" },
      admission: { en: "Free", "zh-TW": "免費" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
  {
    id: "item-meiji",
    type: "place",
    title: {
      en: "Meiji Jingu shrine walk and the Harajuku back streets loop",
      "zh-TW": "明治神宮參道散步與原宿裏參道巷弄環線",
    },
    date: "2026-11-11",
    startTime: "09:15",
    durationMin: 150,
    ticket: { state: "missing", label: { en: "No ticket needed", "zh-TW": "不需要票券" } },
    lat: 35.6764,
    lng: 139.6993,
    fields: {
      placeName: { en: "Meiji Jingu", "zh-TW": "明治神宮" },
      admission: { en: "Free, inner garden 500 JPY", "zh-TW": "免費，御苑 500 日圓" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
  {
    id: "item-teamlab",
    type: "place",
    title: { en: "teamLab Planets", "zh-TW": "teamLab Planets" },
    date: "2026-11-11",
    startTime: "14:00",
    durationMin: 120,
    ticket: { state: "attached", label: { en: "timed-entry.png", "zh-TW": "timed-entry.png" } },
    lat: 35.6247,
    lng: 139.7799,
    fields: {
      placeName: { en: "teamLab Planets Toyosu", "zh-TW": "teamLab Planets 豐洲" },
      admission: { en: "Timed entry, 14:00", "zh-TW": "指定入場，14:00" },
      bookingReference: { en: "TLP-99120", "zh-TW": "TLP-99120" },
    },
  },
  {
    id: "item-shibuya",
    type: "place",
    title: { en: "Shibuya Sky", "zh-TW": "澀谷 Sky" },
    date: "2026-11-12",
    startTime: "16:20",
    durationMin: 75,
    ticket: { state: "needed", label: { en: "Upload the e-ticket", "zh-TW": "上傳電子票券" } },
    lat: 35.658,
    lng: 139.7016,
    fields: {
      placeName: { en: "Shibuya Scramble Square", "zh-TW": "澀谷 Scramble Square" },
      admission: { en: "Sunset slot", "zh-TW": "日落時段" },
      bookingReference: { en: "SBS-7781", "zh-TW": "SBS-7781" },
    },
  },
  {
    id: "item-metro",
    type: "transport",
    title: { en: "Metro to Shinjuku", "zh-TW": "地鐵回新宿" },
    date: "2026-11-12",
    startTime: "18:10",
    durationMin: 25,
    ticket: { state: "attached", label: { en: "IC card topped up", "zh-TW": "IC 卡已加值" } },
    fields: {
      mode: { en: "Metro", "zh-TW": "地鐵" },
      origin: { en: "Shibuya", "zh-TW": "澀谷" },
      destination: { en: "Shinjuku", "zh-TW": "新宿" },
      ticketReference: { en: "IC card", "zh-TW": "IC 卡" },
    },
  },
  {
    id: "item-shinkansen",
    type: "transport",
    title: { en: "Nozomi to Kyoto", "zh-TW": "希望號前往京都" },
    date: "2026-11-13",
    startTime: "10:03",
    durationMin: 138,
    ticket: { state: "attached", label: { en: "seat-reservation.pdf", "zh-TW": "seat-reservation.pdf" } },
    fields: {
      mode: { en: "Shinkansen", "zh-TW": "新幹線" },
      origin: { en: "Tokyo", "zh-TW": "東京" },
      destination: { en: "Kyoto", "zh-TW": "京都" },
      ticketReference: { en: "NZ-221-A", "zh-TW": "NZ-221-A" },
    },
  },
  {
    id: "item-stay-kyoto",
    type: "stay",
    title: { en: "Check in, Gion", "zh-TW": "入住祇園" },
    date: "2026-11-13",
    startTime: "15:30",
    durationMin: 45,
    ticket: { state: "needed", label: { en: "Upload the confirmation", "zh-TW": "上傳訂房確認信" } },
    lat: 35.0036,
    lng: 135.7681,
    fields: {
      property: { en: "Ryokan Nishiyama", "zh-TW": "西山旅館" },
      checkIn: { en: "2026-11-13", "zh-TW": "2026-11-13" },
      checkOut: { en: "2026-11-16", "zh-TW": "2026-11-16" },
      bookingReference: { en: "RY-5520", "zh-TW": "RY-5520" },
    },
  },
  {
    id: "item-fushimi",
    type: "place",
    title: { en: "Fushimi Inari before the crowds", "zh-TW": "人潮前的伏見稻荷" },
    date: "2026-11-14",
    startTime: "07:00",
    durationMin: 120,
    ticket: { state: "missing", label: { en: "No ticket needed", "zh-TW": "不需要票券" } },
    lat: 34.9671,
    lng: 135.7727,
    fields: {
      placeName: { en: "Fushimi Inari Taisha", "zh-TW": "伏見稻荷大社" },
      admission: { en: "Free", "zh-TW": "免費" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
  {
    id: "item-kiyomizu",
    type: "place",
    title: { en: "Kiyomizu-dera", "zh-TW": "清水寺" },
    date: "2026-11-14",
    startTime: "13:00",
    durationMin: 110,
    ticket: { state: "missing", label: { en: "Pay at the gate", "zh-TW": "現場購票" } },
    lat: 34.9949,
    lng: 135.785,
    fields: {
      placeName: { en: "Kiyomizu-dera", "zh-TW": "清水寺" },
      admission: { en: "400 JPY", "zh-TW": "400 日圓" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
  {
    id: "item-arashiyama",
    type: "place",
    title: { en: "Arashiyama bamboo grove and the Ōi riverbank walk", "zh-TW": "嵐山竹林與大堰川河岸散步" },
    date: "2026-11-15",
    startTime: "08:30",
    durationMin: 180,
    ticket: { state: "missing", label: { en: "No ticket needed", "zh-TW": "不需要票券" } },
    lat: 35.0094,
    lng: 135.6668,
    fields: {
      placeName: { en: "Arashiyama", "zh-TW": "嵐山" },
      admission: { en: "Free", "zh-TW": "免費" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
  {
    id: "item-limited-express",
    type: "transport",
    title: { en: "Limited express to Osaka", "zh-TW": "特急前往大阪" },
    date: "2026-11-16",
    startTime: "11:20",
    durationMin: 55,
    ticket: { state: "needed", label: { en: "Upload the seat receipt", "zh-TW": "上傳劃位收據" } },
    fields: {
      mode: { en: "Limited express", "zh-TW": "特急列車" },
      origin: { en: "Kyoto", "zh-TW": "京都" },
      destination: { en: "Osaka", "zh-TW": "大阪" },
      ticketReference: { en: "LX-3390", "zh-TW": "LX-3390" },
    },
  },
  {
    id: "item-stay-osaka",
    type: "stay",
    title: { en: "Check in, Namba", "zh-TW": "入住難波" },
    date: "2026-11-16",
    startTime: "14:00",
    durationMin: 40,
    ticket: { state: "attached", label: { en: "booking.pdf", "zh-TW": "booking.pdf" } },
    lat: 34.7025,
    lng: 135.4959,
    fields: {
      property: { en: "Namba Court Hotel", "zh-TW": "難波庭園飯店" },
      checkIn: { en: "2026-11-16", "zh-TW": "2026-11-16" },
      checkOut: { en: "2026-11-18", "zh-TW": "2026-11-18" },
      bookingReference: { en: "NC-8813", "zh-TW": "NC-8813" },
    },
  },
  {
    id: "item-dotonbori",
    type: "place",
    title: { en: "Dōtonbori at night", "zh-TW": "夜晚的道頓堀" },
    date: "2026-11-17",
    startTime: "18:00",
    durationMin: 120,
    ticket: { state: "missing", label: { en: "No ticket needed", "zh-TW": "不需要票券" } },
    lat: 34.6687,
    lng: 135.5013,
    fields: {
      placeName: { en: "Dōtonbori", "zh-TW": "道頓堀" },
      admission: { en: "Free", "zh-TW": "免費" },
      bookingReference: { en: "—", "zh-TW": "—" },
    },
  },
];

const DAYS: {
  date: string;
  placeKey: string;
  travel?: { from: string; to: string };
}[] = [
  { date: "2026-11-10", placeKey: "tokyo" },
  { date: "2026-11-11", placeKey: "tokyo" },
  { date: "2026-11-12", placeKey: "tokyo" },
  { date: "2026-11-13", placeKey: "kyoto", travel: { from: "tokyo", to: "kyoto" } },
  { date: "2026-11-14", placeKey: "kyoto" },
  { date: "2026-11-15", placeKey: "kyoto" },
  { date: "2026-11-16", placeKey: "osaka", travel: { from: "kyoto", to: "osaka" } },
  { date: "2026-11-17", placeKey: "osaka" },
];

const CHECKLIST: {
  id: string;
  text: L;
  done: boolean;
  kind: string;
  shopFilter?: { country: string; days?: number };
}[] = [
  {
    id: "check-esim",
    text: { en: "Choose a Japan eSIM", "zh-TW": "選擇日本 eSIM" },
    done: false,
    kind: "esim",
    shopFilter: { country: "JP", days: 8 },
  },
  {
    id: "check-rail",
    text: { en: "Reserve the Nozomi seats", "zh-TW": "預訂希望號座位" },
    done: true,
    kind: "transit",
  },
  {
    id: "check-cash",
    text: { en: "Order yen before flying", "zh-TW": "出發前換好日圓" },
    done: false,
    kind: "money",
  },
];

function buildItem(raw: RawItem, lang: Locale): PlannerItem {
  const base = {
    id: raw.id,
    title: t(raw.title, lang),
    date: raw.date,
    startTime: raw.startTime,
    durationMin: raw.durationMin,
    ticket: { state: raw.ticket.state, label: t(raw.ticket.label, lang) },
    lat: raw.lat,
    lng: raw.lng,
  };
  const field = (key: string): string => t(raw.fields[key]!, lang);

  switch (raw.type) {
    case "flight":
      return {
        ...base,
        type: "flight",
        fields: {
          airline: field("airline"),
          flightNumber: field("flightNumber"),
          origin: field("origin"),
          destination: field("destination"),
          ticketReference: field("ticketReference"),
        },
      };
    case "transport":
      return {
        ...base,
        type: "transport",
        fields: {
          mode: field("mode"),
          origin: field("origin"),
          destination: field("destination"),
          ticketReference: field("ticketReference"),
        },
      };
    case "stay":
      return {
        ...base,
        type: "stay",
        fields: {
          property: field("property"),
          checkIn: field("checkIn"),
          checkOut: field("checkOut"),
          bookingReference: field("bookingReference"),
        },
      };
    default:
      return {
        ...base,
        type: "place",
        fields: {
          placeName: field("placeName"),
          admission: field("admission"),
          bookingReference: field("bookingReference"),
        },
      };
  }
}

export function buildPlannerFixtureTrip(lang: string): PlannerTrip {
  const locale: Locale = lang === "zh-TW" ? "zh-TW" : "en";
  const placeName = (key: string): string =>
    t(PLACES.find((place) => place.key === key)!.name, locale);

  const places: PlannerPlace[] = PLACES.map((place) => ({
    key: place.key,
    name: t(place.name, locale),
    lat: place.lat,
    lng: place.lng,
  }));

  const days: PlannerDay[] = DAYS.map((day) => ({
    date: day.date,
    placeKey: day.placeKey,
    place: placeName(day.placeKey),
    travel: day.travel
      ? { from: placeName(day.travel.from), to: placeName(day.travel.to) }
      : undefined,
    items: ITEMS.filter((item) => item.date === day.date).map((item) =>
      buildItem(item, locale),
    ),
  }));

  const checklist: PlannerChecklistItem[] = CHECKLIST.map((item) => ({
    id: item.id,
    text: t(item.text, locale),
    done: item.done,
    kind: item.kind,
    shopFilter: item.shopFilter,
  }));

  return {
    id: "planner-japan-autumn",
    title: t(TRIP_TITLE, locale),
    countryCode: "JP",
    countryName: t(COUNTRY, locale),
    places,
    days,
    checklist,
  };
}
