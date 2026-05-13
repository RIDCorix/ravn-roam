# Phase 2 — Supplier Integration Contract & Plan Ingestion

> Issue: [ROA-64](https://linear.app/ravn-roam/issue/ROA-64/spec-supplier-integration-contract-and-plan-ingestion)
> 規劃稿基底: [Phase 2 — Catalog Architecture (v0)](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4)
> Phase 1 對齊: [ROA-20 domain model](https://linear.app/ravn-roam/issue/ROA-20), [ROA-22 lifecycle](https://linear.app/ravn-roam/issue/ROA-22)
> 狀態: v0 spec, 待 Ray review

---

## 0. 為什麼還需要這份文件

[Phase 2 規劃稿 §9](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4) 已給 supplier adapter pattern 與 sync 模式的「骨架」。骨架不夠拿去動工 —— 規劃稿沒有寫的是：

* adapter SPI 的完整型別、錯誤分類、能力協商
* `supplier_plan` 每個欄位的 normalization 規則與單位
* 進倉時的 validation gate（hard reject vs soft warn）
* freshness SLA、變更偵測、消失 plan 的處置
* manual CSV 與 webhook 的並存規則
* 給 ROA-53 / ROA-56 / ROA-58 直接照抄的 schema 增補

這份文件補上述空白。它的讀者是：

* **ROA-53** (catalog schema migration) — 拿 §9 直接寫 migration
* **ROA-56** (SupplierAdapter SPI + 第一家 adapter) — 拿 §3 寫 TypeScript interface
* **ROA-58** (SupplierPlan sync job) — 拿 §6 §7 §8 寫 job 與 alerting

---

## 1. 範圍

**In scope**

* Supplier integration boundary（誰負責什麼）
* SupplierAdapter SPI 完整契約 + error taxonomy + capability matrix
* Canonical `RawPlan` 欄位、型別、normalization rule（每欄列）
* 進倉 validation（hard reject / soft warn 兩段、rejected row 後續處理）
* 四種 ingestion mode 的機制（API pull full / delta、webhook、manual CSV）
* Freshness SLA、availability 語意、change-tracking、消失 plan 的處置
* Data quality observability metrics + alert threshold（v0 預設）
* `supplier` / `supplier_plan` schema 增補欄位 + 新表 4 張（給 ROA-53）

**Out of scope（明確遞延）**

| 項目 | 遞延到 | 理由 |
|---|---|---|
| 第一家整合的 supplier 是誰 | [ROA-47](https://linear.app/ravn-roam/issue/ROA-47) | landscape 研究，與 spec 解耦 |
| LPA / QR / ICCID 啟用流程技術細節 | [ROA-50](https://linear.app/ravn-roam/issue/ROA-50) | Phase 4 fulfillment payload，本 spec 只記錄 enum |
| 多幣別與 FX 策略細節 | [ROA-51](https://linear.app/ravn-roam/issue/ROA-51) | Pricing 層，不在 supplier 層 |
| Supabase migration 實作 | [ROA-53](https://linear.app/ravn-roam/issue/ROA-53) | 本文 §9 是其 input |
| Adapter 實作（第一家） | [ROA-56](https://linear.app/ravn-roam/issue/ROA-56) | 本文 §3 是其 input |
| Sync job 實作 | [ROA-58](https://linear.app/ravn-roam/issue/ROA-58) | 本文 §6 §7 §8 是其 input |
| Admin UI（supplier / plan / 重試介面） | [ROA-60](https://linear.app/ravn-roam/issue/ROA-60) | UI 不在本文 |

---

## 2. Integration boundary

定義「誰負責什麼」，避免 adapter / catalog / Phase 4 ordering 各做一半。

### 2.1 概念分層

```
┌────────────────────────────────────────────────────────────┐
│ Upstream supplier API / portal                             │  ← 外部世界，異質
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTP / CSV / webhook
                          ▼
┌────────────────────────────────────────────────────────────┐
│ SupplierAdapter (per supplier, code-routed)                │  ← Adapter 層
│  - listPlans / getPlan                                     │
│  - 把上游格式 normalize 成 canonical RawPlan                │
│  - 拋 typed error                                          │
└─────────────────────────┬──────────────────────────────────┘
                          │ RawPlan (canonical)
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Ingestion pipeline                                         │  ← Catalog 層
│  - validate (hard reject / soft warn)                      │
│  - upsert into supplier_plan                               │
│  - emit change events / data_quality_events                │
└─────────────────────────┬──────────────────────────────────┘
                          │ supplier_plan rows
                          ▼
        product_supplier_mapping → product → Phase 4 / 5
```

### 2.2 邊界規則（LOAD-BEARING）

1. **Adapter 是 normalization 的唯一邊界**。上游格式變動只能改到 adapter 內，不允許讓 raw 欄位漏進 ingestion pipeline。
2. **Catalog 不直接呼叫上游 API**。所有上游 IO 都走 adapter。Phase 4 ordering 亦同。
3. **Ingestion pipeline 不知道上游是誰**。它只看到 `RawPlan` + `supplier_id`，無條件套用相同 validation。
4. **Supplier 不需要遵守任何契約**。上游愛回什麼格式都可以；遵守契約的是 adapter。
5. **Adapter 是無狀態的**。所有狀態（last_synced_at, credentials, capabilities cache）放在 catalog 層的 `supplier` row 或 secret store；adapter 實例可以隨意 spin up / spin down。

### 2.3 多 adapter / 多 supplier 關係

* `supplier.code` 唯一，1:1 對應一個 adapter 實作
* 一家 vendor（如 esim_go）可同時有「正式 API」與「manual CSV」兩種對接 —— 由 **兩筆 supplier row** 表示，不在 adapter 內混用。理由：sync job、credentials、capability、observability 都按 supplier_id 切片
* `integration_type` 是 supplier row 的屬性，不是 adapter 的屬性

---

## 3. SupplierAdapter SPI (v0 contract)

### 3.1 Interface

```ts
interface SupplierAdapter {
  /** 內部代碼，對應 supplier.code */
  readonly code: string;

  /** 此 adapter 支援的能力集 */
  readonly capabilities: AdapterCapabilities;

  /** 列出所有可進倉的 plan（async iterator，背壓友善） */
  listPlans(opts?: ListPlansOpts): AsyncIterable<RawPlan>;

  /** 取單一 plan（用於 manual refresh 或 webhook callback hydrate） */
  getPlan(externalId: string): Promise<RawPlan | null>;

  /** webhook payload 正規化（若 capabilities.supportsWebhook） */
  normalizeWebhookEvent?(payload: unknown, headers: Record<string, string>): WebhookEvent;

  /** 以下 Phase 4 才用到，Phase 2 不實作 */
  createOrder?(planId: string, ctx: OrderContext): Promise<OrderResult>;
  cancelOrder?(orderId: string): Promise<void>;
  getOrderStatus?(orderId: string): Promise<OrderStatus>;
}

interface AdapterCapabilities {
  /** 可以走 listPlans({ updatedSince }) 做增量 sync */
  supportsDeltaSync: boolean;
  /** 上游會主動推 webhook */
  supportsWebhook: boolean;
  /** RawPlan.inventory_hint 會有值 */
  supportsInventoryHint: boolean;
  /** RawPlan.available 可以視為「現在能下單」（而非快取） */
  supportsLiveAvailability: boolean;
  /** 已知 API quota (calls / minute)；用於 sync job rate limiter */
  rateLimitPerMinute?: number;
  /** adapter 自宣告的最大 page size（listPlans 不要超過） */
  maxPageSize?: number;
}

interface ListPlansOpts {
  /** capabilities.supportsDeltaSync = true 才有意義 */
  updatedSince?: Date;
  /** adapter 可忽略（hint） */
  pageSize?: number;
  /** 縮小範圍（adapter 可選擇性 honor） */
  destinationFilter?: string[];
}

interface WebhookEvent {
  /** 上游 event id；本系統 dedupe 用 */
  externalEventId: string;
  /** 觸發的 plan external_id */
  externalPlanId: string;
  /** 變動類型，由 adapter 判斷 */
  kind: 'created' | 'updated' | 'price_changed' | 'availability_changed' | 'deleted';
  /** 上游事件時間 */
  occurredAt: Date;
}
```

### 3.2 Error taxonomy（adapter 必須丟下列 typed error，禁止裸 Error）

| Error class | 場景 | sync job 行為 |
|---|---|---|
| `SupplierAuthError` | credentials 過期 / 被撤銷 | 立即停止本 supplier 所有 sync，page ops |
| `SupplierRateLimitError`（含 retryAfter） | 觸 API quota | 等待 retryAfter，續跑；連續 3 次 → page |
| `SupplierTransientError` | 5xx / connection reset / timeout | 指數 backoff，最多 5 次；皆失敗 → 標記 sync_run failed |
| `SupplierPermanentError` | 4xx (非 auth / 非 rate limit) | 不重試，標記 sync_run failed |
| `SupplierDataError` | 上游回傳格式違反契約 | 該筆寫 `supplier_plan_rejected`，pipeline 繼續其他筆 |

### 3.3 Capability negotiation

Sync job 啟動時讀 `adapter.capabilities`，動態決定走哪條 mode：

```
if capabilities.supportsWebhook  → 主：webhook，輔：每 24h full pull 補缺
else if capabilities.supportsDeltaSync → 主：hourly delta pull，輔：每週 full pull 對帳
else                              → 只跑 daily full pull
```

`supplier.integration_type = manual_csv` 的 supplier 不跑任何 cron pull，僅靠 admin 手動上傳。

### 3.4 Adapter 註冊

* Adapter 實作放在 `packages/integrations/<supplier_code>/`（路徑由 ROA-56 決定，本文不綁死）
* Registry 模組依 `supplier.code` 路由；查無 → 跳 `SupplierPermanentError("adapter not registered")`，sync job 立即失敗（不會悄悄掃過）

---

## 4. Canonical `RawPlan` 欄位與 normalization

每欄分四欄：型別、是否必填、上游來源、normalization 規則。Adapter 必須在 `listPlans` / `getPlan` 回傳時就已套用 normalization；ingestion pipeline 不再做格式轉換。

| Field | Type | Required | 上游來源 | Normalization |
|---|---|---|---|---|
| `externalId` | string | ✅ | 上游 SKU / plan code | 原樣，但去頭尾空白；不允許空字串 |
| `displayName` | string | ✅ | 上游名稱 | trim、移除控制字元；HTML escape 不做（驗證階段判斷） |
| `destinations` | string[] | ✅ | 上游國家 / 地區 | ISO-3166-1 alpha-2 大寫；regional code（EU / APAC / GLOBAL）必須在 adapter 內展開為國碼陣列；去重後升冪排序 |
| `networkOperators` | `{country: string, operators: string[]}[]` | ⚪ | 上游 carrier 對應 | 與 destinations 同樣國碼大寫；缺對應的國家不要 fabricate 空 row |
| `dataAmountMb` | int | ✅ | 上游容量 | 統一 MB（整數）。`-1` = 不限。GB / KB → MB 轉換在 adapter 內。小數 MB → ceil。0 一律視為違規（DataError） |
| `validityDays` | int | ✅ | 啟用後可用天數 | 統一「日」。Hour-based plan → ceil 到日。<= 0 → DataError |
| `activationPolicy` | enum | ✅ | 啟用方式 | `on_install` / `on_first_use` / `fixed_date`。未知值 → DataError（adapter 應該補映射，而非讓上游字串漏過） |
| `activationWindowDays` | int? | ⚪ | 從拿到 eSIM 到「必須開卡」的窗口 | <= 0 → DataError |
| `deliveryMethod` | enum | ✅ | 交付形式 | `lpa_url` / `qr_image` / `iccid_only` / `manual`。未知值 → DataError |
| `costAmount` | decimal(12,4) | ✅ | 採購成本 | 4 位小數；必須 > 0（成本 0 多半上游 staging plan 漏出） |
| `costCurrency` | string | ✅ | ISO 4217 | 三字母大寫；非 ISO 4217 → DataError。**這層不做匯率轉換** |
| `available` | bool | ✅ | 上游可下單性 | `supportsLiveAvailability = false` 時值代表「上次 sync 時的狀態」 |
| `inventoryHint` | int? | ⚪ | 上游可用庫存 | 非負；負值 → soft warn 改 0；`supportsInventoryHint = false` 時 adapter 不要硬塞 0，保持 null |
| `supportsTopup` | bool | ⚪ | 是否支援加值 | default false |
| `supportsRealtimeUsage` | bool | ⚪ | 上游能否即時查用量 | default false |
| `metadata` | jsonb | ⚪ | 上游延伸資訊（4G/5G、tethering、voice...） | 平坦化、key 小寫 snake_case；不要塞已有 first-class 欄位的內容 |
| `upstreamUpdatedAt` | timestamptz? | ⚪ | 上游揭露的最後更新時間 | UTC；未來時間 → soft warn（不改值） |
| `rawPayload` | jsonb | ✅ | 上游原始 response 該筆 | adapter 不可修改 / 不可截斷；> 1 MB → 截到 1 MB + 標 `metadata.raw_truncated = true` |

### 4.1 Normalization 的補充規則

1. **Regional code 展開表寫在 adapter 內**。例如 `EU` → 27 EU 國碼。展開表變動屬 adapter 維護，不寫在 catalog 層 config。
2. **不允許混用 regional code 與國碼**。`["EU", "JP"]` 必須展開成 `["AT", "BE", ..., "JP"]`，不能保留 `EU`。
3. **Data amount 不允許「unlimited fair-use 50GB」這種雙語意**。`-1` 一律代表「無上限（fair-use 細節在 metadata）」；50GB 就是 51200。Fair-use 規則寫 `metadata.fair_use`。
4. **`displayName` 不做翻譯**。i18n 是 product 層的事；supplier_plan 保留上游原文。
5. **Currency conversion 嚴禁在 adapter 內做**。匯率屬 pricing 層（[ROA-51](https://linear.app/ravn-roam/issue/ROA-51)）。

---

## 5. Ingestion validation

兩段式：**hard reject**（整筆丟入 `supplier_plan_rejected`，不寫 `supplier_plan`）與 **soft warn**（寫入 `supplier_plan` + 一筆 `data_quality_event`，標 `severity = warn`）。

### 5.1 Hard reject 條件

* 缺任一 required field（§4 表「Required = ✅」欄）
* `destinations` 含非 ISO-3166-1 alpha-2 國碼（adapter 應該已展開，這裡是最後防線）
* `costCurrency` 非 ISO 4217
* `dataAmountMb` 為 0、NaN、或非整數
* `validityDays` <= 0
* `activationPolicy` / `deliveryMethod` 為未知 enum
* `activationWindowDays` <= 0（若提供）
* `costAmount` <= 0
* `rawPayload` 為 null 或空 object
* `externalId` 為空字串或全空白

### 5.2 Soft warn 條件（寫入但標記）

* `inventoryHint` 為負數 → 改 0 並 warn
* `networkOperators` 標的國家不在 `destinations` 內 → 直接刪該 entry + warn
* `upstreamUpdatedAt` 在未來 → 不改值 + warn
* 同 `(supplier_id, externalId)` 24h 內 `costAmount` 變動 > 30%（cost-drift threshold）→ warn + 觸發 §7.3 的 cost_drift_alert（若有 published product 引用）
* `displayName` 內含 `<` / `>` / `&lt;script` → strip 後寫入 + warn（XSS 防線）
* `metadata.raw_truncated = true` → warn（上游 payload 過大）

### 5.3 Rejected row 處理

* 寫入 `supplier_plan_rejected(id, supplier_id, external_id, raw_payload, reason, sync_run_id, attempted_at)`
* 每 24h 彙整成 1 筆 admin alert（彙總而非每筆）—— 避免上游 schema 一變 alert 屠版
* Admin UI 顯示 rejected list（[ROA-60](https://linear.app/ravn-roam/issue/ROA-60) 範圍）
* Admin 修正 adapter / 等上游修正後可手動 trigger retry（重新從 raw_payload 走 §4 normalize + §5 validate）
* 保留期：見 §10 Q2

### 5.4 為什麼分兩段

* **Hard reject** = 寫入會造成 Phase 4 ordering 出錯（cost 算不出來、destinations 對不上）。寧可缺資料也不要爛資料。
* **Soft warn** = 寫入可運作，但訊號可疑，留給 ops 慢慢處理。catalog 不會因此漏單。

---

## 6. Ingestion methods

### 6.1 Mode matrix

| Mode | 觸發 | 適用 capability | 預設頻率 | 漏單偵測 |
|---|---|---|---|---|
| **API pull (full)** | cron | 一律支援（只需 `listPlans`） | daily 03:00 UTC | full sync 沒看到 = available=false |
| **API pull (delta)** | cron | `supportsDeltaSync` | hourly | 週 1 次 full pull 對帳 |
| **Webhook push** | inbound HTTP | `supportsWebhook` | 即時 | 24h 沉默 → 觸發一次 full pull |
| **Manual CSV import** | admin upload | `integration_type = manual_csv` | ad-hoc | 不適用 |

### 6.2 API pull mechanics

* Sync job 走 `listPlans(opts)`，async iterate
* 每 100 筆批次寫 DB（避免長 transaction）
* 同 `(supplier_id, externalId)` 用 UPSERT
* **Full pull 結束後**：上次 sync 看到、這次沒看到 → `available = false`，`consecutive_misses += 1`；看到 → `consecutive_misses = 0`
* **Delta pull 不做 missing → unavailable 推論**（缺失不代表下架，可能只是上游 updated_since 沒覆蓋到）
* 每次 sync 寫一筆 `supplier_sync_run`(id, supplier_id, mode, started_at, ended_at, status, plans_seen, plans_rejected, error_summary jsonb)
* 對單一 supplier 互斥：用 Postgres advisory lock `pg_advisory_lock(supplier_id hash)`；同 supplier 並發 sync 直接 skip 新 instance

### 6.3 Webhook mechanics

> v0 是否啟用 webhook 取決於 §10 Q6。預設「否」。本節保留設計，供 webhook 啟用時直接照做。

* Endpoint：`POST /api/webhooks/supplier/:supplierCode`
* HMAC signature verify（per-supplier secret，存 secret store，由 `supplier.webhook_secret_ref` 指向）
* Replay protection：用 `externalEventId` 當 idempotency key，最近 24h cached（Redis or memory）
* Payload 經 `adapter.normalizeWebhookEvent()` → `WebhookEvent` → 觸發 `adapter.getPlan(externalPlanId)` 拿完整 RawPlan → 同 §4 §5 pipeline
* **Webhook 沉默偵測**：若超過 24h 沒收到任何 event，自動觸發一次 full pull 對帳（防止 webhook infra 沉默故障）。
* Inbound 失敗（HMAC 對不上、event_id dup、normalize 拋 error）→ 寫 `data_quality_event` 而非回 5xx，避免上游無謂重試。

### 6.4 Manual CSV import

* CSV schema = canonical `RawPlan` 欄位 column-by-column（snake_case header）
* Admin upload at `/admin/suppliers/:id/import`（[ROA-60](https://linear.app/ravn-roam/issue/ROA-60)）
* 同 ingestion pipeline → validate → upsert/reject
* **預設 dry-run**：admin 看完 diff preview（會 upsert N 筆、reject M 筆、archive K 筆）才能 commit
* 不允許和 API pull 並存於同一個 supplier_id（避免互蓋）—— 若同一家 vendor 要兩種對接，建兩筆 supplier row（見 §2.3）
* CSV import 也寫 `supplier_sync_run`，`mode = manual_csv`，actor 寫 admin user id

### 6.5 Idempotency & ordering

* Key：`(supplier_id, externalId)`
* 同一筆同時被 webhook + cron pull 觸發 → 以 `upstreamUpdatedAt` 較新者為準；若兩者皆 null，後到者覆蓋
* Sync job 對單一 supplier 互斥（§6.2 advisory lock）
* Manual CSV import 與 API pull 互斥（透過「同 supplier_id 只允許一種 integration_type」實作）

---

## 7. Freshness, availability, change-tracking

### 7.1 Freshness SLA（per ingestion mode）

| Mode | Target staleness | Hard cap |
|---|---|---|
| Webhook | < 5 min | 1 h（觸發 gap detection） |
| Delta hourly | < 1 h | 4 h |
| Full daily | < 24 h | 36 h |
| Manual CSV | n/a（ops 自負責） | — |

**超過 hard cap 的處置**：

* 不自動改 `supplier.status`（避免單次 outage 連累整個 supplier 下架）
* 發 `SupplierStaleAlert` ops alert
* Phase 5 storefront **不會**因此下架已上架的 product（availability 是 per-plan，不是 per-supplier）
* Phase 4 ordering **仍可**下單（available 是個別 plan 的 attribute；下單時上游若失敗，會走 Phase 4 fulfillment.failed 流程）

### 7.2 Availability 語意

* `supplier_plan.available` = **上游最近一次 sync 時揭露的可下單性**
* `available` 不等於「實時下單會成功」。Phase 4 `createOrder` 仍可能 fail（典型情境：上游同時被多家平台下單造成 race condition）
* 對於 `supportsLiveAvailability = false` 的 supplier，`available` 是個 stale flag；不應該被用來保證 storefront 顯示「現貨」
* 狀態變化的下游連動：
  * `true → false` 且 plan 是某 product 的 primary mapping 且無可用 fallback → 觸發 [ROA-22 §1 的 `product.upstream_unmapped` 事件](https://linear.app/ravn-roam/issue/ROA-22) → product 自動 `sold_out` operational sub-state（[Phase 2 規劃稿 §4](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4)）
  * `false → true` 且 product 仍 `sold_out` → 恢復 `ok`（自動）
  * 多條 fallback 全部 `available = false` → 同上 `sold_out`

### 7.3 Change tracking

寫入時 diff 出**實質欄位**變動，逐筆寫 `supplier_plan_change_event`：

* 追蹤欄位（whitelist）：`destinations`, `dataAmountMb`, `validityDays`, `activationPolicy`, `deliveryMethod`, `costAmount`, `costCurrency`, `available`
* **不**追蹤：`rawPayload`, `lastSyncedAt`, `inventoryHint`, `metadata`, `displayName`, `upstreamUpdatedAt`（noise）

`supplier_plan_change_event(id, plan_id, field, old_value, new_value, detected_at, sync_run_id)`

**進階 alert**（若 plan 被任何 `publication_state = published` 的 product 引用為 primary）：

| 條件 | Alert |
|---|---|
| `costAmount` 24h 內變動 > 30% | `product.cost_drift_alert`（admin 自己決定要不要重 publish） |
| `dataAmountMb` 縮水 或 `validityDays` 縮水 | `product.upstream_terms_degraded` —— **嚴重**，因為 [Phase 2 規劃稿 §6 substitution rule](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4) 已禁止 fallback 縮水；primary 縮水會讓 product 出貨條件不符行銷文案 |
| `destinations` 縮減 | 同上 `upstream_terms_degraded` |
| `activationPolicy` / `deliveryMethod` 改變 | `product.upstream_terms_changed`（中度）—— 影響 Phase 4 fulfillment 行為 |

### 7.4 「消失」的 plan 處置

* Full sync 一輪沒看到 → `available = false`，`consecutive_misses += 1`
* `consecutive_misses >= 7`（連續 7 天 full sync 沒看到）→ 標 `archived_at = now()`
* Archived plan：
  * 保留 row（不刪），給 audit / 歷史 product mapping 用
  * 若仍有 `publication_state ∈ {published, paused}` 的 product 引用 → 立即觸發 ops alert
  * Admin UI 在 mapping 編輯時禁止選擇 `archived_at IS NOT NULL` 的 plan
* Archived plan 又重新出現在 sync 中（例：上游 reactivate）→ 清空 `archived_at`、`consecutive_misses = 0`、`available = true`，寫一筆 `data_quality_event(kind = 'plan_resurrected')`

---

## 8. Data quality & observability

### 8.1 Metrics（per supplier，給 Phase 6 ops dashboard 直接抓）

* `sync_run_seen_count` / `sync_run_rejected_count`（每次 run）
* `sync_run_duration_ms`
* `staleness_seconds` = `now - last_successful_sync_at`
* `auth_error_count` / `rate_limit_error_count` / `transient_error_count` / `permanent_error_count`（rolling 24h）
* `cost_drift_event_count` / `terms_degraded_event_count`（rolling 7d）
* `rejected_plan_backlog_count` = `supplier_plan_rejected` 未 retried 筆數

### 8.2 Alert thresholds（v0 預設）

| 訊號 | 條件 | 嚴重度 |
|---|---|---|
| `staleness_seconds > hard_cap` | 見 §7.1 | high — page ops |
| `rejected_count / seen_count > 10%` | 單次 sync run | high — page ops（adapter 與上游契約對不上） |
| `SupplierAuthError` 任一筆 | 立即 | critical — page on-call |
| `consecutive sync run failed >= 3` | 連續 3 次 | high — page ops |
| `cost_drift_event` 累積 24h > 5 筆 | 跨多筆 plan | medium — 寫 admin UI inbox |
| `terms_degraded_event` 任一筆 | 立即 | medium — 寫 admin UI inbox |
| `data_quality_event` 滾動 24h > 50 筆 | 全 supplier 合計 | medium — 寫 admin UI inbox |

### 8.3 Observability infra（v0 不綁死）

* Metric source：先寫 DB（`supplier_sync_run` + `data_quality_event` 兩張表 = 真相來源），Grafana / metabase 自取
* Alert channel：v0 先寫 admin UI inbox；Slack / PagerDuty 接線等 Phase 6 ops 工具進來時統一接（避免散落）
* 不在 v0 做 Prometheus exporter / OpenTelemetry trace（過度設計，Phase 6 再加）

---

## 9. Schema 增補（給 [ROA-53](https://linear.app/ravn-roam/issue/ROA-53) 直接 consume）

[Phase 2 規劃稿 §2.1 / §2.2](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4) 已給基礎欄位。以下是本 spec 額外要求。

### 9.1 `supplier` 額外欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `webhook_secret_ref` | text? | secret store key，HMAC verify 用；無 webhook 則 null |
| `last_successful_sync_at` | timestamptz? | 由 sync job 寫 |
| `last_sync_run_id` | uuid? | → `supplier_sync_run.id` |
| `capabilities_snapshot` | jsonb | adapter 回報的 capabilities 快照（debug 用） |

### 9.2 `supplier_plan` 額外欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `activation_window_days` | int? | §4 表 |
| `network_operators` | jsonb default `'[]'` | §4 表 |
| `supports_topup` | bool default false | §4 表 |
| `supports_realtime_usage` | bool default false | §4 表 |
| `metadata` | jsonb default `'{}'` | §4 表 |
| `upstream_updated_at` | timestamptz? | §4 表 |
| `archived_at` | timestamptz? | §7.4 |
| `consecutive_misses` | int default 0 | §7.4 |
| `last_sync_run_id` | uuid? | 上次見到該 plan 的 sync run |

### 9.3 新表

```
supplier_sync_run
  id              uuid pk
  supplier_id     uuid fk → supplier
  mode            enum ('pull_full', 'pull_delta', 'webhook_batch', 'manual_csv')
  started_at      timestamptz
  ended_at        timestamptz?
  status          enum ('running', 'succeeded', 'failed', 'skipped_locked')
  plans_seen      int
  plans_rejected  int
  error_summary   jsonb       -- {auth_errors: 0, transient_errors: 1, ...}
  actor           text?       -- 'cron' / 'admin:<user_id>' / 'webhook'

supplier_plan_rejected
  id              uuid pk
  supplier_id     uuid fk
  external_id     text
  raw_payload     jsonb
  reason          text         -- §5.1 條件名
  sync_run_id     uuid fk → supplier_sync_run
  attempted_at    timestamptz
  retried_at      timestamptz?
  resolved        bool default false
  index (supplier_id, external_id)

supplier_plan_change_event
  id              uuid pk
  plan_id         uuid fk → supplier_plan
  field           text         -- §7.3 whitelist
  old_value       jsonb
  new_value       jsonb
  detected_at     timestamptz
  sync_run_id     uuid fk
  index (plan_id, detected_at desc)

data_quality_event
  id              uuid pk
  supplier_id     uuid fk
  plan_id         uuid? fk
  severity        enum ('info', 'warn', 'error')
  kind            text         -- §5.2 / §7.4 / §8.2 條件名
  payload         jsonb
  occurred_at     timestamptz
  index (occurred_at desc), (supplier_id, occurred_at desc)
```

### 9.4 Migration 順序

1. 先建 4 張新表（沒有 dependency）
2. 對 `supplier` / `supplier_plan` `ALTER TABLE ADD COLUMN`（皆 nullable / default，可線上加）
3. Backfill 不需要：fresh schema 沒有歷史資料

---

## 10. Open questions（請 Ray 拍板）

| # | 問題 | 預設方向 | 影響 |
|---|---|---|---|
| 1 | 同一 supplier 是否允許同時跑 API pull + manual CSV？ | 否，二擇一（多接點建多筆 supplier row） | 若允許，merge 規則複雜，多數 supplier 不需要 |
| 2 | `supplier_plan_rejected` row 保留多久？ | 90 天滾動清除 | 平衡偵錯與 DB 大小 |
| 3 | Cost-drift threshold（目前 §5.2 寫 30%）合理嗎？ | 30%（24h window） | 太低吵、太高漏；30% 是經驗值 |
| 4 | `consecutive_misses >= 7` 才 archive 合理嗎？ | 7 天 | 給上游維運窗口 buffer |
| 5 | Webhook gap detection（24h 沉默 → 觸發 full pull）需要嗎？ | 是 | 否則 webhook infra 失效會無聲漏單 |
| 6 | **Phase 2 v0 要做 webhook 嗎**？ | **否**，只做 API pull + manual CSV；webhook 等 [ROA-47](https://linear.app/ravn-roam/issue/ROA-47) 選定 supplier 後再評估 | webhook infra（HMAC、replay、queue）成本不低，第一家若不支援就先不做 |
| 7 | Data-quality alert channel | v0 先寫 DB + admin UI inbox；Slack / PagerDuty 等 Phase 6 ops 工具 | 不阻 Phase 2 動工 |
| 8 | `supportsLiveAvailability = false` 的 supplier，是否在 storefront 顯示「上次更新時間」？ | 預設否（信任度太低，UI 會 confusing） | 若要顯示，Phase 5 storefront 多一個 field |

> 若同意上述全部預設方向，回 `OK` 即可。任何想改的點請 inline 留言或在 issue thread 補。

---

## 11. Follow-up issues（Phase 2 project）

本 spec 拍板後會開下列 issue（皆為 data-quality / ingestion 子任務，不與既有 ROA-53 / ROA-56 / ROA-58 / ROA-60 重疊）。已存在的 implementation issues 由本 spec 提供深度補完：

* ROA-56 SupplierAdapter SPI + 第一家 adapter ← 本 spec §3 是其 input
* ROA-53 Catalog schema migration ← 本 spec §9 是其 input
* ROA-58 SupplierPlan sync job ← 本 spec §6 §7 §8 是其 input

**新開 issue（本 spec follow-up）**：

| # | Title | 對應節 |
|---|---|---|
| F1 | SupplierPlan ingestion validator + rejected-row workflow | §4 §5 |
| F2 | SupplierSyncRun observability metrics + freshness alerting | §7.1 §8 |
| F3 | SupplierPlan change-tracking + cost-drift / terms-degraded events | §7.3 |
| F4 | Manual CSV import workflow (admin UI + dry-run + diff preview) | §6.4 |

Webhook ingestion 視 §10 Q6 結果決定是否開 issue。

---

## 12. Cross-spec dependencies

| 對哪份 spec | 本文與之的關係 |
|---|---|
| [ROA-15 Phase 2 architecture doc](https://linear.app/ravn-roam/document/phase-2-catalog-architecture-規劃稿-v0-1e8774abc0e4) | 本文擴張 §2.1 / §2.2 / §9.1 / §9.2，未推翻任何決定 |
| [ROA-20 domain model](https://linear.app/ravn-roam/issue/ROA-20) | `Supplier` / `SupplierPlan` 命名沿用其 canonical |
| [ROA-22 e2e lifecycle](https://linear.app/ravn-roam/issue/ROA-22) | §7.2 觸發的 `product.upstream_unmapped` 事件對齊 ROA-22 §1 Product lifecycle |
| [ROA-47 supplier landscape research](https://linear.app/ravn-roam/issue/ROA-47) | 本文寫的 SPI 假設「上游有 listPlans-able 介面」；若 ROA-47 選定的 supplier 是 manual-only，§3 capability negotiation 仍 cover |
| [ROA-50 eSIM 啟用方式技術規格](https://linear.app/ravn-roam/issue/ROA-50) | 本文只記錄 `activationPolicy` / `deliveryMethod` enum，細節推給 ROA-50 |
| [ROA-51 多幣別 / FX 策略](https://linear.app/ravn-roam/issue/ROA-51) | 本文嚴禁 adapter 做幣別轉換；轉換在 pricing 層 |

---

## 13. Glossary（本 spec 內部用詞）

* **Adapter**：把上游 API 壓平為 canonical RawPlan 的程式碼，per supplier 一個實作
* **Ingestion pipeline**：validate + upsert + emit event 的固定流程
* **RawPlan**：adapter 輸出的 canonical 結構（§3.1）
* **Sync run**：一次 sync 的執行紀錄，寫進 `supplier_sync_run`
* **Hard reject** / **soft warn**：兩段式 validation
* **Cost drift** / **terms degraded**：兩種對 published product 有影響的 change event
* **Staleness**：`now - last_successful_sync_at`，per supplier
