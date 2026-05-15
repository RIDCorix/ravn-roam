# Roam — design source of truth

這個目錄是 Roam eSIM 消費端 app 的 **canonical design bundle**，從 Claude Design (claude.ai/design) 匯出，由 Ray 於 ROA-18 指定為 Phase 5（plan → dev）的設計依據。

## 怎麼看 prototype

雙擊 `design/app/index.html` 或在這個目錄起一個 static server：

```sh
cd design && python3 -m http.server 8080
# open http://localhost:8080/app/index.html
```

預設會看到 iPhone 14 frame 包住的消費端 app，五個 tab：首頁 / 行程 / 任務 / 商店 / 我。右下角 Tweaks panel 可以切「手機 / 響應」、TWD/USD。

## 內容對照表

| 路徑 | 用途 |
|---|---|
| `app/index.html` | Prototype 入口，React 18 + Babel CDN，掛載 `<App/>` |
| `app/colors_and_type.css` | Lume 設計系統 tokens — 顏色、字型、間距、陰影、圓角、easing |
| `app/components/Shell.jsx` | RWD shell：行動底部 tab bar / 桌面左側 rail |
| `app/components/Home.jsx` | 首頁：active eSIM hero、quick actions、Lumi 提醒、下趟行程預覽 |
| `app/components/Trips.jsx` | 行程列表 + Trip Detail（概覽 / Lumi / 清單三 tab） |
| `app/components/Lumi.jsx` | AI 對話介面（含 itinerary card、推薦 CTA） |
| `app/components/Tasks.jsx` | 跨行程任務聚合 |
| `app/components/Shop.jsx` | eSIM 商店（支援 prefilter）|
| `app/components/Profile.jsx` | 個人頁 + 設定 |
| `app/components/Primitives.jsx` | 共用元件 + Lucide-style icons |
| `app/components/Data.jsx` | Mock 資料（user / active eSIM / trips / shop products） |
| `app/tweaks-panel.jsx` | 開發用 tweaks 浮動 panel（**production port 不需要**） |
| `app/fonts/IntelOneMono-VariableFont_wght.ttf` | 品牌 mono 字型 |
| `assets/logo*.svg` | Roam 品牌 logo |
| `SYSTEM-README.md` | Claude Design 出包附的 handoff README（**讀這個來理解設計師意圖**） |
| `DESIGN-SYSTEM.md` | Lume 設計系統完整規格（color/type/spacing/motion/iconography） |
| `SKILL.md` | Lume skill 的 manifest（給未來 design agent 用）|

## Production port 對照（落到 `apps/web/`）

`apps/web/` 已經有 Next.js 16 + React 19 + Tailwind v4 + shadcn + Lume tokens（teal #0fb8b4 accent、Inter / Geist Mono 已透過 `next/font` 載入、shadcn token bridge 在 `apps/web/src/app/globals.css`）。Consumer app **不需要重新 scaffold**，直接擴充現有的 `(storefront)` route group。

| Prototype | 對應到 Next.js |
|---|---|
| `app/index.html` 整體 SPA | 擴充 `apps/web/src/app/[lang]/(storefront)/` route group（**Ray 拍板：用 storefront，不另開 `(app)`**）|
| `app/components/Shell.jsx` BottomNav + DesktopRail | `(storefront)/layout.tsx` + `apps/web/src/components/storefront/shell.tsx` — RWD via Tailwind `md:` breakpoint |
| `app/components/Home.jsx` | `(storefront)/page.tsx`（root tab）|
| `app/components/Trips.jsx` + Trip Detail | `(storefront)/trips/page.tsx`、`(storefront)/trips/[id]/page.tsx` |
| `app/components/Lumi.jsx` chat | `(storefront)/trips/[id]/lumi/page.tsx` 或內嵌 client component；**接 OpenAI 最便宜 model**（Ray 拍板，不是 Anthropic SDK）— 預期用 `gpt-4o-mini` 或 `gpt-5-nano` 之類 |
| `app/components/Tasks.jsx` | `(storefront)/tasks/page.tsx` |
| `app/components/Shop.jsx`（含 prefilter） | `(storefront)/shop/page.tsx`，filter 走 URL query (`?country=JP&days=7`)|
| `app/components/Profile.jsx` | `(storefront)/me/page.tsx` |
| `app/colors_and_type.css` | **已落** 在 `apps/web/src/app/globals.css`（mirrors Lume，含 shadcn token bridge）|
| Lucide CDN inline SVG | 用已安裝的 `lucide-react`（v1.14.0 in `apps/web/package.json`）|
| `app/components/Data.jsx` mock 資料 | 暫放 `apps/web/src/lib/mock/`；後續換成 `services/api` 的 Drizzle queries |
| Babel CDN runtime | Next.js 16 / SWC 直接吃 TSX；port `.jsx` 時轉 `.tsx` + 加型別 |
| iPhone phone frame mode | **不需移植**，那是 prototype 的預覽工具 |
| Tweaks panel | **不需移植**，那是 prototype 的開發工具 |
| Intel One Mono | **要切回**（Ray 拍板）— `apps/web` 目前用 Geist Mono，Phase B 改用 `next/font/local` 載入 `design/app/fonts/IntelOneMono-VariableFont_wght.ttf` |

> Tailwind v4 + shadcn 的 token 已從 Lume tokens bridge 過來，所以 shadcn primitives (`Button`, `Card`, `Tabs`, …) 直接套用就符合品牌色。**不要**在 component 裡寫死 hex，永遠用 `var(--accent)` 或 Tailwind `bg-primary` / `text-accent-foreground`。

## 重要 UX 細節（port 時必須保留）

1. **Active eSIM hero**：首頁 active eSIM 卡是漸層 teal，含使用量條 / 剩餘 GB / 訊號強度。沒 active eSIM 時這塊要換成 empty state（prototype 未做，是 follow-up）。
2. **Lumi 對話自動產出 itinerary card + 推 eSIM CTA**：使用者描述行程，Lumi 回覆裡會嵌 itinerary card（每日 city + sub-note），最後跟著一個「推薦 eSIM 方案」CTA → 跳到 Shop 並預先把國家 + 天數 filter 好。**這個 CTA → Shop 預篩流程是核心體驗**。
3. **Checklist 裡的 eSIM 捷徑**：任務清單裡 `kind: 'esim'` 的項目有 shortcut，點下去也跳 Shop pre-filtered。
4. **RWD 切換**：`< 900px` 用底部 tab bar，`≥ 900px` 用左側 rail（220px 寬）。在 Tailwind 等價是 `md:` (768px) 或自訂 breakpoint。
5. **語言預設 zh-TW**，幣別預設 TWD（已有 `[lang]` segment 支援 i18n）。

## Phase 5 落地策略（Ray 已 confirm 拆解）

| Phase | 內容 | 狀態 |
|---|---|---|
| A | Land design bundle + 對照表（本 PR）| **完成** |
| B | 擴充 `(storefront)`：Shell（bottom nav + desktop rail）+ Home + Intel One Mono via `next/font/local`，mock 資料先放 `apps/web/src/lib/mock/`| 一張 follow-up issue |
| C-1 | port Trips 列表 + Trip Detail（不含 Lumi tab）| issue |
| C-2 | port Lumi chat tab + 接 OpenAI `gpt-4o-mini` 或同級最便宜 model（streaming, server actions）| issue |
| C-3 | port Tasks | issue |
| C-4 | port Shop（含 URL-query prefilter）| issue |
| C-5 | port Profile | issue |
| D | 把 mock data 換成 `services/api` 的 Drizzle queries（trips、checklist、orders schema 需新增 migration）| 在 services/api 補 schema + routes |
| E | 下單金流 + active eSIM 真實狀態 | 後期 |

> **Port 原則**：視覺逐 pixel 重現，但內部結構**不照抄** prototype 的 single-file Babel runtime。`.jsx` → `.tsx`，inline style → Tailwind utility（除非有動態 token 需要走 CSS var），React class → shadcn / 自寫 component。Tokens 一律走 `globals.css` 的 CSS variables，**不要**手抄 hex。

## Caveats（從 SYSTEM-README.md 繼承）

- 沒有 Figma 來源，整套設計是 AI 生的，logo / illustrations 都是 placeholder。
- Sans 用 Inter 代 Geist / Satoshi。
- Mono 用 Intel One Mono variable font（`.ttf` 已內含；`apps/web` 目前用 Geist Mono，Phase B 會切回 Intel One Mono — Ray 拍板）。
- Lucide：prototype 用 CDN inline SVG；production 用 `lucide-react` package。
- 沒有 dark mode。
