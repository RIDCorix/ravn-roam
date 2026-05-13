# Roam Storefront — 購買流程規格

> Linear: [ROA-73](https://linear.app/ravn-roam/issue/ROA-73/spec-storefront-checkout-and-product-discovery-flows)
> Project: eSIM Platform Phase 5 — Customer Storefront & Redemption Experience
> Status: Draft v1 — pending Ray review
> Last updated: 2026-05-13

本規格定義 Roam 顧客主購買旅程：discovery → PDP → cart / direct-buy → checkout → confirmation。目標是把流程談清楚到 frontend / backend 都能各自開 issue 規劃實作。

---

## 0. 範圍與假設

### 範圍

| In scope | Out of scope |
|---|---|
| 公開 storefront 的購買主流程 | 後台運營 / 商品 CMS / 進銷存 |
| 商品瀏覽、PDP、結帳、付款後確認頁 | eSIM 啟用 / 安裝引導頁（屬 redemption 流程，另開 spec） |
| 顧客在購買前需要提供的最少資料 | 客服退換 / 爭議處理流程 |
| Guest 與 account 分界 | 訂閱 / 自動續訂模型 |
| Discount code 套用、價格呈現 | Affiliate / B2B / promo 後台 |
| 訂單確認 e-mail 與站內確認頁觸發點 | 推播、行銷自動化 |
| 為 storefront UX / checkout logic / localization 各開一張 follow-up issue | Loyalty / 點數 / 推薦人 |

### 核心假設（待 Ray 確認）

A1. **商品本體**：一個 SKU = 一張 eSIM data plan，attributes 為 `coverage`（國家 / 區域）、`data_quota`、`validity_days`、`network_tier`、`price_currency`、`price_amount`，外加 `device_compatibility_note`。**沒有實體 SIM 卡 SKU**。
A2. **主購買場景是「出國前一次性購買」**，少量加購（多國 / 多人同行）。因此預設體驗是 **direct-buy（單品立即購）**，但需支援 cart 容納 2–5 件同行情境。
A3. **顧客身分最少資料 = email**。其他（電話、姓名、國籍、語系、幣別）能不要就不要。device IMEI / EID 留給 redemption 流程，不擋結帳。
A4. **預設語系 zh-TW、預設幣別 TWD**，但首發即支援 en-US / USD 至少一組副幣別（顧客通常在國外用得到）。Phase 5 不打算上多餘語系。
A5. **第三方金流先選 Stripe**（卡 + Apple/Google Pay）；台灣本地 ATM / 超商代碼在 Phase 5 不上，這項決策需要 Ray 點頭。
A6. **發票 / 報帳**：個人三聯式 / 公司載具屬台灣硬需求，本 spec 中標為 "P0 for TW, scope as Phase 5"。
A7. **eSIM 交付方式**：付款成功後同時 (a) 在站內顯示 QR Code + 啟用碼、(b) 寄送 confirmation email 附 QR Code 與 deep link。**不需要實體寄送，沒有運費**。

如 A1–A7 任何一項 Ray 想推翻，影響的章節已標註對應依賴。

---

## 1. Persona & Entry points

### Persona

| Persona | 比例假設 | 行為特徵 |
|---|---|---|
| **P1 — 出國前打包客** | ~70% | 機票確定後 1–14 天搜尋；高 intent；只想要「能不能用」+「多少錢」 |
| **P2 — 在國外才驚覺客** | ~20% | 已在落地當下；要求安裝快、語系容錯（會切英文） |
| **P3 — 替家人代買者** | ~10% | 多筆購買、email 可能不是收件人本人；要轉送 QR 給別人 |

任何 UX 決策有衝突時，**以 P1 為主、P2 為次**。P3 影響 [§5.4 多 SIM / 轉贈]。

### 進站入口

E1. SEO landing — 「日本 eSIM」這類 keyword landing page → discovery
E2. 直接到首頁 → discovery
E3. App push / email deep link →（Phase 5 後期才會出現，本 spec 假設「能成功 deep link 到 PDP」即可，不展開）

---

## 2. Product Discovery

### 2.1 主要動線

```
Landing → 選目的地（國家 / 區域 / 多國）→ Plan list（依目的地過濾）→ 點 PDP
```

**設計原則**：80% 的人是「為了某趟旅程」進站，不是「想逛 eSIM」。Discovery 的第一個輸入點必須是 **destination**，不是 plan type / data 量。

### 2.2 必要 surface

| Surface | 用途 | 必含元素 |
|---|---|---|
| **首頁** | 給 P1 / P3：選目的地 | 目的地 search box（autocomplete）、熱門目的地 chips（日 / 韓 / 美 / 歐多國 / 東南亞）、「我在國外」捷徑 |
| **目的地落地頁** `/destinations/[country]` | SEO + 該目的地的 plan list | H1 = `<country> eSIM 方案`、coverage note、3–8 個 plan card、FAQ section |
| **區域 landing** `/regions/[region]` | 多國卡（歐洲、東南亞）共用 | 同上 + 涵蓋國家清單 |
| **Plan list 自然頁** `/plans` | 全站 fallback / 給 SEO 機器人 | 全部 plan 可分頁列表，依目的地 facet 過濾 |

### 2.3 Plan card 必含欄位

```
[Country flag(s)] <plan name>
<data_quota> · <validity_days> 天 · <network_tier>
原價 / 折扣後價（含幣別切換）
[查看詳情] (按鈕跳 PDP)
```

不要在 card 上塞 device compatibility 或 activation 步驟 — 那屬於 PDP 內容。

### 2.4 Facet 與排序

- **Facet（多選）**：data quota（1GB / 3GB / 10GB / 無限）、validity（1–3 天 / 4–7 天 / 8–30 天）、network tier（standard / premium）、coverage 國家數（1 / 多國）
- **排序**：建議價格 ↑（default）、性價比 ↓、validity ↓、人氣 ↓
- 不上「最新上架」這種無意義排序

### 2.5 SEO / shareable URL

- 目的地頁與 plan list 頁面的 facet 必須反映在 query string，**facet 改變等於可 share 的 URL**
- Plan card 點擊 → PDP 是 client-side route，但 URL 必須切到 `/plans/[plan-slug]`，**不可用 modal 取代 PDP**（影響 P3 把連結傳給家人）

---

## 3. Product Detail Page（PDP）

### 3.1 上半屏

| 欄位 | 內容 |
|---|---|
| Hero | 目的地國旗 / 多國拼貼、plan name、coverage 國家清單（>5 國時 collapsible） |
| 售價 | 主幣別大字、副幣別小字、若 promo 啟用顯示原價 strike + 折扣後 |
| 商品規格 | `data_quota`、`validity_days`、`network_tier`、`activation_window`（買後幾天內必須啟用，過期失效） |
| 動詞按鈕 | **「立即購買」** primary（= direct-buy 進 checkout）；**「加入購物車」** secondary |
| 信任元素 | 「7 日內未啟用全額退款」、「即時取得 QR Code」、付款方式 icons |

### 3.2 下半屏

- 安裝/相容性說明（折疊區塊）：iOS / Android 支援列表 + 「我的手機支援 eSIM 嗎」連結
- FAQ accordion（每個 plan 共用 8–10 題模板）
- 「相關 plan」橫向卷軸：同目的地不同 quota、同 quota 不同國家
- 用戶評價（**Phase 5 不上 UGC，所以這區可先留空或只放 founder note**）

### 3.3 數量選擇

- 預設數量 = 1，可調 1–10（同卡多份 = 一次幫多人買）。**11 份以上引導去 B2B 表單**（不在本 spec scope）。
- 數量改變時，價格區即時 reflow，不要等到 cart / checkout 才算

### 3.4 跨幣別與稅費呈現

- 顯示「未稅價」+「含稅後估價」並標註 `*VAT/GST 依目的地與帳單地址不同，最終以 checkout 為準`
- 切換主副幣別僅切換顯示，不改實際結帳幣別（避免歷史價格混淆）。**結帳幣別在 checkout 第一步綁定**。

---

## 4. Cart vs Direct-buy

### 4.1 兩種動線並存

```
PDP →[立即購買]→ Checkout（cart 內容 = 該 PDP × 數量，無關現有 cart）
PDP →[加入購物車]→ Mini-cart drawer → 繼續逛 / 去結帳
```

- **「立即購買」不污染既有 cart**：把當前 PDP 商品開一個獨立 checkout context，cart 內既有東西保持原狀。FE 實作可用「ephemeral cart instance」。
- 這個設計來自 A2：絕大多數顧客只買 1 件；強迫他們「先加入 cart 再去 cart 看」是多一個 click，沒收益。

### 4.2 Cart 內容

- Cart 是 **per-browser / per-account** 級別（登入後合併 anonymous cart）
- 內含：plan thumbnail、name、quantity stepper、單價、小計、移除按鈕
- Cart 不做「儲存稍後購買 / wishlist」（out of scope）
- Cart 過 7 天未結帳，自動清空（防止 promo / 匯率漂掉）

### 4.3 限制

| 規則 | 理由 |
|---|---|
| 單一 checkout 最多 10 件 | 與 PDP 數量上限一致；超過要走 B2B |
| 不可混不同結帳幣別 | 一張訂單一個 currency；若 cart 內既有商品幣別 ≠ 新加入的幣別，提示「會切換到 X 幣別」 |
| 同 plan 不同數量 → 合併為單一 row | 不要出現兩 row 同一 plan |

---

## 5. Checkout

### 5.1 流程概觀（單頁 stepper，不是多頁）

```
[ 1. Contact ] → [ 2. Billing / Tax info ] → [ 3. Payment ] → [ 4. Review & Pay ]
```

- 用 **單頁 + 分段** 而不是多 route。理由：減少 page transition 焦慮，且購買單品時三步幾乎都能 prefill。
- 每個 step 區塊 collapsible；下一段 enable 條件 = 上一段必填完成。

### 5.2 Step 1 — Contact

最少欄位（強約束）：

| 欄位 | 必填 | 用途 |
|---|---|---|
| `email` | ✅ | confirmation + QR code 寄送 |
| `email_confirm` | ❌ | 不要做雙重輸入；改用即時 format 檢查 + 寄送後可改寄 |
| `phone` | ❌（**可選**） | 客服聯絡；不擋結帳 |
| 帳號註冊勾選框 | ❌ | 「也幫我建立 Roam 帳號」default checked；下方僅多一個 password 欄位（可後續用 magic link 補設） |

**Guest 模式即此區的 default**：email 填了、不勾「建立帳號」、按下一步。

### 5.3 Step 2 — Billing / Tax info

| 欄位 | 必填 | 邏輯 |
|---|---|---|
| `billing_country` | ✅ | 影響稅率、發票格式、可用付款方式 |
| `currency` | ✅ | 預設依 `billing_country` mapping；可在此 step 改一次，改了之後鎖定到下單結束 |
| TW 限定：發票類型 | ✅（TW 適用） | 三聯（公司）/ 二聯 + 載具 / 捐贈；預設「二聯 + 手機條碼載具」 |
| 公司抬頭 + 統編 | 視發票類型 | 三聯選擇時 enable |
| Billing address | 視 Stripe 要求最少欄位 | 國家 + zip 即足夠（不收街道） |

### 5.4 Step 3 — Payment

- 來源：Stripe Payment Element，動態列出可用付款方式
- 起步支援：信用卡（Visa / MC / JCB / AmEx）、Apple Pay、Google Pay
- **不在 Phase 5 上**：ATM、超商代碼、LINE Pay、街口（這些有非同步結算，會把 confirmation 邏輯複雜化 — 寫進 [§5.6 退路]）
- 顯示完整金額：subtotal、tax、discount、total（**所有金額都要在這步前 final**，不能到付款後才更新）

### 5.5 Step 4 — Review & Pay

- 不可編輯訊息的最終確認
- 顯示：商品清單、配送方式 = 「電子交付（無運費）」、付款金額、條款勾選
- 條款勾選：服務條款 + 隱私政策（必勾，不要 default check）
- 「Pay」按鈕觸發 Stripe confirm；confirm 成功後 redirect 到 `/orders/[id]/confirmation`

### 5.6 退路（這版本不做但要寫進 backlog）

- 非同步付款（ATM / 超商）→ confirmation 必須等 webhook，PDP 與 cart UX 都會改；獨立 spec
- BNPL → 同上
- 訂閱 / auto-topup → 完全不同 cart model，獨立 spec

---

## 6. 顧客身分輸入：guest vs account 分界

### 6.1 預設體驗 = Guest-friendly

**結帳完成不要求帳號**。理由：A2 主場景一次性購買，要求帳號會直接 drop conversion。

### 6.2 何時才強制要帳號

| 動作 | Guest 可以？ | 理由 |
|---|---|---|
| 瀏覽 + 加入 cart | ✅ | 無門檻 |
| 結帳 + 拿到 QR Code + email confirmation | ✅ | 等同零售體驗 |
| 查歷史訂單（含網頁版 QR Code） | ⚠️ 有限 | 寄出的 email 內含一次性 magic link → `/orders/[id]?token=...`；token 30 天有效 |
| 對既有 eSIM 加值 / topup | ❌ | 必須帳號（因為要綁定 eSIM 與帳號的關係） |
| 重新下載 / 重發 QR Code（超過 30 天） | ❌ | 必須帳號或客服驗證 |
| 多裝置使用同一 eSIM 重新安裝 | ❌ | 必須帳號 |

### 6.3 升級為 account 的時機

A. Checkout step 1 的「也幫我建立 Roam 帳號」default checked（密碼欄位可選；不填則用 magic link 機制）。
B. Confirmation 頁面有 "Save your order" CTA，guest 點了就用同 email 建帳號。
C. Email confirmation 內含 deep link「建立帳號以管理本訂單」。

不要在結帳前彈窗逼用戶註冊，不要把 cart 鎖在登入後。

### 6.4 帳號模型最低 schema

```
account {
  id, email (unique), email_verified_at,
  password_hash (nullable, 支援 magic link only),
  default_currency, default_locale,
  created_at, last_login_at
}
order {
  id, account_id (nullable for guest), email, currency,
  subtotal, tax, discount, total, status,
  created_at, paid_at, ...
}
esim {
  id, order_id, plan_id, qr_payload, activation_code,
  activation_window_end, activated_at, status
}
```

Guest 訂單的 `account_id = null`；後續用 same-email 註冊時，**自動把 same-email guest 訂單 attach 到新帳號**（merge 邏輯放 backend）。

---

## 7. Pricing 呈現與 Discount

### 7.1 價格元素

每個顯示金額的地方都要清楚拆解：

```
Subtotal:        TWD 599
  Plan × 1       TWD 599
Discount:       -TWD  50   (code: FIRST50)
Tax (estimated): TWD  27   (5% VAT, billed in TW)
─────────────────────────
Total:           TWD 576
```

- 列表 / PDP / cart 顯示 **「未稅 + 註解 」**；checkout step 3+ 顯示 **「含稅 final」**
- 折扣 line 永遠用負號開頭，避免歧義

### 7.2 Discount code 套用點

| 階段 | 是否可套 | UX |
|---|---|---|
| PDP | ❌ | 不在 PDP 加 promo 欄位，避免顧客還沒下決定就在試碼 |
| Cart | ✅ | 「使用優惠碼」可展開區塊，套用後即時 reflow cart 小計 |
| Checkout step 4（Review） | ✅ | 同 cart 邏輯；最後一次機會 |
| Confirmation 之後 | ❌ | 不可追補 |

### 7.3 Discount 規則（backend 視角，FE 不關心細節）

- 一張訂單最多套 1 個 code（**先不做疊加**）
- 類型支援：fixed amount、percentage off、free upgrade（升一個 quota tier）
- 限制欄位：min subtotal、specific plan / region、first-order-only、expire date、usage cap（全站 / 單帳號）
- 不滿足條件 → 顯示具體原因（"此優惠僅限新顧客"），不要只顯示「無效」

### 7.4 多幣別 / FX

- Plan 在 DB 是 `price_amount_twd`（base）；其他幣別由每天更新一次的 FX rate snapshot 算出來
- Checkout step 2 鎖定 currency 後，**整個訂單以該 currency 落帳**；FE 之後不再 reflow
- 不做即時 spot rate（FX 風險吃在 Roam 這邊，但確保顧客看到的價就是付的價）

---

## 8. Order Confirmation

### 8.1 觸發點

Stripe `payment_intent.succeeded` webhook 是 source of truth。**不是** redirect 後的 client-side success — redirect 可能失敗，webhook 不可漏。

### 8.2 雙通道

| 通道 | 內容 | SLA |
|---|---|---|
| **站內 confirmation page** `/orders/[id]/confirmation?token=...` | QR Code（互動 SVG）+ 啟用碼 + 安裝步驟 deep link + 訂單摘要 | ≤ 2 秒 |
| **Email** | 同上 + PDF 附件（QR + 訂單明細）；From: `orders@roam-app` | ≤ 60 秒 |

email 模板必須含 P3 場景：「想把這張 eSIM 轉送給家人？把這封信整封轉寄即可」。

### 8.3 必含元素

- 訂單編號（顧客好讀格式：`ROAM-2026-XXXXX`，非 UUID）
- 啟用期限警示（"請於 2026-06-13 前啟用"）
- 取得發票連結（TW 限定，連結到財政部電子發票或內部下載）
- 「需要協助？」客服 CTA

### 8.4 失敗情境

| 情境 | 處理 |
|---|---|
| Webhook 收到但 QR Code 還沒生成（後端非同步） | confirmation page 顯示「QR Code 製作中，最多 60 秒」+ 自動 poll + email 仍會寄 |
| Webhook 失敗 / 延遲 > 5 分鐘 | 站內顯示「付款已完成但 QR 尚未就緒，已寄通知客服」+ 自動觸發 alert |
| 付款失敗 | 留在 checkout step 4，顯示 Stripe error；cart 不清空 |
| 用戶關了 confirmation page 又找不到 email | guest：email 內 magic link 永遠可重進；account：登入後 `/orders` 看訂單 |

---

## 9. Guest vs Account：實作邊界總表

| 介面 / API | Guest 可做 | Account 可做 |
|---|---|---|
| `POST /api/cart` | ✅ session cart | ✅ persisted cart |
| `POST /api/checkout/init` | ✅ | ✅ |
| `POST /api/orders` | ✅（要 email） | ✅ |
| `GET /api/orders/[id]?token=...` | ✅（30d magic token） | ✅ |
| `GET /api/orders`（list） | ❌ | ✅ |
| `POST /api/orders/[id]/topup` | ❌ | ✅ |
| `POST /api/esims/[id]/reissue-qr` | ❌ | ✅ |
| `POST /api/account/merge-guest-orders` | n/a | ✅（隱式於註冊流程） |

實作要點：所有 guest API 都吃 magic token；不要做 IP / cookie session 綁定的「鬆綁認證」— 太脆又難 audit。

---

## 10. Localization 切面

### 10.1 範圍（Phase 5 首發）

- **語系**：zh-TW（default）、en-US
- **幣別**：TWD（default）、USD（副）
- **時區**：UI 用顧客瀏覽器時區顯示「activation deadline」；DB 一律 UTC

### 10.2 必須 localize 的內容

| 內容 | 來源 | i18n key 還是 dynamic |
|---|---|---|
| UI label / 按鈕 / 表單 | i18n key | ✅ |
| Plan name / description | DB i18n field（`name_zh_tw`、`name_en_us`）| dynamic |
| Country / region 名稱 | i18n library（`@formatjs/intl-displaynames` 或同類） | dynamic |
| Discount 失敗訊息 | i18n key | ✅ |
| Email 模板 | 分檔 per locale | ✅ |
| 法務（ToS / Privacy） | 各語系獨立 markdown | dynamic |

### 10.3 切換 UX

- Header 提供語系 + 幣別 dropdown，**兩個分開**（語系不強制決定幣別）
- Locale persist 在 cookie（`roam_locale`、`roam_currency`），登入後同步到 account default
- **URL strategy**：採 `/[locale]/...` prefix（`/zh-TW/plans` vs `/en-US/plans`），有利 SEO；default locale 也帶 prefix，不省略

### 10.4 寫法規則（給 FE 後續執行）

- 不可硬寫中英文字串在 component；所有面向顧客的字串走 i18n
- 數字 / 貨幣用 `Intl.NumberFormat`；日期用 `Intl.DateTimeFormat`
- RTL：Phase 5 不上 RTL 語系；不要為了 RTL 額外加 abstraction

---

## 11. Frontend / Backend 規劃輸入

### 11.1 Frontend 可以開始的章節

- §2 Discovery 各頁面結構與 facet URL 策略
- §3 PDP layout + 數量 / 幣別切換邏輯
- §4 Cart 與「立即購買」雙通道 UX
- §5 Checkout 單頁 stepper（含 Stripe Payment Element 接法）
- §8 Confirmation 頁面 + QR Code SVG render
- §10 i18n 結構與 URL 策略

### 11.2 Backend 可以開始的章節

- §1 商品 schema（plans / pricing / FX snapshot）
- §6 帳號 / 訂單 / eSIM schema
- §7 Discount engine（rule eval）
- §8 Stripe webhook + QR 生成 pipeline + email 寄送
- §9 Guest magic token + account merge
- §10 DB i18n field 與多幣別落帳

### 11.3 共用介面（先談清楚再開工）

- `Plan` API shape（PDP / list / cart 共用一份 DTO）
- `Cart` API shape（含 currency lock 規則）
- `Order` API shape（含 guest token 欄位）
- `Discount` 套用 API（input / output）

→ 拆 follow-up issue 「Define Plan / Cart / Order / Discount DTO contracts」（見 §13）。

---

## 12. 開放問題（Ray 點頭即可解鎖）

| # | 問題 | 影響 |
|---|---|---|
| Q1 | A5：Phase 5 是否限定 Stripe（卡 + Apple/Google Pay），ATM / 超商先擱置？ | §5.4、§5.6 |
| Q2 | A6：個人化發票 / 公司載具是否必須 Phase 5 上？或可拆出 Phase 5.5？ | §5.3 TW 區塊、§8.3 發票連結 |
| Q3 | A7：是否確認 **電子交付（無實體 SIM 卡）** 是唯一 fulfillment？ | 整個 §8 與運費 UX |
| Q4 | §6.3 帳號 default checked：是否認可「打勾建帳號 + magic-link 補設密碼」這條 UX？ | §6 整章與註冊流程 |
| Q5 | §7.4 多幣別：價格用 daily FX snapshot 是否可接受（FX 風險吃在 Roam）？或要走即時 quote？ | §3.4、§5.3 |
| Q6 | §10.2 多語系是否首發只上 zh-TW + en-US？日文（日本目的地大宗）是否要排入 Phase 5？ | §10 整章與 plan i18n schema |

---

## 13. Follow-up issues（在 Linear 另開）

| Issue 草稿標題 | Project | 焦點 |
|---|---|---|
| **ROA-?? Storefront UX wireframes & component inventory** | Phase 5 | §2 / §3 / §4 / §8 的視覺與互動 wireframe；不含 checkout step 細節 |
| **ROA-?? Checkout logic & Stripe integration spec** | Phase 5 | §5 / §7 / §8 webhook 與訂單狀態機；訂出 API contract |
| **ROA-?? Storefront localization & i18n architecture** | Phase 5 | §10 整章；i18n library 選型、URL prefix、DB i18n 欄位 |

每張 follow-up 開時必須：parent = ROA-73，project = Phase 5，labels = `spec`、`phase-5`。內文先 reference 本檔對應章節即可，不複製貼上。

---

## 14. 不會做的事（明確排除）

- 不做 wishlist / save for later
- 不做評論 / UGC（Phase 5 之後再評估）
- 不做訂閱 / auto-renew
- 不做多人協作 cart
- 不做 affiliate / referral 流量分潤
- 不做積分 / loyalty
- 不做 RTL 語系
- 不做網頁端 eSIM 啟用引導（屬 redemption 流程，另張 issue）
