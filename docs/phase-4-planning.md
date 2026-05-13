# Phase 4 規劃 — Ordering, fulfillment & inventory orchestration

> Source-of-truth planning doc for **eSIM Platform — Phase 4**.
> Linear: [ROA-17](https://linear.app/ravn-roam/issue/ROA-17/kick-off-phase-4-planning)
> Status: **draft / kick-off**（規劃啟動，尚未進入 spec 階段）
> Last updated: 2026-05-13

---

## 0. TL;DR

Phase 4 要回答的核心問題只有一個：
**「從 customer 按下『購買』，到他手機裡裝好一張可用的 eSIM，這條路上每一個 state、每一個介接、每一條失敗分支該怎麼走？」**

這份文件把這條路切成 5 個 spec 區塊，列出每一塊的 scope、跨 phase 依賴與 open questions，並對應 5 張 follow-up issues。**它本身不是 spec**，是 spec 工作的 framing document。

**Critical dependency**：Phase 1（domain model）/ Phase 2（supplier catalog）/ Phase 3（vendor & pricing）目前都還是空白的 kick-off issue（ROA-14 / ROA-15 / ROA-16）。Phase 4 的 spec 可以**起草**，但要 finalize 必須先等 Phase 1 的 Order entity 與 Phase 2 的 supplier adapter contract 落地。詳見 §7。

---

## 1. Scope

### 1.1 In scope

| 範圍 | 說明 |
|---|---|
| Order lifecycle | 從 cart → checkout → paid → fulfilled → delivered → activated → terminal 的完整 state machine |
| Supplier ordering | packaged product → supplier raw plan 的選擇、upstream API 呼叫、idempotency、fallback |
| Fulfillment payload | ICCID / activation code / LPA / QR / 安裝說明 / validity window 等 customer-facing artifacts |
| Delivery methods | email、in-app inbox、可能的 vendor 端 webhook |
| Failure handling | 分類、retry policy、manual review queue、自動 fallback 規則 |
| Refund flow | 觸發條件、退款 state、金流串接邊界、audit |
| Reissue flow | replacement eSIM 的觸發、與原 order 的關聯、計價策略 |
| Inventory / allocation | 同時支援 on-demand 與 pre-allocated pool 兩種 supplier model；跨 supplier 的 allocation policy |
| Audit | 每個 state transition、每次 supplier 互動、每筆 ops 動作的不可變紀錄 |
| Manual operations | ops console 上要做什麼動作、queue 從哪來、誰能做 |

### 1.2 Out of scope（在 Phase 4 不解）

| 項目 | 推到哪 |
|---|---|
| Customer 端 redemption / install UX | Phase 5（storefront & redemption experience） |
| Vendor commission 計算與結算 | Phase 6（commissions, settlement & operations） |
| 通路經銷 / pricing rules 本體 | Phase 3（vendor hierarchy, pricing & promotions） |
| Supplier API 細節（具體 endpoint / payload） | Phase 2（supplier catalog）— Phase 4 只定 adapter contract |
| Customer entity / authn / authz | Phase 1（domain model） |

**邊界規則**：當不確定某件事屬於 Phase 4 還是別 phase，預設留在 Phase 4 寫一個 placeholder section（"depends on Phase X"），不在這份文件內擴張定義。

---

## 2. 從 sale 到 delivered eSIM 的操作流（the canonical path）

下面這條 happy path 是整個 Phase 4 規劃的脊椎。每一個 spec 區塊都會 reference 回這裡的 state name。

```
[customer 加購]
   │
   ▼
 cart ─────────► pending_payment ──(payment captured)──► paid
                                                          │
                                                          ▼
                                                     fulfilling ◄─────┐
                                                          │           │ retry
                                          ┌───────────────┼──────────┐│
                                          ▼               ▼          ▼│
                                  supplier_ok      supplier_failed  manual_review
                                          │               │          │
                                          ▼               └──────────┘ (ops 介入)
                                     fulfilled
                                          │
                                          ▼
                                     delivered ──(customer install)──► activated
                                                                         │
                                                                         ▼
                                                                      expired
                                          │
                                          ├─► cancelled  (任何時點 pre-fulfilled 可取消)
                                          ├─► refunded   (退款已完成)
                                          └─► reissued   (補發後 original 進入此終態)
```

### 2.1 State 定義

| State | 進入條件 | 退出條件 | 是否終態 |
|---|---|---|---|
| `cart` | customer 加入購物車 | checkout / abandon | 否 |
| `pending_payment` | checkout 送出，金流授權中 | 金流結果 | 否 |
| `paid` | 金流 capture 成功 | fulfillment scheduler 拉走 | 否 |
| `fulfilling` | scheduler 開始呼 supplier | supplier 回應 / 達 retry 上限 | 否 |
| `supplier_failed` | supplier 回 transient error | retry / 升 manual | 否（中繼） |
| `manual_review` | 超過 retry 上限 / 永久錯誤 | ops 動作（retry / refund / reissue / cancel） | 否 |
| `fulfilled` | supplier 回 ICCID + 啟用資料 | delivery scheduler 處理 | 否 |
| `delivered` | 通知通道送出（email sent / inbox 投遞） | customer 啟用 / 過期 | 否 |
| `activated` | supplier 回報 activation（webhook 或 polling） | 用量耗盡 / 時效到 | 否 |
| `expired` | 時效到 / 流量耗盡 | — | **是** |
| `cancelled` | pre-fulfilled 客退或 ops 取消 | — | **是** |
| `refunded` | 退款完成 | — | **是** |
| `reissued` | 補發 ack（新 order 與原 order 雙向 link） | — | **是** |

### 2.2 不允許的轉換

- `delivered` → `cancelled`（已交付才退錢必須走 `refunded` 或 `reissued`，audit trail 才完整）
- `activated` → `cancelled`（同上）
- `expired` 為單向終態，無法復活；要再次提供服務只能新 order
- 任何 terminal state 不得回到 non-terminal

---

## 3. Order lifecycle spec（→ follow-up issue 1）

### 3.1 Order 的資料模型骨架

> **依賴 Phase 1**：Order / OrderLine / Customer / Vendor entity 由 Phase 1 定義；這裡只列 Phase 4 額外需要的欄位。

`Order`
- `id`
- `state`（見 §2.1）
- `customer_id`
- `vendor_id`（attribute 銷售歸屬，用於 Phase 6 結算）
- `placed_at` / `paid_at` / `fulfilled_at` / `delivered_at` / `terminal_at`
- `payment_intent_id`（金流側 reference）
- `total_amount` / `currency`
- `metadata`（自由格式 JSON：promo code、source、locale）

`OrderLine`
- `id`
- `order_id`
- `packaged_product_id`（Phase 2 定義）
- `quantity`
- `unit_price_snapshot` / `total_price_snapshot`（snapshot 在 paid 時凍結，refund 算用）
- `assigned_supplier_plan_id`（fulfilling 時填，可在 fallback 時被覆寫，但要保留 history → 見 §3.3）
- `fulfillment_id`（指向 Fulfillment 紀錄，見 §4）
- `state`（line 級別有自己的 state，因為一張 order 可能多 line，部分 fulfilled / 部分 failed）

`OrderStateTransition`（audit table，append-only）
- `id`
- `order_id` / `order_line_id`（其一）
- `from_state` / `to_state`
- `actor`（`system` / `ops:<user_id>` / `customer` / `webhook:<source>`）
- `reason_code`（enum + free text）
- `context`（JSON：retry attempt #、supplier response id、ops ticket id…）
- `occurred_at`

### 3.2 Order vs OrderLine 的 state 一致性

兩級 state machine：
- **Line 級**：每條 line 有自己的 fulfillment lifecycle（fulfilling / fulfilled / failed…）
- **Order 級**：是 line states 的 aggregate（rule: 全 fulfilled → order fulfilled；任一 failed 且超過 retry → order 進 partial_review；全 delivered → order delivered…）

**Open question**：partial fulfillment 是否允許？例如 5 條 line 有 1 條 supplier 永久失敗、其他 4 條 OK，customer 拿到 4 張 eSIM + 1 條 refund？建議**允許**（提高 UX），但這影響整個 state aggregate logic — 需 Ray 拍板。

### 3.3 Supplier reassignment history

當 fallback 觸發（primary supplier 失敗 → fallback supplier），不能直接 overwrite `assigned_supplier_plan_id`，需保留歷史：

`OrderLineSupplierAttempt`（append-only）
- `id`
- `order_line_id`
- `supplier_plan_id`
- `attempt_no`
- `started_at` / `ended_at`
- `outcome`（`success` / `transient_fail` / `permanent_fail` / `aborted`）
- `supplier_request_id` / `supplier_response_blob`（verbatim，見 §4.3）

---

## 4. Fulfillment payload & delivery spec（→ follow-up issue 2）

### 4.1 Fulfillment 資料模型

`Fulfillment`
- `id`
- `order_line_id`
- `iccid`
- `activation_code` / `lpa_string`（SM-DP+ 啟用字串，格式 `LPA:1$<smdp_addr>$<matching_id>`）
- `qr_payload`（QR 內容；render 由 storefront / delivery 處理，**不** 在這存 image bytes）
- `install_instructions_ref`（指向 instructions 模板的 ref + locale，**不** 存 raw 文案 —— 文案歸 Phase 5）
- `validity_window`（`starts_at` / `expires_at`；可能是 first-activation-based，需要 supplier-side semantics）
- `data_quota_mb`（如適用）
- `supplier_metadata`（JSON：supplier-side 的 plan id、region、network 等）
- `created_at`

### 4.2 Delivery 紀錄

`Delivery`
- `id`
- `fulfillment_id`
- `channel`（`email` / `in_app_inbox` / `vendor_webhook` / `manual_handoff`）
- `recipient`（email address / customer_id / webhook url）
- `state`（`pending` / `sent` / `delivered_ack` / `failed`）
- `attempts`（陣列：每次嘗試的 timestamp + provider response）
- `sent_at` / `acked_at`

支援同一 fulfillment **多 channel** 同時遞送（email + in-app）。`Order.delivered_at` = 第一個成功 channel 的時間。

### 4.3 Audit 要求

| 紀錄類別 | 保存內容 | 保存期限 |
|---|---|---|
| Order state transitions | 見 §3.1 OrderStateTransition | **無限期**（compliance + dispute） |
| Supplier raw request | URL / method / headers（脫敏）/ body | 至少 12 個月 |
| Supplier raw response | status code / headers / body verbatim | 至少 12 個月 |
| Delivery provider response | provider message id / status | 至少 6 個月 |
| Ops action | actor user_id / action / before-after diff / reason | **無限期** |

**Verbatim 保存**的理由：supplier dispute（"我們從來沒收到這個 order"）只能用 raw request/response 對帳；parsed fields 不夠。

### 4.4 Idempotency

每個 supplier API 呼叫必須帶 idempotency key：
- key 組成：`order_line_id + attempt_no`
- supplier adapter 必須支援 idempotency header（Phase 2 supplier capability matrix 要記）
- 不支援 idempotency 的 supplier：用 unique key + 我方 dedup table 防護

---

## 5. Failure / retry / refund / reissue spec（→ follow-up issue 3）

### 5.1 Failure 分類

| 類別 | 例子 | 預設處置 |
|---|---|---|
| **Transient** | HTTP 5xx、timeout、429 rate limit | exponential backoff retry，max N attempts（建議 N=5，總時長 ≤ 15 min） |
| **Permanent** | HTTP 4xx invalid plan、region blocked、out of stock | 不 retry，跳 fallback supplier；無 fallback 則進 `manual_review` |
| **Auth** | 401 / 403 from supplier | 不 retry，立即 alert ops（這是我方 credential 問題） |
| **Ambiguous** | 200 but unparseable / missing ICCID | 進 `manual_review`，不自動重試（避免重複扣 supplier quota） |
| **Payment-fulfillment mismatch** | paid 但 fulfillment 全失敗 | 自動觸發 refund flow（pending Ray 決策，見 open Q3） |
| **Post-activation broken** | customer 反映 eSIM 不能用 | 走 reissue flow，原 order 標 `reissued`（不退原始金流） |

### 5.2 Retry policy

```
attempt 0: 立即
attempt 1: +30s
attempt 2: +2 min
attempt 3: +5 min
attempt 4: +15 min
→ 超過 → manual_review
```

Jitter ±25%。Backoff 中 order line state 是 `supplier_failed`（顯示給 ops 看），不是 `fulfilling`（避免 ops 誤判 stuck）。

### 5.3 Refund flow

```
refund_requested ──(payment gateway 完成退款)──► refunded
                ├──(gateway 失敗)──► refund_failed → manual_review
                └──(ops 取消 refund)──► back to manual_review
```

`Refund`
- `id`
- `order_id`（refund 是 order 級別，可能涵蓋多條 line）
- `lines`（哪些 line 算進退款金額）
- `amount` / `currency`
- `reason_code`
- `triggered_by`（`auto_rule` / `ops:<user_id>` / `customer_request`）
- `payment_gateway_refund_id`
- `state`

**Open question**：自動退款規則的觸發範圍？建議只在「paid 但 fulfillment 永久失敗且無 fallback」一種情境自動觸發；其他都走 ops 手動。

### 5.4 Reissue flow

兩種啟動方式：
1. **Pre-delivery reissue**：fulfillment 已產生但 customer 反映 QR 無效 / activation code 不對 → 觸發新 fulfillment，原 fulfillment marked invalid，金流不動
2. **Post-activation reissue**：customer 已啟用但 plan 出問題 → 走補發；計價策略待定（見 open Q4）

`Reissue`
- `id`
- `original_order_line_id`
- `new_order_line_id`
- `reason_code`
- `cost_policy`（`free` / `charged` / `partial_credit`）
- `triggered_by`
- `created_at`

### 5.5 Manual review queue

ops console 必備 view：
- `manual_review` 中的所有 order line
- 排序：`oldest_first` (SLA) / `value_desc` (revenue impact)
- 每張卡片顯示：order summary、最後一次 supplier attempt 的 response、可採取動作（retry / switch supplier / refund / reissue / cancel）

**Open question**：ops console 蓋在哪？vendor admin（Phase 5）或獨立 ops 後台？建議獨立 ops 後台，不污染 vendor view。

---

## 6. Inventory / allocation spec（→ follow-up issue 4）

### 6.1 兩種 supplier inventory model

| Model | 描述 | 我方需求 |
|---|---|---|
| **On-demand** | supplier API call → 即時產生 eSIM credential | 無 local stock；每次呼叫即發單 |
| **Allocated pool** | 我方預先 batch 採購 N 張 eSIM credentials，存在本地 pool | local stock counter、low-stock alert、reorder rules、過期 credentials cleanup |

兩種 model 必須**同時支援** — 不同 supplier 走不同 model 是常態。

### 6.2 Allocated pool 的資料模型

`SupplierInventoryItem`
- `id`
- `supplier_plan_id`（指向 Phase 2 的 raw plan）
- `iccid`
- `activation_code` / `lpa_string`
- `acquired_at`
- `expires_at`（unused credentials 的有效期）
- `state`（`available` / `reserved` / `consumed` / `expired` / `revoked`）
- `reserved_for_order_line_id`（reservation 期間鎖定，TTL 後自動釋放）
- `consumed_by_order_line_id`

Reservation TTL：建議 10 分鐘（從 `fulfilling` 進入到 fulfillment 確認的最長時間）。超時自動 `available`。

### 6.3 跨 supplier allocation policy

當同一個 packaged product 可由多個 supplier 履行時，選哪個？

Phase 4 spec 要定義的 policy hooks（具體權重 Phase 2 補）：
- **primary-first**：固定主供，fallback 順序
- **cost-optimized**：選當下最便宜的（需要 Phase 2 提供 cost 資料）
- **quality-weighted**：按近期成功率 / 平均延遲加權
- **inventory-aware**：優先消化 allocated pool 中即將過期的 stock

**MVP 建議**：先做 primary-first + manual fallback；其他三種 v2。

### 6.4 Low-stock & reorder

- 每個 `supplier_plan_id` 設 `min_stock_threshold`
- 觸發時：ops console alert + （optional）自動向 supplier 下批量採購單
- v1：alert only，採購由 ops 手動操作

---

## 7. 跨 phase 依賴（LOAD-BEARING）

| Phase 4 需要的東西 | 應該由哪個 phase 定義 | 目前狀態 |
|---|---|---|
| Order / OrderLine / Customer / Vendor entity 基礎 | Phase 1 | 未開始（ROA-14 In Progress） |
| Supplier adapter contract（介面、capability matrix） | Phase 2 | 未開始（ROA-15 In Progress） |
| Packaged product ↔ supplier raw plan 對應 | Phase 2 | 未開始 |
| Pricing snapshot 規則（refund 算用） | Phase 3 | 未開始（ROA-16 In Progress） |
| Vendor → ordering 權限規則 | Phase 3 | 未開始 |
| Customer-facing redemption UX | Phase 5 | 未開始 |

### 7.1 處理方式

- **Phase 4 spec 可以起草**，引用 Phase 1-3 的概念時用 placeholder（`<<Phase 1: Order entity>>`），標明假設
- **Spec 不可 finalize** 直到至少：
  - Phase 1 完成 Order entity 定義（最 critical）
  - Phase 2 完成 supplier adapter contract（critical）
- Phase 3 的 pricing snapshot 規則可以晚一點補（refund 邏輯可先 placeholder）

### 7.2 建議的執行順序

1. **先**：Phase 1 至少 draft 出 Order / Customer / Vendor entity
2. **平行**：Phase 4 起草 order lifecycle spec（§3）+ failure/retry spec（§5）
3. **再來**：Phase 2 draft supplier adapter contract → Phase 4 接著寫 supplier ordering spec（§4）與 inventory spec（§6）
4. **最後**：Phase 3 補 pricing snapshot → Phase 4 完成 refund 細節

---

## 8. Open questions（給 Ray 決策）

| # | 問題 | 建議預設 | 影響範圍 |
|---|---|---|---|
| Q1 | 已經選定的 supplier 是哪幾家？（Airalo / Mobimatter / Truphone / 自建…） | 待定 — 直接影響 Phase 2 adapter 數量與 capability matrix | Phase 2 / 4 |
| Q2 | MVP 是否支援 multi-supplier per product（fallback 邏輯）？ | 建議 v1 只做 primary，fallback v2 | §6.3 |
| Q3 | Paid-but-fulfillment-failed 是否自動退款？ | 建議僅此情境自動，其他走 ops | §5.3 |
| Q4 | Post-activation reissue 收費策略？ | 建議首次免費，第二次起 case-by-case | §5.4 |
| Q5 | 交付通道：launch 時 email-only 還是同時 in-app inbox？ | 建議 email-only + 帳號頁查詢；in-app inbox v2 | §4.2 |
| Q6 | Ops console 蓋在 vendor admin 還是獨立後台？ | 建議獨立後台 | §5.5 / Phase 5 |
| Q7 | Partial fulfillment（多 line order 部分成功）是否允許？ | 建議允許，但需確認 UX 與退款 logic | §3.2 |
| Q8 | Allocated pool MVP 是否需要？還是 v1 全 on-demand 即可？ | 建議 v1 純 on-demand，pool 等 supplier cost 跑出來再決定 | §6 |

---

## 9. Follow-up issues（在 Phase 4 project 下建立）

| # | Title | Scope | Blocked by |
|---|---|---|---|
| F1 | Spec: Order lifecycle & state machine | §2, §3 | ROA-14（Phase 1 Order entity） |
| F2 | Spec: Fulfillment payload & delivery | §4 | ROA-15（Phase 2 supplier adapter） |
| F3 | Spec: Failure handling, refund & reissue flows | §5 | F1, ROA-16（pricing snapshot） |
| F4 | Spec: Inventory & cross-supplier allocation | §6 | ROA-15（Phase 2 supplier capability matrix） |
| F5 | Research: Concrete supplier selection (Airalo / Mobimatter / etc.) | Q1 | — （pre-req 給 ROA-15） |

每張 issue 建立後會 link 回這份 doc 對應 section，並標清 dependency。

---

## 10. Out-of-scope reminders（避免規劃漂移）

- **不在這份文件**訂金流 provider 選型（Stripe / Tappay / …）— 那是 infra 決策
- **不在這份文件**訂 ops console 的 UI 設計 — Phase 5
- **不在這份文件**訂 commission / settlement 邏輯 — Phase 6
- **不在這份文件**寫 supplier 的具體 API 細節 — 等 Q1 / Phase 2

---

## Appendix A — Glossary（Phase 4 內部用詞）

| 術語 | 定義 |
|---|---|
| **Order** | customer 一次購買行為的容器，含一或多條 OrderLine |
| **OrderLine** | 單一 packaged product 的購買單位；fulfillment 的最小粒度 |
| **Packaged product** | tier-1 vendor 在 catalog 上架的可銷售品項（Phase 2 概念） |
| **Supplier raw plan** | upstream supplier 提供的原始 eSIM plan（Phase 2 概念） |
| **Fulfillment** | 一條 OrderLine 履行後產生的 eSIM credentials 紀錄 |
| **Delivery** | 把 Fulfillment 送到 customer 的通道紀錄（email / inbox / …） |
| **Allocated pool** | 我方預先採購、本地保管的 supplier credentials |
| **On-demand** | 每筆 order 即時呼 supplier API 取得 credentials，無本地庫存 |
| **Reissue** | 補發一張新 eSIM 給同一個 OrderLine 的客戶 |
| **Manual review** | 自動流程處理不完、丟進 ops queue 的 OrderLine 狀態 |
