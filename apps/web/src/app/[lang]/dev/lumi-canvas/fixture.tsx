"use client";

import { useState } from "react";

import { getLumiAvatar } from "@/components/storefront/lumi-avatar";
import {
  JourneyDraftingCanvas,
  type JourneyDraftSession,
  type LumiAssistantLabels,
} from "@/components/storefront/trips/lumi-assistant";

const FIXTURE_PROMPT =
  "歐洲 17 天行程（9/25-10/11）✈️ 9/25 台北 → 米蘭（夜宿機上）── Milan｜2晚 9/26（Day 1）Duomo di Milano・Brera 區散步・晚餐 Navigli 運河區 ── 9/27（Day 2）設計選物店巡禮・家具…";

const FIXTURE_DRAFT = {
  title: "歐洲設計之旅",
  start_date: "2026-09-25",
  end_date: "2026-09-29",
  cover: "米蘭",
  days: [
    {
      day_date: "2026-09-25",
      city: "台北",
      cities: ["台北", "米蘭"],
      note: "出發日",
      stops: [
        { name: "前往桃園機場", kind: "transit", note: "預留報到與安檢時間" },
        { name: "抵達米蘭機場", kind: "transit", note: "領行李後搭機場快線進城" },
      ],
    },
    {
      day_date: "2026-09-26",
      city: "米蘭",
      note: "米蘭設計",
      stops: [
        { name: "Duomo di Milano", kind: "sight", note: "登頂看大教堂屋頂" },
        { name: "Galleria Vittorio Emanuele II", kind: "sight" },
        { name: "Brera 區設計選物", kind: "shop" },
        { name: "Navigli 運河晚餐", kind: "meal" },
        { name: "10 Corso Como", kind: "shop" },
      ],
    },
    {
      day_date: "2026-09-27",
      city: "米蘭",
      cities: ["米蘭", "巴黎"],
      note: "夜飛巴黎",
      stops: [
        { name: "Fondazione Prada", kind: "sight", note: "當代藝術重鎮" },
        { name: "米蘭馬爾彭薩機場", kind: "transit" },
        { name: "巴黎戴高樂機場", kind: "transit" },
      ],
    },
    {
      day_date: "2026-09-28",
      city: "巴黎",
      cities: ["巴黎", "巴塞隆納"],
      note: "Le Marais",
      stops: [
        { name: "Musée d'Orsay", kind: "sight", note: "印象派館藏" },
        { name: "Le Marais 散步選物", kind: "shop" },
        { name: "Septime", kind: "meal", note: "需提前訂位" },
      ],
    },
    {
      day_date: "2026-09-29",
      city: "巴塞隆納",
      cities: ["巴塞隆納", "倫敦"],
      note: "高第日",
      stops: [
        { name: "Sagrada Família", kind: "sight", note: "先買票免排隊" },
        { name: "Casa Batlló", kind: "sight" },
        { name: "El Nacional", kind: "meal" },
      ],
    },
  ],
  checklist: [
    {
      text: "確認航班與住宿資訊",
      kind: "flight",
      description: "去回程時間異動要同步住宿",
    },
    {
      text: "準備歐洲 eSIM 方案",
      kind: "esim",
      description: "出發前先安裝、落地再啟用",
    },
    {
      text: "預訂 Septime 晚餐",
      kind: "ticket",
      description: "巴黎熱門餐廳需提前訂位",
    },
  ],
};

type FixtureMode = "drafting" | "focus" | "ready" | "failed";

function sessionForMode(mode: FixtureMode): JourneyDraftSession {
  if (mode === "ready") {
    return {
      id: "fixture-ready",
      prompt: FIXTURE_PROMPT,
      status: "ready",
      stage: "prep",
      events: [
        {
          event: "tool_result",
          tool_name: "stage_trip_draft_days",
          status: "success",
          staged_days: 5,
        },
      ],
      startedAt: "2026-06-11T00:00:00.000Z",
      draft: FIXTURE_DRAFT,
    };
  }
  if (mode === "failed") {
    return {
      id: "fixture-failed",
      prompt: FIXTURE_PROMPT,
      status: "failed",
      stage: "places",
      events: [],
      startedAt: "2026-06-11T00:00:00.000Z",
      draft: null,
      error: "OpenAI request timed out",
    };
  }
  if (mode === "focus") {
    return {
      id: "fixture-focus",
      prompt: FIXTURE_PROMPT,
      status: "drafting",
      stage: "route",
      events: [
        {
          event: "tool_result",
          tool_name: "stage_trip_draft_days",
          status: "success",
          staged_days: 1,
          days_preview: [
            {
              day_date: "2026-09-25",
              city: "台北",
              cities: ["台北", "米蘭"],
              stop_names: ["前往桃園機場", "抵達米蘭機場"],
              stop_count: 2,
            },
          ],
        },
        {
          event: "tool_result",
          tool_name: "stage_trip_draft_days",
          status: "success",
          staged_days: 2,
          days_preview: [
            {
              day_date: "2026-09-26",
              city: "米蘭",
              cities: ["米蘭"],
              stop_names: [
                "Duomo di Milano",
                "Galleria Vittorio Emanuele II",
                "Brera 區設計選物",
                "Navigli 運河晚餐",
              ],
              stop_count: 5,
            },
          ],
        },
      ],
      startedAt: "2026-06-11T00:00:00.000Z",
      draft: null,
    };
  }
  return {
    id: "fixture-drafting",
    prompt: FIXTURE_PROMPT,
    status: "drafting",
    stage: "places",
    events: [
      {
        event: "tool_call",
        tool_name: "stage_trip_draft_days",
        label: "Drafting itinerary days",
      },
    ],
    startedAt: "2026-06-11T00:00:00.000Z",
    draft: null,
  };
}

export function LumiCanvasFixture({
  lang,
  labels,
}: {
  lang: string;
  labels: LumiAssistantLabels;
}) {
  const [mode, setMode] = useState<FixtureMode>("drafting");
  return (
    <div className="min-h-screen bg-bg">
      <JourneyDraftingCanvas
        session={sessionForMode(mode)}
        labels={labels}
        avatar={getLumiAvatar(undefined)}
        lang={lang}
        onClose={() => undefined}
        onRetry={() => undefined}
        onCreate={() => undefined}
      />
      <div className="fixed bottom-4 left-4 z-[60] flex gap-2 rounded-full border border-divider bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur">
        {(["drafting", "focus", "ready", "failed"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            data-mode={m}
            className={
              m === mode
                ? "rounded-full bg-fg px-3 py-1 text-[12px] font-semibold text-white"
                : "rounded-full px-3 py-1 text-[12px] font-medium text-fg-muted hover:text-fg"
            }
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
