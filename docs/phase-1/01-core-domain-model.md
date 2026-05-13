# Phase 1 · 01 — Core domain model and entities

> Linear issue: [ROA-20](https://linear.app/ravn-roam/issue/ROA-20/spec-core-domain-model-and-entities)
> Sibling specs:
>
> - 02 — Roles, permissions & ownership boundaries → [ROA-21](https://linear.app/ravn-roam/issue/ROA-21)
> - 03 — End-to-end order & redemption lifecycle → [ROA-22](https://linear.app/ravn-roam/issue/ROA-22)
> - 04 — Business rules, assumptions & open questions → [ROA-23](https://linear.app/ravn-roam/issue/ROA-23)

本文件鎖定**實體模型**：每個 entity 的目的、欄位輪廓、彼此關聯、誰擁有它。

範圍邊界（這份文件不寫）：

- **狀態機 / lifecycle 轉移** → ROA-22
- **RBAC 細節**（誰能 read / write / approve） → ROA-21；本文件只標出 entity 的 **ownership scope**（platform-owned vs vendor-scoped），這是 schema 層級的事實。
- **政策決定**（折扣怎麼分攤、佣金算在哪個時點…） → ROA-23；本文件只把 schema 上**必須先回答的**建模問題以「open decision」列出。

---

## 1. Actors（快速 recap）

詳細權限請見 ROA-21。為了讓本文件能自洽地談 ownership，先用一句話定義主要 actor：

| Actor | 一句話 |
|---|---|
| **Platform admin** | RAVN 自己。擁有 supplier 整合、canonical product catalog、fulfillment 執行、payout 執行。 |
| **Tier-1 vendor (T1)** | 直接與 platform 簽約的經銷商。可上架 platform catalog 中的 product、可邀請 T2、可設定 T2 抽成。 |
| **Tier-2 vendor (T2)** | 在某一個 T1 底下的子經銷商。可上架其 parent T1 的 product，但不能直接對接 supplier。 |
| **End user** | 終端消費者。下單買 eSIM 或拿到 redemption code 後兌換。 |

---

## 2. Entity catalog

每個 entity 給：**purpose** / **key fields**（first-pass，非最終 schema）/ **ownership** / **與其他 entity 的關聯**。

### 2.1 `Supplier`

> 上游 eSIM / 流量資源提供者（例：1GLOBAL、Truphone、aggregator）。

| 維度 | 內容 |
|---|---|
| Purpose | 抽象一個外部供應商與其整合方式。Platform 對接 supplier 是**集中**的，vendor 不會直接看到 supplier。 |
| Ownership | **Platform-owned**。Vendor 看不到 supplier 名稱（business reason：保護議價空間）。 |
| Key fields | `id`、`code`（內部 slug）、`display_name`、`integration_mode`（`api` / `manual` / `csv_batch`）、`api_endpoint`、`credentials_ref`（指向 secrets store，不入庫）、`default_currency`、`payment_terms`、`status`(`active` / `paused` / `terminated`)。 |
| 與其他 entity | `Supplier 1 — * SupplierPlan`、`Supplier 1 — * Fulfillment`（fulfillment 紀錄哪個 supplier 出貨）。 |

### 2.2 `SupplierPlan`

> 一個 supplier 提供的**原始 SKU**（例：「日本 30 天 5GB 流量包」）。

| 維度 | 內容 |
|---|---|
| Purpose | 把 supplier 的目錄抽象成可被 platform 包裝的單位。Product 是基於 SupplierPlan 包裝出來的。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`supplier_id`、`supplier_sku`（上游 SKU 字串）、`name`、`region_codes`（array of ISO country codes）、`data_volume_mb`、`validity_days`、`unit_cost`、`unit_currency`、`supports_topup`、`raw_metadata`(JSONB，存上游 API 原樣回傳的 spec)、`last_synced_at`、`status`(`active` / `deprecated`)。 |
| 與其他 entity | `Supplier 1 — * SupplierPlan`、`SupplierPlan 1 — * Product`（一個 plan 可被包裝為多個 product；first-pass 也可以是 1—1，見 open decision #1）。 |

### 2.3 `Product`

> Platform 級別的**正規產品**。是 catalog 的 source of truth。

| 維度 | 內容 |
|---|---|
| Purpose | 把一個（或未來多個）SupplierPlan「包裝」成可被 vendor 上架販售的 platform 商品。**這是底層交付資源的綁定點**：fulfillment 看 Product 對應的 SupplierPlan，不看 vendor listing。 |
| Ownership | **Platform-owned**。Vendor 不能新增 Product，只能基於既有 Product 開 Listing。 |
| Key fields | `id`、`supplier_plan_id`（first-pass 1—1；未來改 bundle 時擴成 join table）、`code`（platform slug）、`display_name`、`description`、`region_codes`、`data_volume_mb`、`validity_days`、`base_cost`（platform 對 supplier 的成本，用於佣金計算的基準）、`base_currency`、`recommended_retail_price`（給 vendor 看的 RRP，非強制）、`status`(`draft` / `active` / `archived`)。 |
| 與其他 entity | `SupplierPlan ? — * Product`、`Product 1 — * VendorListing`。 |

### 2.4 `Vendor`

> 經銷商。T1 直接接 platform；T2 掛在某一個 T1 底下。

| 維度 | 內容 |
|---|---|
| Purpose | 表達銷售網絡的節點與層級關係。 |
| Ownership | **Platform-owned**（platform 核准 T1）。T1 可以建立自己底下的 T2（見 ROA-21 RBAC）。 |
| Key fields | `id`、`code`（slug，URL-friendly）、`display_name`、`tier`(`t1` / `t2`)、`parent_vendor_id`（T1 為 `null`；T2 必填，指向其 T1）、`legal_entity_name`、`tax_id`、`payout_currency`、`payout_method_ref`（指向 payout account 設定，不入庫敏感資訊）、`contact_email`、`status`(`pending` / `active` / `suspended` / `terminated`)、`onboarded_at`。 |
| 與其他 entity | `Vendor 0..1 — * Vendor`（self-referential parent）、`Vendor 1 — * VendorListing`、`Vendor 1 — * CommissionRule`（作為 recipient 或 issuer）、`Vendor 1 — * PayoutBatch`。 |

### 2.5 `VendorListing`

> 某個 vendor 對某個 Product 開的「上架條目」。**這是顧客真正看到、買到的東西**。

| 維度 | 內容 |
|---|---|
| Purpose | 把「platform 有什麼 product」與「vendor 怎麼賣它」分離。同一 Product 可以同時被多個 vendor 上架，各自定價、各自命名、各自決定折扣可用性。 |
| Ownership | **Vendor-scoped**。Vendor 可 CRUD 自己的 listing。Platform admin 有 read + 強制下架權限。 |
| Key fields | `id`、`vendor_id`、`product_id`、`display_name`（可改名，用於 vendor 品牌化）、`description_override`、`sale_price`、`sale_currency`、`available_from`、`available_until`、`max_quantity_per_order`、`allow_platform_discounts`(bool)、`allow_vendor_discounts`(bool)、`status`(`draft` / `published` / `paused` / `delisted`)、`published_at`。 |
| 與其他 entity | `Vendor 1 — * VendorListing`、`Product 1 — * VendorListing`、`VendorListing 1 — * OrderItem`。 |

> 註：本份 spec **建議採用 Product + VendorListing 分離**而非單一 Product 模型，理由見 §6 open decision #1。

### 2.6 `User`

> 終端消費者帳號。Vendor 員工帳號的處理見 open decision #11。

| 維度 | 內容 |
|---|---|
| Purpose | 識別下單者、redemption 動作的執行者、保留登入與聯絡管道。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`email`、`phone`、`display_name`、`locale`、`email_verified_at`、`phone_verified_at`、`status`(`active` / `disabled`)、`created_at`。 |
| 與其他 entity | `User 1 — * Order`、`User 1 — * Redemption`。 |

### 2.7 `Order`

> 一筆購買交易。MVP 先聚焦零售訂單（end user 向 vendor 下單）。

| 維度 | 內容 |
|---|---|
| Purpose | 把「一次結帳」綁在一起：buyer、付款狀態、金額、套用了哪些折扣。 |
| Ownership | **Platform-owned**（platform 是交易撮合方）。Vendor 可 read 與自家相關的 order；end user 可 read 自己的 order。 |
| Key fields | `id`、`order_number`（人類可讀，例：`ROA-20260513-000123`）、`buyer_user_id`、`vendor_id`（賣家，所有 line item 必須屬於同一 vendor — 見 open decision #4）、`subtotal_amount`、`discount_amount`、`total_amount`、`currency`、`payment_status`(`pending` / `authorized` / `paid` / `refunded` / `partially_refunded` / `failed`)、`payment_provider`、`payment_reference`、`placed_at`、`paid_at`、`cancelled_at`、`metadata`(JSONB)。 |
| 與其他 entity | `User 1 — * Order`、`Vendor 1 — * Order`、`Order 1 — * OrderItem`、`Order 0 — * DiscountApplication`、`Order 0 — * Refund`。 |

> 訂單**狀態機**（pending → paid → fulfilled → completed / refunded …）由 ROA-22 定義。

### 2.8 `OrderItem`

> 訂單中的單一條品項。即使 MVP 一筆訂單只買一個 eSIM，先把 line item 拆開可避免之後痛苦改 schema。

| 維度 | 內容 |
|---|---|
| Purpose | 承載「某個 Listing 被買了幾份、以什麼價格成交」。Listing 的價格會在這裡 **snapshot**，避免之後 vendor 改價影響歷史訂單。 |
| Ownership | **Platform-owned**（隨 Order）。 |
| Key fields | `id`、`order_id`、`vendor_listing_id`、`product_id`（冗餘但常查，snapshot 起來）、`supplier_plan_id`（同上，snapshot 用於 fulfillment 時不需 join 回 listing）、`unit_price`、`quantity`、`line_subtotal`、`line_discount`、`line_total`、`currency`、`listing_snapshot`(JSONB，凍結 listing 在下單時刻的 name / description / price)。 |
| 與其他 entity | `Order 1 — * OrderItem`、`OrderItem 1 — * Fulfillment`、`OrderItem 1 — * CommissionAccrual`、`OrderItem 0 — * RefundLine`。 |

### 2.9 `Fulfillment`

> 對單一 OrderItem 的「向 supplier 取得實際 eSIM 資源」這件事的記錄。**每一份 quantity 都產生一筆 Fulfillment**（見 open decision #6）。

| 維度 | 內容 |
|---|---|
| Purpose | 與 supplier 的互動紀錄、外部 ID、失敗 / 重試的審計軌跡。把 supplier 互動從 Order 抽離後，付款流程與履約流程可獨立 retry。 |
| Ownership | **Platform-owned**。Vendor 與 user 只能看到 fulfillment 的「對外狀態」（已交付 / 處理中 / 失敗）。 |
| Key fields | `id`、`order_item_id`、`supplier_id`、`supplier_plan_id`、`delivery_mode`(`direct_esim` / `redemption_code`)、`supplier_request_payload`(JSONB，sanitised)、`supplier_reference`（上游回傳的 ID，例：activation ID）、`status`(`pending` / `requested` / `delivered` / `failed` / `voided`)、`attempt_count`、`last_attempt_at`、`delivered_at`、`failure_reason`、`metadata`(JSONB)。 |
| 與其他 entity | `OrderItem 1 — * Fulfillment`、`Fulfillment 0..1 — 1 RedemptionCode`（當 `delivery_mode = redemption_code` 時產生一張 code）、`Fulfillment 0..1 — 1 ESIMAsset`（當 `delivery_mode = direct_esim` 時產生 LPA / QR 等 activation payload）。 |

### 2.10 `ESIMAsset`

> 「直接交付」模式下、可被終端用戶安裝的 eSIM activation payload（LPA string、QR code、ICCID 等）。

| 維度 | 內容 |
|---|---|
| Purpose | 把 eSIM 本身的識別資料與安裝資訊集中存放，便於補發、客服查詢、稽核。 |
| Ownership | **Platform-owned**。User 可 read 自己的；vendor 可看 metadata（不看 raw LPA 內容，避免外洩）。 |
| Key fields | `id`、`fulfillment_id`、`iccid`、`lpa_activation_string`（敏感，加密 at rest）、`qr_payload_ref`（指向物件儲存，不入庫圖檔）、`smdp_address`、`matching_id`、`installed_at`（null 直到使用者裝上）、`status`(`issued` / `installed` / `active` / `expired` / `revoked`)。 |
| 與其他 entity | `Fulfillment 1 — 1 ESIMAsset`。 |

### 2.11 `RedemptionCode`

> 「兌換碼」交付模式下產生的票券字串。可給 T2 vendor 預先批次拿去離線販售（例：實體刮刮卡 / 旅行社櫃台），或當作禮物碼。

| 維度 | 內容 |
|---|---|
| Purpose | 讓「履約」與「最終終端用戶取得 eSIM」可以**時間上脫鉤**。Fulfillment 完成 = 產生 code；Redemption 發生 = code 被某個 user 兌換為 ESIMAsset。 |
| Ownership | **Platform-owned**（code 全域唯一，見 open decision #7）。Vendor 看得到自家批次的存量與兌換率。 |
| Key fields | `id`、`code`（unique string，URL-safe）、`fulfillment_id`（產生這張 code 的履約紀錄；批次預發時可以是 null，見 open decision #2）、`vendor_id`（持有 / 分發此 code 的 vendor）、`product_id`（兌換出來會得到什麼 product）、`max_uses`（first-pass = 1）、`used_count`、`expires_at`、`status`(`active` / `redeemed` / `expired` / `revoked`)、`issued_at`、`batch_id`（nullable，批次預發時填）。 |
| 與其他 entity | `Fulfillment 0..1 — 1 RedemptionCode`、`RedemptionCode 1 — * Redemption`。 |

### 2.12 `Redemption`

> 「某個 user 在某個時刻使用了某張 code」這個**事件**。

| 維度 | 內容 |
|---|---|
| Purpose | 審計軌跡：誰、什麼時候、從哪個 IP / device 兌換了 code，並產生了哪一份 ESIMAsset。獨立成 entity 是為了支援未來多次使用 code、以及反詐欺分析。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`redemption_code_id`、`redeemed_by_user_id`、`esim_asset_id`（這次兌換產生的 asset）、`redeemed_at`、`source_ip`、`user_agent`、`status`(`succeeded` / `failed`)、`failure_reason`。 |
| 與其他 entity | `RedemptionCode 1 — * Redemption`、`User 1 — * Redemption`、`Redemption 1 — 1 ESIMAsset`。 |

### 2.13 `Discount`

> 折扣定義（不是「被套用的折扣」，那是 DiscountApplication）。

| 維度 | 內容 |
|---|---|
| Purpose | 描述一個促銷的存在：誰發的、套用範圍、規則、有效期。實際結帳時套用會另存一筆 DiscountApplication。 |
| Ownership | **取決於 issuer**：platform-owned（platform-wide 促銷）或 vendor-scoped（vendor 對自家 listing 發的折扣）。由 `issuer_type` 區分。 |
| Key fields | `id`、`code`（人類可讀促銷碼，nullable — 自動套用的折扣可沒有 code）、`issuer_type`(`platform` / `vendor`)、`issuer_vendor_id`（issuer 是 vendor 時必填）、`scope`(`all` / `vendor` / `product` / `listing`)、`scope_target_ids`(JSONB array)、`discount_type`(`percent` / `fixed_amount`)、`value`、`value_currency`（fixed_amount 時用）、`min_order_subtotal`、`max_discount_amount`、`max_total_uses`、`max_uses_per_user`、`valid_from`、`valid_until`、`status`(`draft` / `active` / `paused` / `expired`)。 |
| 與其他 entity | `Discount 1 — * DiscountApplication`、（若 vendor-issued）`Vendor 1 — * Discount`。 |

> **誰承擔折扣成本** = 政策決定，見 ROA-23。本文件 schema 不假設答案，只在 §5 ownership matrix 註記哪個 entity 持有「cost-bearing」欄位。

### 2.14 `DiscountApplication`

> 一張折扣**真的被套到某張訂單**這件事。

| 維度 | 內容 |
|---|---|
| Purpose | 不可改寫的審計記錄：哪張 order、套了哪個 discount、實際折抵多少、誰承擔。Refund 與 commission 計算都會回讀這張表。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`order_id`、`discount_id`、`discount_snapshot`(JSONB，凍結套用時 discount 的設定)、`applied_amount`、`currency`、`cost_borne_by`(`platform` / `issuer_vendor` / `split`，先收欄位，分攤規則由 ROA-23 決定)、`applied_at`。 |
| 與其他 entity | `Order 1 — * DiscountApplication`、`Discount 1 — * DiscountApplication`。 |

### 2.15 `CommissionRule`

> 「誰賺多少」的規則設定。

| 維度 | 內容 |
|---|---|
| Purpose | 描述一條佣金規則，例如「T1 vendor X 在所有 region=JP 的 product 上抽 15%」、「T2 在其 T1 之上再抽 5%」。 |
| Ownership | **混合**：platform 設 platform→T1 的 rule；T1 可設 T1→T2 的 rule（被 platform 限制邊界）。透過 `payer_type` / `payer_vendor_id` 區分。 |
| Key fields | `id`、`payer_type`(`platform` / `vendor`)、`payer_vendor_id`（payer 是 vendor 時必填）、`recipient_vendor_id`、`scope`(`all` / `product` / `listing` / `region`)、`scope_target_ids`(JSONB array)、`formula_type`(`percent_of_subtotal` / `percent_of_margin` / `fixed_per_unit`)、`value`、`value_currency`、`priority`(int，多 rule 命中時排序)、`valid_from`、`valid_until`、`status`(`active` / `paused` / `expired`)。 |
| 與其他 entity | `CommissionRule 1 — * CommissionAccrual`。 |

> 多 rule 同時命中時要怎麼疊加？→ open decision #8。

### 2.16 `CommissionAccrual`

> 「某張訂單 / order item 觸發的單筆佣金應計」。**這是一張 ledger 表，append-only**。

| 維度 | 內容 |
|---|---|
| Purpose | 把佣金算成一筆筆不可變的帳。Refund 不會去 update 已存在的 accrual，而是寫一筆 reversal entry。Payout 把已 lock 的 accrual 集合起來付出去。 |
| Ownership | **Platform-owned**。Vendor 可 read 自家的。 |
| Key fields | `id`、`order_item_id`、`rule_id`、`payer_type`(`platform` / `vendor`)、`payer_vendor_id`、`recipient_vendor_id`、`amount`（正 = 應收，負 = 沖回）、`currency`、`accrued_at`、`status`(`accrued` / `locked` / `paid` / `reversed`)、`reverses_accrual_id`（reversal entry 指回原本那筆，nullable）、`payout_line_item_id`（被結到哪個 payout，nullable）。 |
| 與其他 entity | `OrderItem 1 — * CommissionAccrual`、`CommissionRule 1 — * CommissionAccrual`、`Vendor 1 — * CommissionAccrual`（recipient）、`CommissionAccrual 0..1 — 1 PayoutLineItem`。 |

> 「accrual 何時 lock、何時可 payout」由 ROA-22 lifecycle 與 ROA-23 政策共同決定。

### 2.17 `PayoutBatch`

> 一次性把某個 vendor 在某個區間內 lock 住的 accrual 結算給他的批次。

| 維度 | 內容 |
|---|---|
| Purpose | 把多筆 accrual 打包成一次匯款 / 一次帳單。 |
| Ownership | **Platform-owned**。Vendor 可 read 自家的（含明細）。 |
| Key fields | `id`、`vendor_id`（收款人）、`period_start`、`period_end`、`gross_amount`、`fees_amount`、`net_amount`、`currency`、`status`(`draft` / `approved` / `processing` / `paid` / `failed` / `cancelled`)、`payment_method`、`external_reference`（銀行 / 金流端 ID）、`approved_at`、`paid_at`、`failure_reason`、`metadata`(JSONB)。 |
| 與其他 entity | `Vendor 1 — * PayoutBatch`、`PayoutBatch 1 — * PayoutLineItem`。 |

### 2.18 `PayoutLineItem`

> Payout 與 commission accrual 的多對一明細表（一筆 accrual 對應一筆 line item）。

| 維度 | 內容 |
|---|---|
| Purpose | 不要把 accrual 直接 update 成 `paid` 後丟資訊；保留一張 join 紀錄方便對帳。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`payout_batch_id`、`commission_accrual_id`、`amount`、`currency`。 |
| 與其他 entity | `PayoutBatch 1 — * PayoutLineItem`、`CommissionAccrual 1 — 0..1 PayoutLineItem`（一筆 accrual 最多被結進一個 payout）。 |

### 2.19 `Refund`

> 一張退款憑證（與 RefundLine 一起紀錄退了哪些 line item / 多少錢）。

| 維度 | 內容 |
|---|---|
| Purpose | 把「為什麼退、誰核准、退了多少、退到哪」集中。Refund 執行成功後會觸發 commission accrual 的 reversal。 |
| Ownership | **Platform-owned**（即使是 vendor 主動發起的退款，仍由 platform 執行金流動作）。 |
| Key fields | `id`、`order_id`、`reason_code`、`reason_note`、`initiated_by_type`(`user` / `vendor` / `platform` / `system`)、`initiated_by_id`、`gross_amount`、`currency`、`refund_method`、`external_reference`、`status`(`requested` / `approved` / `processing` / `completed` / `denied` / `failed`)、`requested_at`、`approved_at`、`completed_at`、`metadata`(JSONB)。 |
| 與其他 entity | `Order 1 — * Refund`、`Refund 1 — * RefundLine`、`Refund 觸發產生 * CommissionAccrual reversal entries`。 |

### 2.20 `RefundLine`

> 退款的明細，對應到原訂單的 line item。

| 維度 | 內容 |
|---|---|
| Purpose | 支援部分退款（quantity 部分退、金額部分退）。 |
| Ownership | **Platform-owned**。 |
| Key fields | `id`、`refund_id`、`order_item_id`、`refunded_quantity`、`refunded_amount`、`currency`。 |
| 與其他 entity | `Refund 1 — * RefundLine`、`OrderItem 1 — * RefundLine`。 |

---

## 3. Entity relationship map

```
                                    +-----------+
                                    | Supplier  |
                                    +-----+-----+
                                          | 1
                                          v *
                                   +-------------+
                                   |SupplierPlan |
                                   +------+------+
                                          | 1
                                          v ? (first-pass 1—1)
                                   +-------------+
                                   |   Product   | (platform catalog)
                                   +------+------+
                                          | 1
                                          v *
+----------+    1   *    +---------------+ 1  *  +----------+
|  Vendor  |----------->|  VendorListing |<------|  Order   |
+----+-----+             +-------+-------+   (via OrderItem)
     | parent_vendor_id          | 1
     | (self-ref T1->T2)         v *
     v                    +-------------+   1   *   +-------------+
+----+-----+              |  OrderItem  |---------->| Fulfillment |
|  Vendor  |              +------+------+           +------+------+
+----------+                     |                         | 1
                                 | 1                       v 0..1
                                 v *                +--------------+
                          +-------------+           |RedemptionCode|
                          |Commission   |           +------+-------+
                          |Accrual      |                  | 1
                          +------+------+                  v *
                                 | *                +-------------+
                                 v 0..1             |  Redemption |
                          +--------------+          +------+------+
                          |PayoutLineItem|                 | 1
                          +------+-------+                 v 1
                                 | *                +-------------+
                                 v 1                | ESIMAsset   |
                          +--------------+          +-------------+
                          | PayoutBatch  |             (also produced
                          +------+-------+              by Fulfillment
                                 | *                    when delivery_mode
                                 v 1                    = direct_esim)
                          +--------------+
                          |    Vendor    |
                          +--------------+

  Order 0—* DiscountApplication *—1 Discount
  Order 0—* Refund 1—* RefundLine *—1 OrderItem
```

> ASCII 圖只表達高階關聯。完整 DDL 要等 Phase 2 schema design 才落地。

---

## 4. Lifecycle 跨度（誰會被 lifecycle 動到）

本文件不定義狀態機（→ ROA-22）。但為了 schema 完整，先標記**哪些 entity 會有 lifecycle 狀態欄位**（上面各節都已給 `status` 候選值）：

`Supplier`、`SupplierPlan`、`Product`、`Vendor`、`VendorListing`、`Order`、`Fulfillment`、`ESIMAsset`、`RedemptionCode`、`Redemption`、`Discount`、`CommissionAccrual`、`PayoutBatch`、`Refund`。

OrderItem、DiscountApplication、PayoutLineItem、RefundLine 不獨立帶 `status`，狀態由其 parent 帶動。

---

## 5. Ownership matrix

> 「ownership」= 誰是這筆資料的 system of record，誰能 write。**RBAC 細節（read / approve / export 等）見 ROA-21。**

| Entity | Platform admin | T1 vendor | T2 vendor | End user |
|---|---|---|---|---|
| `Supplier` | **CRUD** | — | — | — |
| `SupplierPlan` | **CRUD** | — | — | — |
| `Product` | **CRUD** | — | — | — |
| `Vendor` (self) | **CRUD** | read + 限欄位更新 | read + 限欄位更新 | — |
| `Vendor` (downstream T2) | read | **CRUD（建立、暫停）** | — | — |
| `VendorListing` | read + force-delist | **CRUD on own** | **CRUD on own** | — |
| `User` | **CRUD** | — | — | self-edit |
| `Order` | read all | read own (vendor) | read own (vendor) | read own (buyer) |
| `OrderItem` | (跟 Order) | (跟 Order) | (跟 Order) | (跟 Order) |
| `Fulfillment` | **write**（系統觸發 + 手動 retry） | read own | read own | — |
| `ESIMAsset` | **write** | read metadata only | read metadata only | read own |
| `RedemptionCode` | **write** | read + 分發 own batch | read + 分發 own batch | read own redeemed |
| `Redemption` | read all | read own | read own | read own |
| `Discount` (platform-issued) | **CRUD** | read | read | — |
| `Discount` (vendor-issued) | read + force-disable | **CRUD on own** | **CRUD on own** | — |
| `DiscountApplication` | read all | read own | read own | read own |
| `CommissionRule` (platform→T1) | **CRUD** | read own | — | — |
| `CommissionRule` (T1→T2) | read + 邊界限制 | **CRUD** | read own | — |
| `CommissionAccrual` | **write**（系統觸發） | read own | read own | — |
| `PayoutBatch` | **CRUD** | read own | read own | — |
| `PayoutLineItem` | **write** | read own | read own | — |
| `Refund` | **write**（執行） | request + read own | request + read own | request + read own |
| `RefundLine` | (跟 Refund) | (跟 Refund) | (跟 Refund) | (跟 Refund) |

---

## 6. Open modeling decisions

每一項都會影響後續 API / DB schema。我給了 **first-pass 建議**，但需 Ray 確認 / 轉 ROA-23 討論。

1. **Product vs Product + VendorListing 分離？**
   - 建議：**分離**（本文件採用的模型）。
   - 理由：同一 product 可被多 vendor 上架；T2 賣 T1 的東西時不需複製 catalog；fulfillment 永遠回到 platform-canonical product，避免出貨錯。
   - 替代：單一 `Product` 帶 `vendor_id`。較簡單但會把 catalog 強綁到 vendor，後續 bundle / 多 vendor 同售很痛。

2. **Fulfillment 與 RedemptionCode 的產生時機**
   - 建議：兩種交付模式並存 — `direct_esim`（下單即 fulfillment 即拿到 ESIMAsset）vs `redemption_code`（下單即 fulfillment 即拿到 code，user 之後另行 redeem 才產生 ESIMAsset）。
   - 開放：T2 是否可**預先大量取得未綁定 buyer 的 code**（亦即 RedemptionCode 的 `fulfillment_id` 暫為 null，之後綁定）？這牽涉 inventory 模型，見 #5。

3. **SupplierPlan ↔ Product 是 1—1 還是 1—多 / 多—多？**
   - 建議：**first-pass 1—1**（一個 product 來自一個 supplier plan）。
   - 開放：未來如果要做 bundle（例：「東南亞 5 國組合」= 5 個 supplier plan 拼起來），需擴成 join table。先把 schema 預留 `product_supplier_plans` 介接表的可能。

4. **單一 Order 可否含多個 vendor 的 listing？**
   - 建議：**不行**，一張 Order 對應一個 vendor。多 vendor 結算太雜，MVP 不做。前端可以在 cart 層拆成多張 order。
   - 開放：若未來支援，需把 `vendor_id` 從 Order 拉到 OrderItem，並引入 sub-order 概念。

5. **庫存（inventory）模型**
   - 建議：**JIT（just-in-time）**。每次下單向 supplier 即時請求，不維護「庫存量」entity。
   - 開放：若 T2 要離線銷售刮刮卡，等於要持有 pre-allocated 的 RedemptionCode 庫存。是否引入 `InventoryBatch` entity（一批 codes、誰持有、剩多少）？暫定**用 `RedemptionCode.batch_id` 表達批次**，先不另開 entity。

6. **OrderItem.quantity > 1 時，Fulfillment 顆粒度？**
   - 建議：**每一份 quantity 都產生一筆獨立 Fulfillment**。
   - 理由：supplier API 通常一次發一份；fulfillment 失敗 / 重試需精確到單份；ESIMAsset 是一對一的。
   - 替代：一筆 Fulfillment 帶 array — 失敗局部回滾困難。

7. **RedemptionCode 的字串唯一性範圍**
   - 建議：**全平台唯一**（單一 namespace）。
   - 理由：user 在 redemption 頁面只輸入 code，不會輸入 vendor。要避免歧義。
   - 代價：code 字串長度需有足夠 entropy（建議 12–16 位 base32 alphabet）。

8. **多 CommissionRule 同時命中時的疊加邏輯**
   - 建議：**走 priority 欄位**，priority 高的先套；同層級的 rule 預設互斥（最高 priority 那條贏）。
   - 開放：是否要支援「疊加 stacking」（rule A + rule B 各拿一塊）？暫不支援，留欄位 `stack_strategy`(`exclusive` / `additive`) 預留。

9. **Currency / multi-currency**
   - 建議：**每張 vendor 自選結算 currency（platform 限制白名單）**；platform 內部 ledger 全部用 base currency（建議 USD），accrual 寫入時換算並 snapshot 匯率。
   - 開放：FX 匯率來源、何時鎖匯率（下單時 / 履約時 / payout 時）→ 留給 ROA-23。

10. **Discount 的 cost-bearing 政策**
    - 建議：**schema 先放 `DiscountApplication.cost_borne_by` 欄位**（`platform` / `issuer_vendor` / `split`），政策決定先空著，由 ROA-23 收斂。
    - 影響範圍：commission accrual 演算法、refund 時的金流回沖路徑。

11. **Vendor 員工帳號**
    - 建議：與 end user **共用同一張 `users` 表**，再加一張 `vendor_members`（`user_id` × `vendor_id` × `role`）做關聯。
    - 替代：另開 `vendor_users` 表 — 部分系統採此模式，但 SSO / 共用 email 時麻煩。
    - 詳細權限定義 → ROA-21。

12. **SupplierPlan 上游異動的處理**
    - 建議：Product 取 SupplierPlan 時**snapshot 主要欄位**（data volume、validity）到 `Product` 與 `OrderItem.listing_snapshot` 兩層；supplier 改規格不會回溯歷史訂單。Platform admin 需手動 re-sync 才會更新 canonical Product。
    - 開放：是否要保留 `SupplierPlan` 版本歷史（versioning）？暫不做，靠 `raw_metadata` 與 `last_synced_at` 記憶。

---

## 7. 下一步

| Owner | Action |
|---|---|
| Ray | 對 §6 的 12 個 open decision 回 ack / 反向意見（特別是 #2 inventory、#4 multi-vendor order、#10 discount cost-bearing）。 |
| ROA-21 | 套用本文件 §5 ownership matrix 為基底，補上 read / approve / export 等細欄位的 RBAC 矩陣。 |
| ROA-22 | 對 §4 列出的有 lifecycle 的 entity 定義狀態機與轉移事件。 |
| ROA-23 | 把 §6 的 open decision 之中**屬於政策**的（#5、#8、#9、#10）轉成決策清單並開出 follow-up issue。 |
| Phase 2 schema issue | 把本文件 §2 的 key fields 落地成 DDL + indices + constraints；採用 Supabase schema-per-project（見 agent-rule 06）。 |
