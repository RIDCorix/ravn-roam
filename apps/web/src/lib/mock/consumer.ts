// Mock data for the consumer storefront screens. Mirrors
// design/app/components/Data.jsx so the Phase B port renders the same
// content as the prototype. Will be replaced by `services/api` Drizzle
// queries in Phase D — keep the shapes stable.

export interface ConsumerUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  joined: string;
  tier: string;
  homeCity: string;
}

export interface ActiveESIM {
  id: string;
  country: string;
  countryName: string;
  plan: string;
  used: number;
  total: number;
  daysLeft: number;
  daysTotal: number;
  installedAt: string;
  network: string;
  signal: 1 | 2 | 3 | 4;
  speed: string;
}

export type TripStatus = "active" | "upcoming" | "past";

export interface TripDay {
  d: string;
  city: string;
  note: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  kind: "esim" | "money" | "flight" | "stay" | "ticket" | "visa" | "doc" | "transit" | "gear" | "insurance";
  shortcut?: "shop";
  shopFilter?: { country: string; days?: number; gb?: number };
  due?: string;
  suggested?: boolean;
  suggestedBy?: "Lumi";
}

export interface Trip {
  id: string;
  title: string;
  cover: string;
  start: string;
  end: string;
  status: TripStatus;
  days: TripDay[];
  checklist: ChecklistItem[];
}

export const USER: ConsumerUser = {
  id: "u_chiaju",
  name: "家如",
  email: "chiaju.lin@gmail.com",
  initials: "CL",
  joined: "2024-03-11",
  tier: "Roam+",
  homeCity: "台北",
};

export const ACTIVE_ESIM: ActiveESIM = {
  id: "sim_jp_5",
  country: "JP",
  countryName: "日本",
  plan: "7 日 / 5GB",
  used: 1.24,
  total: 5.0,
  daysLeft: 4,
  daysTotal: 7,
  installedAt: "2025-09-15 11:42",
  network: "NTT docomo",
  signal: 4,
  speed: "4G+",
};

export const TODAY = "2025-09-19";

export const TRIPS: Trip[] = [
  {
    id: "trip_jp",
    title: "東京 + 京都",
    cover: "JP",
    start: "2025-09-15",
    end: "2025-09-22",
    status: "active",
    days: [
      { d: "2025-09-15", city: "東京", note: "入境 · 抵達羽田" },
      { d: "2025-09-16", city: "東京", note: "築地 + 銀座" },
      { d: "2025-09-17", city: "東京", note: "迪士尼海洋" },
      { d: "2025-09-18", city: "東京", note: "原宿 + 表參道" },
      { d: "2025-09-19", city: "京都", note: "搭新幹線 → 京都" },
      { d: "2025-09-20", city: "京都", note: "清水寺 + 祇園" },
      { d: "2025-09-21", city: "京都", note: "嵐山 + 竹林" },
      { d: "2025-09-22", city: "東京", note: "返國 · 羽田 19:40" },
    ],
    checklist: [
      { id: "t1", text: "購買日本 7 日 5GB eSIM", done: true,  kind: "esim", shortcut: "shop", shopFilter: { country: "JP", days: 7 } },
      { id: "t2", text: "兌換日圓 30,000", done: true, kind: "money" },
      { id: "t3", text: "查行李重量限制", done: true, kind: "flight" },
      { id: "t4", text: "訂京都民宿 (9/19 → 9/21)", done: true, kind: "stay" },
      { id: "t5", text: "預訂迪士尼海洋門票", done: false, kind: "ticket" },
      { id: "t6", text: "回程值機 (9/22 16:00 開放)", done: false, kind: "flight", due: "2025-09-22" },
    ],
  },
  {
    id: "trip_eu",
    title: "歐洲 5 國",
    cover: "EU",
    start: "2025-10-05",
    end: "2025-10-18",
    status: "upcoming",
    days: [
      { d: "2025-10-05", city: "巴黎",       note: "CDG 抵達 · 拉丁區" },
      { d: "2025-10-06", city: "巴黎",       note: "羅浮宮 + 塞納河" },
      { d: "2025-10-07", city: "巴黎",       note: "凡爾賽宮" },
      { d: "2025-10-08", city: "阿姆斯特丹", note: "搭 Thalys 早車" },
      { d: "2025-10-09", city: "阿姆斯特丹", note: "梵谷美術館" },
      { d: "2025-10-10", city: "柏林",       note: "搭夜車 → 柏林" },
      { d: "2025-10-11", city: "柏林",       note: "博物館島" },
      { d: "2025-10-12", city: "布拉格",     note: "搭 EC → 布拉格" },
      { d: "2025-10-13", city: "布拉格",     note: "舊城區" },
      { d: "2025-10-14", city: "倫敦",       note: "飛倫敦 (Eurowings)" },
      { d: "2025-10-15", city: "倫敦",       note: "大英博物館" },
      { d: "2025-10-16", city: "倫敦",       note: "Camden + Soho" },
      { d: "2025-10-17", city: "倫敦",       note: "備用 / shopping" },
      { d: "2025-10-18", city: "台北",       note: "希思羅 22:10 直飛桃園" },
    ],
    checklist: [
      { id: "eu1", text: "購買歐洲 30 國 + 英國 14 日 / 15GB eSIM", done: false, kind: "esim", shortcut: "shop", shopFilter: { country: "EU+UK", days: 14, gb: 15 }, suggested: true, suggestedBy: "Lumi" },
      { id: "eu2", text: "申請 ETA-UK (英國電子簽證)", done: false, kind: "visa", due: "2025-09-28", suggested: true, suggestedBy: "Lumi" },
      { id: "eu3", text: "兌換 €500 / £200", done: false, kind: "money" },
      { id: "eu4", text: "辦理國際駕照", done: true, kind: "doc" },
      { id: "eu5", text: "訂巴黎 → 阿姆斯特丹 Thalys 車票", done: false, kind: "transit", suggested: true, suggestedBy: "Lumi" },
      { id: "eu6", text: "帶轉接頭 (歐規 + 英規)", done: false, kind: "gear", suggested: true, suggestedBy: "Lumi" },
      { id: "eu7", text: "訂旅平險 + 海外不便險", done: false, kind: "insurance" },
    ],
  },
];

export function getActiveTrip(): Trip | undefined {
  return TRIPS.find((t) => t.status === "active");
}

export function getNextUpcomingTrip(): Trip | undefined {
  return TRIPS.filter((t) => t.status === "upcoming")
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function daysUntil(dateISO: string, fromISO: string = TODAY): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(dateISO).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function uniqueCities(trip: Trip): string[] {
  return Array.from(new Set(trip.days.map((d) => d.city)));
}
