# ROA-70 — Order orchestration & supplier routing spec

> **Status:** Draft v1 · 2026-05-13 · Author: ravn-agent · Reviewer: @ridcorix
> **Linear:** https://linear.app/ravn-roam/issue/ROA-70/spec-order-orchestration-and-supplier-routing
> **Project:** eSIM Platform Phase 4 — Ordering, Fulfillment & Inventory Orchestration
>
> 規格目的：把「客戶下單 → 上游 supplier 出貨」這條流程定義到工程可實作的程度。本文不挑技術 stack（按 `agent-rules/02-default-stack.md` 預設 Next.js on Vercel + Railway worker + 共用 Supabase），focus 在領域 model、state machine、routing rule、payload contract、edge case 行為。

---

## 0. 術語與範圍

| 名詞 | 定義 |
|---|---|
| **Customer** | Roam 的終端使用者，下單方。 |
| **Order** | Roam 系統內的一筆訂單，對應一個 customer + 一個 PackagedProduct。Phase 4 暫定 **單訂單單品項**；多品項視為多筆 Order，open question OQ-3。 |
| **PackagedProduct** | Roam 對外販售的 SKU（例：「日本 5GB / 7 天」）。是 catalog 的 customer-facing 單位。 |
| **Supplier** | 上游 eSIM 服務商（Airalo / MAYA / Joytel / eSIMaccess / …）。Roam 是 reseller，沒有自家 HLR。 |
| **SupplierPlan** | 上游 supplier 的可售 SKU。一個 PackagedProduct 對應 1..N 個 SupplierPlan，順序決定 fallback 序列。 |
| **SIM profile** | supplier 出貨後給 Roam 的 eSIM 憑證集合：`ICCID` + activation（LPA string / QR / manual）+ APN + validity window。 |
| **SupplierOrder** | Roam 對某 supplier 發起的一次出貨請求，與 Order 是 1..N（fallback 會產生第 2、3 次嘗試）。 |

**範圍內（本 spec 處理）**：order lifecycle、creation triggers、PackagedProduct → SupplierPlan routing、supplier selection、fallback、上下游 payload、sync/async 切分、idempotency、observability hook。

**範圍外（拉到 follow-up）**：實際 supplier 接口實作、退款 / 退單流程、用量回拋、續約、多 SIM 訂單、結算對帳、catalog 上架後台。明細見 §13。

---

## 1. Order lifecycle（state machine）

```
                       ┌────────────────────────────────────────────────────┐
                       │                                                    │
  [pending_payment] ──► [paid] ──► [routing] ──► [supplier_submitted] ──► [fulfilled] ──► [delivered]
        │                  │           │                  │                   │
        │                  │           │                  │                   │
        ▼                  ▼           ▼                  ▼                   ▼
    [cancelled]       [refunded]   [routing_         [supplier_         [delivery_failed]
                                    failed]           failed]                  │
                                       │                  │                    │
                                       └──────┬───────────┘                    │
                                              ▼                                │
                                       [exhausted] ──► [refund_pending] ──► [refunded]
                                                                               ▲
                                                                               │ (manual ops)
```

**State 定義：**

| State | 進入 trigger | 退出條件 | Notes |
|---|---|---|---|
| `pending_payment` | Order 建立、等支付 | 支付成功 / 取消 / 過期 | 預設 30 分鐘 TTL → `cancelled`（OQ-1） |
| `paid` | payment webhook `success` | 進入 routing | 暫存點，僅停留毫秒級；如果 routing 服務不可用會堆積 |
| `routing` | orchestrator 取出 → 開始挑 supplier | supplier_submitted 或 routing_failed | 短暫 in-memory 狀態，落 DB 用來防 double-routing |
| `supplier_submitted` | 已對 supplier 發 request、收到 ack（不含 profile） | supplier 回 profile / 失敗 / 逾時 | async supplier 主要停留點 |
| `fulfilled` | 拿到完整 SIM profile（ICCID + activation） | 推送 customer 後 → delivered | 已可使用 |
| `delivered` | customer 已收到啟用資訊（email / app push 完成） | （終態） | |
| `routing_failed` | 候選清單為空 / 全 supplier 都被 hard-constraint 排除 | 進入 exhausted | 可從 routing 來，不算 supplier 錯 |
| `supplier_failed` | 單次 supplier 嘗試明確失敗 | 視 retry policy 進 routing 或 exhausted | 屬瞬態 |
| `exhausted` | 所有候選都打完仍失敗 | 進 refund_pending（自動或 ops 手動） | 對 customer 顯示「處理中，會回退款」 |
| `refund_pending` | exhausted 或 ops 觸發 | refund 完成後 → refunded | 退款 flow OQ-4 |
| `refunded` | 退款 provider ack | （終態） | |
| `cancelled` | customer / system 取消未付款訂單 | （終態） | 無金流影響 |
| `delivery_failed` | 寄送 SIM profile 給 customer 失敗（mail bounce / push fail） | retry 後 → delivered 或 ops | profile 已存在，不影響上游 |

**規則**：
- 所有轉換 emit event（§11）。
- 同一 Order 在 `routing` / `supplier_submitted` 時 worker 必須拿到一把 advisory lock（用 `order_id` 當 key），避免 webhook 與 poll fallback 同時觸發雙寫。
- 終態（`delivered` / `refunded` / `cancelled`）不可回退。需要重發貨 → 開新 Order，原 Order 用 `replacement_of` 關聯。

---

## 2. Order creation triggers

| Trigger | 觸發者 | 觸發點 | 進入狀態 |
|---|---|---|---|
| **T1 · 結帳完成** | Customer | `POST /orders`（建立 order + 開金流）→ payment provider webhook `success` | `pending_payment` → `paid` |
| **T2 · Admin 手動建單** | Internal ops | Admin UI / CLI | 直接 `paid`（標 `payment_method=manual`） |
| **T3 · 補發 / 替換** | Internal ops 或 system | 既有 Order 進 `exhausted` 後人工發起新單 | 直接 `paid`，`replacement_of=<orig_order_id>`，金流為內部沖銷 |
| **T4 · Bulk / B2B 訂單** | API client（未來） | `POST /orders/bulk`，n 筆 child Order | 視 child 狀態 |

**設計決定**：
- 不在 `POST /orders` 同步打 supplier。原因：金流還沒成功、且 supplier 失敗會回滾 customer-facing 流程。**Phase 4 設計為 paid 後才進 routing**，由 background worker 拉。
- T1 入口同時建好 `Order` row（state=`pending_payment`）並產生 idempotency key（§10），讓 payment webhook 重送不會建第二筆。

---

## 3. Routing：PackagedProduct → SupplierPlan

### 3.1 Catalog 結構

```
PackagedProduct (e.g. "日本 5GB / 7 天")
   ├── SupplierPlanCandidate { supplier: airalo,      plan_sku: "JP-5G-7D",   priority: 1, cost_unit: 8.20 USD, ... }
   ├── SupplierPlanCandidate { supplier: joytel,      plan_sku: "JPN_5G_7",   priority: 2, cost_unit: 8.50 USD, ... }
   └── SupplierPlanCandidate { supplier: esimaccess,  plan_sku: "JP-NORM-7",  priority: 3, cost_unit: 9.10 USD, ... }
```

Routing 解析的輸出是 **有序 candidate list**。Orchestrator 依序嘗試、跳過被 constraint 過濾掉的、第一個成功就停。

### 3.2 候選清單產生流程

```
order.paid
  │
  ▼
load PackagedProduct
  │
  ▼
SELECT all SupplierPlanCandidate for that product
  │
  ▼
filter by HARD constraints (§6)
  │
  ▼
sort by score = priority × (1 + error_rate_penalty) (§4)
  │
  ▼
emit `order.routed` event with candidate list
  │
  ▼
loop attempt (head → tail)
```

### 3.3 為何 catalog 用顯式候選清單而不是動態 query

- 候選對應關係是業務+商務決定（合約價、利潤、區域偏好），不適合每次跑算法重新挑。
- 顯式 row 讓「為什麼這張單去打 Airalo」可審計：直接看 candidate priority。
- 後台改 candidate 順序 = 立即生效，不需要重 build。

---

## 4. Supplier selection rules

排序公式（從上面 candidate list 已 filter 完 hard constraints 後）：

```
score = priority + dynamic_penalty
dynamic_penalty = w1·rolling_error_rate(15m) + w2·avg_latency_norm + w3·inventory_pressure
```

- `priority`：人工設定，數字小者優先。Phase 4 預設 `w1=w2=w3=0` → 純 priority 排序，dynamic factor 留接口、Phase 5 再 enable。
- **Tie-breaker** 依序：
  1. 預估成本（cost_unit）較低者
  2. 上一筆成功的 supplier（sticky）
  3. supplier_id 字典序（決定論，便於測試 reproducibility）

**Hard constraints（會把 candidate 從清單剔除）見 §6**。

**不在這層處理的**：
- 跨 PackagedProduct 的 supplier 平衡（屬於 catalog editor 的範疇）。
- 庫存 cap（也是 hard constraint，§6）。

---

## 5. Fallback & retry behavior

### 5.1 Error class

| Class | 例 | Action |
|---|---|---|
| **transient** | HTTP 502/503/504、connection timeout、supplier 自承 retryable | 同 supplier 重試 N=2 次，exp backoff（1s / 4s）。仍失敗 → fallback 下一家 |
| **permanent** | `plan_not_available`、`region_not_covered`、`invalid_sku`、HTTP 400/404 | 不重試、直接 fallback 下一家 |
| **ambiguous** | HTTP 200 但 body 表達失敗、HTTP 500 無明確語意 | 視為 transient + 額外 alarm（Phase 5 可基於 alarm 累積把該 supplier 暫降權） |
| **rate_limited** | HTTP 429、明確 `retry_after` | 重試 1 次 honouring `retry_after`（上限 30s）；仍失敗 → fallback |
| **billing / auth** | HTTP 401/403 | 不 fallback，整單 → `routing_failed` + alarm。代表我方 token / 餘額異常，繼續打別家可能同因 |

### 5.2 退而打下一家的條件

- 上面 transient/permanent/ambiguous/rate_limited 三類已決策。
- **整單放棄條件**：候選清單跑完 / 已嘗試上限（預設 4，避免清單超長拖時間）/ 任一 candidate 回 billing-class 錯誤（fail-fast）/ 總耗時 > 90s。
- 整單放棄 → state 進 `exhausted` → 自動進 `refund_pending`（OQ-4 確認）。

### 5.3 Async supplier 的「逾時」處理

對 async-only supplier：
- 發送後 supplier 只回 `accepted`，profile 之後從 webhook 來。
- Phase 4 預設 webhook 等待上限 = **5 分鐘**。逾時觸發 polling fallback（如該 supplier 提供查單 API），polling 上限再 5 分鐘。
- 全程 10 分鐘仍沒 profile → 視為 transient，**先不 fallback**：因為去打別家會造成雙開卡。Phase 4 行為是進 `supplier_failed` + 標 `requires_manual_review` + alarm。Ray 手動決策。
- OQ-5：是否在某些 supplier 上允許「自動雙開卡 + 後到的作廢」。

### 5.4 Idempotency on retry — 見 §10。

---

## 6. Routing constraints（hard）

| Constraint | 來源 | 行為 |
|---|---|---|
| **Region / regulation** | `SupplierPlanCandidate.allowed_regions` × customer billing country | 不符 → candidate 剔除。客戶完全 unmatched → `routing_failed` |
| **庫存 cap** | `SupplierPlanCandidate.inventory_cap`（per supplier，per day/week 自定義） | 已滿 → 剔除。需要 atomic reserve（§6.1） |
| **價格上限** | `PackagedProduct.cost_ceiling`（可選） | candidate `cost_unit > ceiling` → 剔除 + alarm（代表上架價變動沒同步更新） |
| **Supplier 維護窗** | `Supplier.maintenance_windows`（cron-like） | 命中 → 剔除直到出窗 |
| **Supplier 健康狀態** | 來自 health-check（Phase 5） | `unhealthy` → 剔除 |
| **合約條款** | 例：某 supplier 不能對 EU 客戶出貨 | candidate metadata flag，過濾邏輯同 region |

### 6.1 庫存 reservation

- 每個 `SupplierPlanCandidate` 可選地帶 `inventory_cap`（period + count）。
- Orchestrator 在「挑到該 candidate」時 atomic 扣減（`UPDATE ... SET used = used + 1 WHERE used < cap RETURNING used`）。
- 扣減後若 supplier 失敗 → **歸還**（unless permanent-class error；permanent 不歸還，視為「這張在這 supplier 上不可能成功」）。
- Cap 用 Postgres row-level lock 即可，Phase 4 不引入 Redis。

---

## 7. Upstream payload（Roam → supplier）

正規化 internal envelope，再由 supplier adapter 投影到各家 SDK 規格。

### 7.1 Internal `SupplierOrderRequest`

```jsonc
{
  "internal_supplier_order_id": "ord_8f3...",   // §10 idempotency key
  "roam_order_id": "RO-2026-00012345",
  "attempt_seq": 1,                              // §5 fallback 第幾次嘗試
  "supplier_id": "airalo",
  "supplier_plan_sku": "JP-5G-7D",
  "customer": {
    "id_hash": "sha256:...",                    // 不傳明文 customer_id
    "email": "user@example.com",                 // 部分 supplier 要,看 supplier 是否須 fwd（OQ-6 PII minimisation）
    "locale": "zh-TW",
    "device_hint": { "type": "ios|android|unknown" }
  },
  "delivery": {
    "channel": "lpa|qr",                         // 我們向 supplier 要的格式偏好
    "callback_url": "https://api.roam.app/webhooks/suppliers/airalo"  // async profile 回拋點
  },
  "issued_at": "2026-05-13T07:21:00Z",
  "trace_id": "01HXY..."                         // 對應 §11
}
```

### 7.2 投影到各家 SDK — adapter 模式

```
SupplierOrderRequest
   ├── airalo.adapter      → Airalo POST /v2/orders (Bearer token)
   ├── joytel.adapter      → Joytel SOAP createOrder
   ├── esimaccess.adapter  → eSIMaccess REST /api/v1/order
   └── maya.adapter        → ...
```

每個 adapter 自行處理 auth、retry、parsing；orchestrator 只 in/out 走 internal envelope。

---

## 8. Downstream payload（supplier → Roam）

### 8.1 Internal `SupplierOrderResult`

```jsonc
{
  "internal_supplier_order_id": "ord_8f3...",
  "status": "provisioned|accepted|failed",
  "supplier_order_id": "airalo-abc123",          // supplier 那端的 ID
  "profile": {                                   // status=provisioned 時 required
    "iccid": "8988228...",
    "activation": {
      "type": "lpa|qr|manual",
      "lpa_string": "LPA:1$...$...",             // type=lpa 時 required
      "qr_image_url": "https://...",             // type=qr
      "manual": { "smdp": "...", "matching_id": "..." }  // type=manual
    },
    "apn": "internet",
    "msisdn": null,                              // 多數 supplier 不給
    "validity": {
      "starts_at": "2026-05-13T07:21:30Z",       // 多數 supplier 是「啟用後 N 天」，此時值是 null
      "duration_days": 7,
      "data_quota_mb": 5120
    },
    "supported_regions": ["JP"]
  },
  "error": {                                     // status=failed 時 required
    "class": "transient|permanent|ambiguous|rate_limited|billing|auth",
    "code": "<supplier 原始 code>",
    "message": "...",
    "retry_after_seconds": 30                    // class=rate_limited 才有
  },
  "received_at": "2026-05-13T07:21:31Z"
}
```

### 8.2 Webhook contract（supplier 主動回拋）

- 入口統一：`POST /webhooks/suppliers/{supplier_id}`。
- adapter 解 supplier 格式 → 投影到 `SupplierOrderResult` → 走同一條 fulfilled 流程。
- **Signature 驗證**：每個 supplier 一定要驗（HMAC / Bearer / IP allowlist 至少一）。phase 4 至少 HMAC + replay window 5 分鐘。
- **Idempotent 處理**：以 `supplier_order_id` 為 unique key 入 inbox table，重複 webhook 直接 `200` no-op。

### 8.3 後續 webhook（usage / expiry / suspended）

範圍外。OQ-8。佔位接口：所有 supplier webhook 都進 `supplier_inbox` table，未實作的 event type 暫存供未來 phase 處理。

---

## 9. Sync vs async

### 9.1 對 customer

- `POST /orders` **同步**回應：Order created + payment intent。Customer 端 spinner ≤ 200ms。
- 「拿到 SIM」**非同步**：customer 在 paid 之後看到「處理中」狀態，profile 到位再 push（email + app realtime）。
- 不承諾 SLA 字面上是「通常 30 秒內」（內部 P95 目標），但 UI 上的文案不要寫具體秒數。

### 9.2 對 supplier（兩種 mode 並存）

| Mode | 範例 supplier | Roam 行為 |
|---|---|---|
| **sync provisioning** | 不少 reseller 在創單 API 同個 response 直接吐 profile | adapter 解析後直接 emit `supplier.provisioned`、order 進 `fulfilled` |
| **async provisioning** | Joytel / MAYA 部分 plan | 創單 → 收 `accepted` → 等 webhook 或 poll → 收 profile → `fulfilled` |

Orchestrator **不關心** supplier 是哪一種——adapter 把 sync mode 偽裝成 async（synchronous response 也走同一條 `SupplierOrderResult` 路徑）。這讓上層只看一條 state machine。

### 9.3 Polling fallback

- supplier 有 query API 時，async 流程在 webhook 等待過半時間後啟動 poll（每 30s）。
- supplier 無 query API → 只能等 webhook，到達 §5.3 上限後人工介入。

---

## 10. Idempotency & duplicate guards

| 點位 | Key | 機制 |
|---|---|---|
| `POST /orders` | `Idempotency-Key` header（customer-supplied or 我們 generate）+ customer_id | 24h 內相同 key 回原 Order |
| Payment webhook | provider 的 `event_id` | inbox table unique；重送 no-op |
| Order routing | `order_id` advisory lock | 同時間只有一個 worker 在處理 |
| Supplier dispatch | `internal_supplier_order_id`（每次 attempt 不同；attempt N+1 換新 id 但帶 `parent_supplier_order_id`） | 防 retry 在 supplier 端造成重複出貨 |
| Supplier webhook | `supplier_id` + `supplier_event_id` | unique constraint，重送 200 no-op |
| Profile 寫入 Order | DB transaction：`UPDATE order SET state=fulfilled WHERE state IN (paid, supplier_submitted)` | 競爭條件下只第一筆生效 |

**規則**：所有 attempt 用新的 `internal_supplier_order_id`，但 supplier-side 的 `customer_reference` 帶 `roam_order_id` 不變，讓 supplier 端可看到「同張 Roam 訂單嘗試了 N 次」（OQ-7：某些 supplier 對相同 customer_reference 會拒）。

---

## 11. Observability hooks（events emit 規範）

統一寫到 `order_events` table + 同步推到 Phase 5 的 event bus。所有 event 帶 `trace_id`、`order_id`、`emitted_at`。

| Event | When |
|---|---|
| `order.created` | T1/T2/T3/T4 之一觸發、Order row 落地 |
| `order.paid` | 金流 ack |
| `order.routed` | candidate list 算完 |
| `supplier.submitted` | adapter 把 request 送出去 |
| `supplier.ack` | 收到 `accepted`（async mode） |
| `supplier.provisioned` | 收到 profile |
| `supplier.failed` | 收到失敗（含 error class） |
| `order.fulfilled` | Order 拿到完整 profile |
| `order.delivered` | customer push / email 完成 |
| `order.exhausted` | 候選清單跑完 |
| `order.refund_pending` | 進入退款流程 |
| `order.refunded` | 退款完成 |

**儀表板 / 告警** — 範圍外，列為 follow-up（§13 F-O3）。本 spec 只保證 event 有產出。

---

## 12. Open questions（for @ridcorix）

| ID | 問題 | 影響 |
|---|---|---|
| OQ-1 | `pending_payment` TTL = 30 分鐘合理嗎？ | UI / catalog 計價 |
| OQ-2 | Phase 4 是否要支援「多 SIM / 多 plan 一筆訂單」？目前假設不支援。 | order schema |
| OQ-3 | Bulk / B2B 訂單（T4）在 Phase 4 內嗎？預設挪到 Phase 5。 | API surface |
| OQ-4 | `exhausted` 是否自動進 refund，還是先停在 `requires_manual_review` 等 ops？ | customer experience |
| OQ-5 | Async supplier 逾時（§5.3）是否允許「自動換家 + 後到 profile 作廢」？需 supplier 對「作廢」有 cancel API。 | 出錯時的雙開卡風險 |
| OQ-6 | PII：email 必傳給 supplier 嗎？哪些可省略？需要 customer pseudonymisation 嗎？ | 合規 |
| OQ-7 | 同一 `roam_order_id` 在 supplier 端重複 reference，supplier 是否會拒？要實證每家。 | retry 行為 |
| OQ-8 | Usage / expiry / suspend 等後續事件 webhook 處理在哪期？預設 Phase 5。 | webhook contract 設計 |
| OQ-9 | 第一批要對接哪幾家 supplier？影響 adapter 排程。 | 工程 prioritisation |
| OQ-10 | Catalog 是 admin UI / yaml / DB seed？影響 follow-up F-O5 範圍。 | 後台規劃 |

---

## 13. Follow-up issues（建議）

下列為建議子 issue，可直接複製進 Linear。Tag = `phase-4`，project = 同 ROA-70。

### Orchestration cluster

- **F-O1 · Order state machine + persistence schema**
  落地 §1 state、`orders` / `order_events` / `supplier_orders` 表結構與 migration。後續 issue 的前置。
- **F-O2 · Routing engine + candidate scoring**
  實作 §3–§6 的 candidate resolver、scoring（Phase 4 純 priority + tie-breakers）、constraint filter、reservation。可單測。
- **F-O3 · Idempotency layer & inbox tables**
  §10 全部點位 + payment / supplier webhook inbox 設計。
- **F-O4 · Order lifecycle worker**
  訂閱 `order.paid` → 跑 routing → 呼叫 adapter → 寫狀態。包含 §5 retry 與 fallback。
- **F-O5 · Catalog data model（PackagedProduct + SupplierPlanCandidate）**
  table + seed 載入機制（yaml 先行，後續 admin UI）。

### Supplier integration cluster

- **F-S1 · Supplier adapter interface + reference implementation（mock supplier）**
  定義 `SupplierAdapter` 介面、提供 mock 供 dev + test 用。**最先做**，後面的真實 adapter 都依此。
- **F-S2 · Adapter — `<supplier_a>`**（待 OQ-9 後展開）
- **F-S3 · Adapter — `<supplier_b>`**
- **F-S4 · Supplier webhook endpoint + signature verification**
  §8.2 / §8.3，含 inbox。
- **F-S5 · Polling fallback for async suppliers**
  §9.3。

### Observability cluster

- **F-Obs1 · Structured event log + trace_id propagation**
  §11 event emission，含 customer-facing 與 internal 兩個 stream。
- **F-Obs2 · Order lifecycle dashboard + alerts**
  P95 fulfillment time、supplier error rate、exhausted rate 告警。
- **F-Obs3 · Supplier health-check job**
  定期探 supplier endpoint、餵 §4 dynamic_penalty 用。Phase 5 enable，Phase 4 先建空 schema。

### Out-of-scope（建議單獨開 issue 但不歸 Phase 4 ordering 直接子項）

- 退款 / 退單 flow 細節（OQ-4 依賴）
- 用量 / 到期事件 webhook 處理（OQ-8）
- Bulk / B2B 訂單 API（OQ-3）
- 多 SIM / 多 plan 訂單支援（OQ-2）

---

## 14. 工程約束 cross-ref

本 spec 落地時必須遵守的既有 repo 規則：

- **`agent-rules/02-default-stack.md`** — Next.js (Vercel) + Railway worker + 共用 Supabase。Worker（order lifecycle worker）放 Railway，因為要長跑、會等 supplier webhook。
- **`agent-rules/09-pr-previews.md`** — order / supplier_order / supplier_inbox 等 migration 必須 **migration-first PR**，不能跟 feature code 同 PR；API 加欄位 only。對應 follow-up F-O1 / F-O3 的 PR 拆分。
- **`agent-rules/06-shared-supabase.md`** — 用 `roam_<env>` schema，不開新 Supabase project。
- **`agent-rules/07-company-firewall.md`** — supplier 帳號 / API key 走 `secrets-get.sh`，**不可** 直接放 Vercel / Railway 後台。Linear 工單帶 secret 走 §10 of agent-rules（secrets-via-linear）。

---

## 15. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-05-13 | ravn-agent | Draft v1 |
