"use client";

import {
  JourneyStudio,
  type JourneyStepFetcher,
  type JourneyStepPayload,
  type JourneyStepResponse,
  type JourneyStudioLabels,
} from "@/components/storefront/trips/journey-studio";
import type { TripDraft } from "@/components/storefront/trips/lumi-assistant";

const CITY_COORDS: Record<string, [number, number]> = {
  米蘭: [45.4642, 9.19],
  巴黎: [48.8566, 2.3522],
  巴塞隆納: [41.3874, 2.1686],
};

const DEMO_FRAME = {
  title: "歐洲設計之旅",
  origin: "台北",
  start_date: "2026-09-25",
  end_date: "2026-10-02",
  cities: [
    { name: "米蘭", country_code: "IT", nights: 3, reason: "設計週與選物店", lat: CITY_COORDS["米蘭"]![0], lng: CITY_COORDS["米蘭"]![1] },
    { name: "巴黎", country_code: "FR", nights: 2, reason: "美術館與 Le Marais", lat: CITY_COORDS["巴黎"]![0], lng: CITY_COORDS["巴黎"]![1] },
    { name: "巴塞隆納", country_code: "ES", nights: 2, reason: "高第建築", lat: CITY_COORDS["巴塞隆納"]![0], lng: CITY_COORDS["巴塞隆納"]![1] },
  ],
};

const DEMO_ANCHORS = [
  {
    city: "米蘭",
    anchors: [
      { name: "米蘭大教堂登頂", place_name: "Duomo di Milano", kind: "sight", note: "屋頂平台看整座城" },
      { name: "Brera 設計選物", place_name: "10 Corso Como", kind: "shop", note: "概念店始祖" },
      { name: "Navigli 運河晚餐", place_name: "Rita & Cocktails", kind: "meal", note: "傍晚運河最美" },
    ],
  },
  {
    city: "巴黎",
    anchors: [
      { name: "奧塞美術館", place_name: "Musée d'Orsay", kind: "sight", note: "印象派必看" },
      { name: "Le Marais 選物散步", place_name: "Merci Paris", kind: "shop", note: "設計與古著聚落" },
      { name: "晚餐 Septime", place_name: "Septime", kind: "meal", note: "需提前一個月訂位" },
    ],
  },
  {
    city: "巴塞隆納",
    anchors: [
      { name: "聖家堂", place_name: "Sagrada Família", kind: "sight", note: "先買塔樓票" },
      { name: "巴特婁之家", place_name: "Casa Batlló", kind: "sight", note: "高第的海洋幻想" },
      { name: "波蓋利亞市場", place_name: "Mercado de La Boqueria", kind: "meal", note: "午餐就在市場解決" },
    ],
  },
];

function demoDays(city: string, dates: string[]) {
  const stopsByCity: Record<string, { name: string; kind: string; note: string }[]> = {
    米蘭: [
      { name: "Duomo di Milano", kind: "sight", note: "登頂看大教堂屋頂" },
      { name: "Galleria Vittorio Emanuele II", kind: "sight", note: "走進玻璃拱廊" },
      { name: "10 Corso Como", kind: "shop", note: "概念店始祖" },
      { name: "Navigli 運河晚餐", kind: "meal", note: "傍晚最美" },
    ],
    巴黎: [
      { name: "Musée d'Orsay", kind: "sight", note: "印象派館藏" },
      { name: "Merci Paris", kind: "shop", note: "Le Marais 設計選物" },
      { name: "Septime", kind: "meal", note: "需提前訂位" },
    ],
    巴塞隆納: [
      { name: "Sagrada Família", kind: "sight", note: "先買票免排隊" },
      { name: "Casa Batlló", kind: "sight", note: "晚上有燈光場" },
      { name: "Mercado de La Boqueria", kind: "meal", note: "市場午餐" },
    ],
  };
  return dates.map((date, index) => ({
    day_date: date,
    city,
    cities: [city],
    note: index === 0 ? `抵達${city}` : `${city}重點日`,
    stops: stopsByCity[city] ?? [],
  }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isSlowDemo = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("slow");

const demoFetcher: JourneyStepFetcher = async (
  payload: JourneyStepPayload,
): Promise<JourneyStepResponse> => {
  await sleep(1400);
  if (!payload.frame) {
    if (payload.qa.length === 0) {
      return {
        step: "frame",
        status: "question",
        question: {
          text: "想什麼時候出發？整趟大概幾天？",
          options: ["9/25 出發，8 天", "10 月初出發，10 天", "還沒定，給我建議"],
        },
      };
    }
    return { step: "frame", status: "complete", frame: DEMO_FRAME };
  }
  if (!payload.anchors) {
    await sleep(800);
    return { step: "anchors", status: "complete", anchors: DEMO_ANCHORS };
  }
  const planned = new Set(payload.days.map((day) => day.day_date));
  const blocks: Array<{ city: string; dates: string[] }> = [
    { city: "米蘭", dates: ["2026-09-25", "2026-09-26", "2026-09-27"] },
    { city: "巴黎", dates: ["2026-09-28", "2026-09-29"] },
    { city: "巴塞隆納", dates: ["2026-09-30", "2026-10-01", "2026-10-02"] },
  ];
  const block = blocks.find((b) => b.dates.some((d) => !planned.has(d)));
  if (!block) throw new Error("demo: no block left");
  await sleep(isSlowDemo() ? 7000 : 1200);
  const days = demoDays(block.city, block.dates);
  const finished = block.city === "巴塞隆納";
  return {
    step: "days",
    status: "complete",
    days,
    block_city: block.city,
    finished,
    trip_draft: finished
      ? ({
          title: DEMO_FRAME.title,
          start_date: DEMO_FRAME.start_date,
          end_date: DEMO_FRAME.end_date,
          cover: "米蘭",
          days: [...payload.days, ...days],
          checklist: [
            { text: "確認航班與住宿資訊", kind: "flight" },
            { text: "準備歐洲 eSIM 方案", kind: "esim" },
          ],
        } as TripDraft)
      : null,
  };
};

const demoCreateTrip = async () => {
  await sleep(1000);
  return "00000000-0000-0000-0000-00000000demo";
};

export function JourneyStudioFixture({
  lang,
  labels,
  live,
}: {
  lang: string;
  labels: JourneyStudioLabels;
  live: boolean;
}) {
  return (
    <JourneyStudio
      lang={lang}
      labels={labels}
      initialPrompt="9/25 出發 8 天，想去米蘭看設計、巴黎逛美術館，最後去巴塞隆納看高第。"
      {...(live ? {} : { stepFetcher: demoFetcher, createTrip: demoCreateTrip })}
    />
  );
}
