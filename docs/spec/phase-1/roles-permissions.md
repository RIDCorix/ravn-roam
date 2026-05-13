# Roles, permissions, and ownership boundaries — Phase 1 spec

> Source issue: [ROA-21](https://linear.app/ravn-roam/issue/ROA-21/spec-roles-permissions-and-ownership-boundaries)
> Project: eSIM Platform — Phase 1: Product spec & domain model
> Status: **Draft, awaiting Ray sign-off**

## Conclusion

定義 Roam eSIM 平台的 access model：**5 個角色**（platform admin、tier-1 vendor admin、tier-2 vendor admin、support、end user）、**每個資源的 CRUD/approve/export 能力矩陣**、**platform-managed vs vendor-managed 的所有權邊界**、以及**需要 elevated privilege + audit log 的高敏感動作**。

此 spec 是後續 backend authorization（policy engine、scope claims、RLS）與 admin UX（vendor portal、ops console、support tool）規劃的 baseline。Phase 6（commissions/settlement/ops）會在這之上長出實作層。

## Notable dependencies / blockers

* **[ROA-20](https://linear.app/ravn-roam/issue/ROA-20/spec-core-domain-model-and-entities)（核心 entity）尚未 spec** → 本文先用「合理預期」的 entity 名稱（supplier / raw plan / packaged product / vendor / order / fulfillment / redemption / discount / commission rule / commission ledger / payout / refund / audit log / customer），entity 細節以 ROA-20 為準。
* **[ROA-22](https://linear.app/ravn-roam/issue/ROA-22/spec-end-to-end-order-and-redemption-lifecycle)（lifecycle）尚未 spec** → state-transition 觸發的 sensitive action 邊界以本文 §5「Sensitive actions」列名為主，實際 transition gating 由 ROA-22 落定。
* **[ROA-16](https://linear.app/ravn-roam/issue/ROA-16/kick-off-phase-3-planning)（Phase 3 vendor hierarchy / pricing / promotions）尚未 spec** → tier-1 → tier-2 的價格區間、discount stacking、vendor invitation 細節以 Phase 3 為準；本文僅描述「誰能執行」，不定義「規則具體值」。
* **[ROA-19](https://linear.app/ravn-roam/issue/ROA-19/kick-off-phase-6-planning)（Phase 6 commissions/settlement/ops）尚未 spec** → 退款、payout、ledger 異動的 approval flow（誰能 approve、是否需要 dual control）以 Phase 6 為準；本文先記為「需 elevated privilege + audit」。
* **[ROA-18](https://linear.app/ravn-roam/issue/ROA-18/kick-off-phase-5-planning)（Phase 5 storefront）已草擬「single-identity = email、OTP / magic link、guest-by-default + account-lite claim later」** → 本文 end-user 角色沿用該模型。
* **[ROA-6](https://linear.app/ravn-roam/issue/ROA-6/金流)（金流 provider）未決** → 跟金流互動的 sensitive action（refund、void、payout）只先列「需 audit + elevation」；provider-specific permission（例如 acquirer-side 退款限制）等金流定案。
* **Roam team workflow 沒有 `In Review` 狀態** → 本 spec 完成後以 @ridcorix mention 代替 review handoff（沿用 ROA-18 慣例）。

---

## 1. Actors

| Role key | 中文名 | 範疇 | 預設帳號數量級 | 介接介面 |
| -- | -- | -- | -- | -- |
| `platform_admin` | 平台管理員 | 全域 | < 10（Roam 內部） | Ops console |
| `tier1_vendor_admin` | 一階廠商管理員 | 該 tier-1 vendor org 內全域 | 每家 vendor 1–N | Vendor portal |
| `tier2_vendor_admin` | 二階廠商管理員 | 該 tier-2 vendor org 內全域（受 tier-1 parent 限制） | 每家 sub-vendor 1–N | Vendor portal |
| `support` | 客服 | 全域 read + 受限 write | Roam 內部 + 委外 | Support tool（簡化版 ops console） |
| `end_user` | 終端使用者 | 自己的 order / eSIM / profile | unbounded | Storefront + redemption page |

### 1.1 Identity model 對應

* **Platform admin / support**：Roam 內部 SSO（Phase 6 決定 provider；day-1 可先用 Supabase Auth + email allowlist）。MFA 強制（day-1 用 TOTP，後續看 SSO provider）。
* **Vendor admin（tier-1 / tier-2）**：email-based passwordless（magic link / OTP），對應同一 vendor org 可有多名 admin（多人共用 org，非單一帳號）。MFA 強制（同樣 TOTP）。
* **End user**：沿用 ROA-18 §10——`email` 為 single identity，OTP / magic link，無密碼，guest checkout 為預設、account-lite claim later。

### 1.2 多重身分

* **同一 email 可同時為 vendor admin 與 end user 嗎？** → 預設**可以**，但兩種身分使用不同 session context（vendor portal vs storefront），不允許「在 storefront 登入後一鍵切到 vendor portal」共用 token；需各自重新驗證。理由：blast radius、audit 清楚、避免 staff 帳號順便買東西混淆 commission 歸屬。
* **同一 vendor admin 是否可同時隸屬多家 vendor？** → Day-1 **不支援**（一個帳號一家 vendor org），等實際需求出現再 spec。

---

## 2. Capability matrix

下表以「資源 × 角色」呈現核心能力。動詞語意統一定義在 §2.0。

### 2.0 動詞語意

| Verb | 意義 |
| -- | -- |
| `view` | 讀取單筆或列表（含 detail）。 |
| `create` | 新建。 |
| `edit` | 修改非敏感欄位（敏感欄位另列「sensitive edit」）。 |
| `approve` | 核可一個需 two-step 的狀態流轉（例：refund approval、payout release）。 |
| `export` | 大量匯出（CSV / JSON / report）。**任何 export 都進 audit log。** |
| `impersonate` | 以另一個帳號身分執行操作（純 read，且帶 audit）。 |

未列「✅」即視為**禁止**。某些格子標 `own` 表示僅限自己 scope 內的資料（org-scoped 或 user-scoped）。標 `policy` 表示需符合預先定義的政策條件（例：金額上限、時限）。

### 2.1 Supplier & raw plan

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Supplier connection（credentials、endpoint） | view / create / edit / export | ❌ | ❌ | ❌ | ❌ |
| Raw plan catalog（成本、覆蓋、SLA） | view / edit / export | view（**僅 metadata，不含成本**） | ❌ | view（僅 metadata） | ❌ |
| Raw plan-to-supplier mapping 異動 | edit | ❌ | ❌ | ❌ | ❌ |

**Why：** Supplier credentials 是平台 secret，永遠不暴露給 vendor。Raw plan 成本是平台談判結果，外洩會破壞商業條件 → vendor 看到的永遠是「可包裝的 raw plan metadata」，不含成本。

### 2.2 Vendor org & hierarchy

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Vendor org（任一家） | view / create / edit / suspend / export | view（own org） + edit（own org，非敏感欄位） | view（own org） + edit（own org，非敏感欄位） | view | ❌ |
| Tier-1 → tier-2 invitation | view / approve（policy） | create / view / revoke（own sub-tree） | ❌ | view | ❌ |
| Vendor tier reassignment（tier-1 ↔ tier-2 / change parent） | edit（sensitive） | ❌ | ❌ | ❌ | ❌ |
| Vendor admin 成員管理（add / remove / role） | view / edit（任一家） | view / edit（own org） | view / edit（own org） | view | ❌ |

**Sensitive edit on vendor org**：法人名稱、稅務資訊、payout 收款帳戶、parent vendor、tier、commission rate override → 只能 `platform_admin` 改，且 audit。

### 2.3 Packaged product

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Packaged product（draft / unpublished） | view / create / edit / export | view / create / edit（own org） | view（parent shared）/ ❌ create / ❌ edit | view | ❌ |
| Packaged product 發布（publish / unpublish） | approve / edit | edit（own org，within policy） | ❌ | ❌ | ❌ |
| 價格 / 折扣下限（floor） | edit | ❌ | ❌ | ❌ | ❌ |
| Tier-2 之售價（在 tier-1 允許區間內） | view | view（own sub-tree） | edit（own org，within parent-allowed range） | view | ❌ |
| 商品下架 / 強制 unpublish | edit | edit（own org） | ❌ | ❌ | ❌ |
| 公開的 product detail（顧客面） | view | view | view | view | view |

**Why（tier-2 不能 create product）：** Tier-2 的角色是 reseller，賣的是 tier-1 已包裝好、且允許分享下去的商品；tier-2 只調整在 tier-1 開放區間內的售價，不重新組裝 raw plan。

### 2.4 Discount code & promotion

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Platform-level discount（跨 vendor） | view / create / edit / export | view（自己商品被涵蓋的部分） | view（自己商品被涵蓋的部分） | view | redeem at checkout |
| Vendor-scoped discount | view / export | create / edit / export（own org） | create / edit / export（own org，within tier-1 限額） | view | redeem at checkout |
| Stacking rules / 折扣相容性 | edit | ❌ | ❌ | ❌ | ❌ |
| Manual 補發 discount code（補償個案） | create（policy） | create（policy + own org） | create（policy + own org） | create（policy，**有金額上限**） | ❌ |

**Why：** Stacking rules 是平台等級的政策（避免兩個 vendor 各放 50% off 疊起來變負毛利），不能下放。

### 2.5 Order

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Order list / detail | view / export | view（own sub-tree 銷售出去的單） | view（own org 銷售出去的單） | view（all） | view（own） |
| Order PII（顧客 email、IP、付款 metadata） | view（policy） | ❌ | ❌ | view（policy + audit） | view（own） |
| Order 取消 / refund 觸發 | approve（high-value） | request | request | request（policy） | request（own，within window） |
| Order 異動歷史 / audit trail | view / export | view（own scope） | view（own scope） | view | view（own，簡化版） |

**Why（vendor 看不到 PII）：** Vendor 看 aggregate metric（銷量、收益、退款率）已足夠驅動業務決策；PII 留在平台側統一處理可降低跨 vendor 個資外洩風險，也方便 GDPR / 台灣個資法的單點履行。Vendor 若需要個案聯絡（例：客訴），走平台代為轉介。

### 2.6 Fulfillment / eSIM

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| eSIM 紀錄（ICCID、activation code、QR） | view（policy + audit） | view（own scope，**僅遮蔽後序號**） | view（own scope，**僅遮蔽後序號**） | view（policy + audit） | view（own） |
| eSIM reissue（重發 activation） | edit（policy） | request | request | edit（policy + audit） | request（own，within policy） |
| eSIM revoke / disable | edit（policy） | request | request | request | ❌ |
| eSIM 使用量資料 | view / export | view（own scope） | view（own scope） | view | view（own） |

**Why（vendor 只看遮蔽後 ICCID）：** ICCID 全碼可被部分 supplier API 拿來重發 / 啟用，等同 credential。Vendor 沒有實際 fulfilment 操作需求 → 全碼留在平台。

### 2.7 Commission & ledger

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Commission rule（rate、attribution、reversal 條件） | view / create / edit / export | view（適用於自己的） | view（適用於自己的） | view | ❌ |
| Commission ledger entry | view / export | view / export（own org） | view / export（own org） | view | ❌ |
| Ledger 手動 adjustment | edit（policy + audit） | request | request | ❌ | ❌ |
| Commission rule 追溯適用（已成立 order 重算） | edit（**always sensitive + dual control**） | ❌ | ❌ | ❌ | ❌ |

**Why（追溯適用要 dual control）：** 改一條 commission rule 同時影響歷史帳，會牽動 payout 結算與多家 vendor 的可信任性 → 比照財務 high-risk 動作，需第二位 platform_admin approval。

### 2.8 Payout

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Payout 預估 / 對帳單 | view / export | view / export（own org） | view / export（own org） | view | ❌ |
| Payout release（觸發匯款） | approve（**dual control**） | ❌ | ❌ | ❌ | ❌ |
| Payout 帳戶資訊（收款帳戶、稅務文件） | view（policy + audit） / edit | view / edit（own org） | view / edit（own org） | ❌ | ❌ |
| Payout 失敗處理 / 重試 | edit | request | request | ❌ | ❌ |

### 2.9 Refund

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Refund request 開立 | create | create（own scope） | create（own scope） | create（policy） | create（own，within window） |
| Refund approve | approve（high-value 走 dual control） | ❌ | ❌ | approve（**僅 policy 內的小額**） | ❌ |
| Refund policy template | view / edit | view | view | view | view（簡化版於 storefront） |

**Why（support 可 approve 小額退款）：** 客服第一線常見「未啟用 + 24h 內」這類明確符合政策的 case，若每件都要 platform_admin 過手會卡客服 SLA → 設「小額 + 在政策內」自動授權給 support，超出範圍才升 platform_admin。額度由 Phase 6 定。

### 2.10 Customer / identity

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Customer 帳號（email、verified status） | view / edit（policy + audit） | ❌ | ❌ | view（policy + audit） | view / edit（own） |
| 顧客刪除 / GDPR 請求 | approve（**always sensitive**） | ❌ | ❌ | request | request（own） |
| Impersonate end user（read-only debug） | impersonate（policy + audit） | ❌ | ❌ | impersonate（policy + audit） | ❌ |
| 顧客通訊紀錄（客服對話） | view | ❌ | ❌ | view / create | view（own） |

**Why（impersonate 純 read）：** debug 顧客為什麼 redemption 失敗時很需要，但允許「以顧客身分操作」的 blast radius 太大 → impersonate 永遠 read-only，下游 mutation API 強制檢查「呼叫者本人 = subject」。

### 2.11 Audit log

| Resource | platform_admin | tier1_vendor_admin | tier2_vendor_admin | support | end_user |
| -- | -- | -- | -- | -- | -- |
| Audit log（admin / vendor / support actions） | view / export | view（own org actions） | view（own org actions） | view（own actions） | ❌ |
| Audit log 刪除 / 編輯 | **❌（append-only）** | ❌ | ❌ | ❌ | ❌ |

**Why（append-only）：** Audit log 一旦可改就失去 audit 意義；保留期由 Phase 6 定（暫定 ≥ 7 年以符合台灣財稅紀錄）。

---

## 3. Ownership boundaries

### 3.1 Platform-managed（平台所有）

| Entity | 為什麼是 platform-managed |
| -- | -- |
| Supplier connection / credential | 商業合約 + secret，不可下放。 |
| Raw plan（成本、覆蓋、SLA） | 平台談判結果。 |
| Commission rule（template、stacking、reversal） | 跨 vendor 政策，下放會破壞公平與帳務一致性。 |
| Payout cycle / 匯款執行 | 集中處理稅務與金流合規。 |
| Customer identity / PII | 個資集中存放、單點履行 GDPR / 個資法。 |
| Audit log | 系統性 trust。 |
| Refund policy template | 平台 baseline，vendor 只能在 baseline 內或更嚴格。 |
| Stacking rule / 折扣相容性 | 平台政策，避免 vendor 各自為政。 |
| eSIM activation credential 全碼（ICCID、SM-DP+、matching ID） | 等同 fulfilment credential，須集中。 |
| Storefront 框架（domain、結帳流程、SEO 結構） | 統一品牌與顧客體驗。 |

### 3.2 Vendor-managed（廠商所有）

| Entity | 為什麼是 vendor-managed |
| -- | -- |
| Packaged product（draft、命名、描述、圖片） | 商品包裝是 vendor 的業務決策。 |
| 售價（在平台 floor 與 tier-1 開放區間內） | 主價策略屬 vendor。 |
| Vendor-scoped discount code | vendor 的 promo 策略。 |
| Tier-1 → tier-2 invitation | 二階關係是 tier-1 的業務拓展。 |
| Vendor org 非敏感資料（聯絡人、Slack、營運偏好） | 內部資訊。 |
| Vendor 自己的 storefront branding（logo、tone） | 在統一框架下的自主性，僅 tier-1 可調，tier-2 沿用 parent。 |

### 3.3 邊界拉鋸區（需 ROA-16 / ROA-19 決議）

* **Tier-2 能否看到 tier-1 的成本 / margin？** 建議**否**。tier-2 只看「進貨價（即 tier-1 給 tier-2 的售價）」與「自己對顧客的售價」。
* **Tier-1 能否看到 tier-2 的顧客 PII？** 建議**否**。aggregate metric 為止；個案聯絡走平台。
* **Tier-1 能否為 tier-2 設「最低售價」與「最高折扣」？** 建議**可以**，這是 tier-1 控制下游 channel 衝突的合理手段。具體欄位以 ROA-16 為準。
* **Vendor refund 範圍是否含「我自己負擔成本」**？建議 day-1 **否**，所有 refund 走平台核可、平台執行；vendor 看到 refund 對其 commission 的反沖。
* **Support 是否分 platform support 與 vendor support（vendor 自己的客服人員）？** 建議 day-1 **只支援 platform support**；vendor 端客服需求 → vendor admin 帳號的 read scope 已足，特殊情境再加 `tier1_vendor_support` 子角色。

---

## 4. Authorization model（實作 sketch）

> 此節為實作建議，不屬於 spec 必要決議，但寫下來方便 backend / admin UX 之後對齊。

* **三維授權**：`(role, scope, action)`。
  * `role` ∈ `{platform_admin, tier1_vendor_admin, tier2_vendor_admin, support, end_user}`
  * `scope` = `org_id`（vendor 角色帶 own vendor org_id）/ `user_id`（end user 帶自己） / `*`（platform_admin / support 可見全域）
  * `action` = `{view, create, edit, approve, export, impersonate, sensitive_edit_*, ...}`，配合 §2.0 動詞語意。
* **Backend 落點建議**：
  * Postgres RLS 處理「scope 過濾」（org_scoped table 用 `org_id = current_org()`）。
  * Application-layer policy（OPA / Casbin-style，或先用 TS 簡單 decision function）處理「policy 條件」（金額上限、時間窗）與 sensitive action 的 dual-control flag。
  * Audit log 走 append-only table + `INSERT` trigger，pinning 不可由 application 寫入 `created_at` / `actor_id` 以外的欄位。
* **Session context**：JWT 內帶 `{user_id, org_id, role, mfa_verified_at}`，sensitive action 要求 `mfa_verified_at < N 分鐘`，否則 step-up MFA。
* **Vendor portal 與 storefront 各自獨立 session**，即使 email 相同也分開（呼應 §1.2）。

---

## 5. Sensitive actions（需 elevation + audit）

下列動作**一律**進 audit log，且依嚴重度需要 step-up MFA 或 dual control。

### 5.1 Always sensitive（永遠 audit + step-up MFA）

* Supplier connection credential 異動。
* Vendor tier reassignment（tier-1 ↔ tier-2、改 parent）。
* Vendor org suspend / unsuspend。
* Refund > 平台政策金額上限。
* Refund 跨原始付款 window（例：超過 60 天）。
* Manual ledger adjustment。
* Commission rule 異動。
* Payout 帳戶資訊（收款帳戶、稅務文件）變更。
* eSIM 全碼 ICCID / activation credential 讀取（即使是 platform_admin）。
* Customer PII bulk export / single-record export。
* GDPR / 個資法刪除請求核可。
* Audit log 設定變更（保留期、receivers）。
* Impersonate end user。
* Stacking rule 與折扣相容性異動。
* 平台 price floor 異動。

### 5.2 Always sensitive + dual control（需兩位 platform_admin）

* Commission rule **追溯適用**（重算歷史 ledger）。
* Payout release（觸發匯款）。
* Vendor org 刪除 / 永久關閉（含資料保留決策）。
* Audit log 保留期縮短。
* Production secret rotation（DB credential、SM-DP+ credential）。

### 5.3 Audit-only（記錄即可，不需 step-up）

* 任何 `export`（含小量 CSV）。
* `view` 涉及 PII / 全碼 ICCID。
* `impersonate`（即便 read-only）。
* 任何 vendor org 內的 admin 成員異動。
* End-user 自助請求（refund request、reissue request、刪除請求）—— 記到 audit 但不需 step-up。

---

## 6. Open questions（請 Ray 拍板）

1. **Support 角色是否 day-1 就要存在？** 還是 platform_admin 暫兼 support，到 Phase 6 ops 才正式拆？建議 **day-1 存在**（避免 platform_admin 太多人、權責不清），但實際使用人員數可極小。
2. **「Vendor admin 同時是 end user」的同 email 跨身分情境，day-1 是否真的要支援？** 還是 day-1 強制不同 email（簡化 audit 與 session 設計）？
3. **MFA 強制範圍**：所有 admin / vendor 角色強制？還是僅 platform_admin 強制、vendor admin 建議但不強制？
4. **Dual control 的「第二位 approver」**：可否由 support 角色擔任（提升 support 的權限），還是必須兩位 platform_admin？建議**必須兩位 platform_admin**。
5. **Vendor 是否可看「自己賣出去的 order 的顧客國別 / device type / locale」？** 對行銷有用、但已逼近 PII 邊界。建議**僅 aggregate（百分比、計數），不下放 row-level**。
6. **Tier-1 是否可看 tier-2 自己 staff 名單？** 建議**可以**，因為 invitation 是 tier-1 控制。
7. **Audit log 對 vendor 開放的範圍**：只開「自己 org 動作」？還是也開「平台對自己 org 的動作（例：被 suspend、被改 commission rate）」？建議**兩者都開**（透明 → 信任）。
8. **End user 是否可下載自己的「個資 export」（PDPA / GDPR 自助化）？** 建議 day-1 **以 support ticket 方式處理**，self-service 留到 Phase 6 ops 完整化後。
9. **Platform_admin 是否能直接看 supplier credential 明碼？** 還是只有「rotate / connect 測試」按鈕、credential 經由 sops 注入永不顯示？建議**永不顯示明碼**。
10. **Vendor 是否可自助 invite 別的 vendor 成為 tier-2？** 還是 tier-1 invite tier-2 也需平台預先核可？建議**不需平台核可**（tier-1 自主），但 invitation 用量觸發異常告警（防 social engineering）。

---

## 7. Follow-up issues to consider

> 等本 spec 拍板後再實際在 Linear 開出來。

| # | Title | 對應 phase | 目的 |
| -- | -- | -- | -- |
| F1 | Auth provider 選型 + admin SSO / vendor magic link 整合 spec | Phase 6 | 對應 §1.1 identity model |
| F2 | Authorization policy engine 選型（OPA vs Casbin vs in-house TS） | Phase 6 | 對應 §4 |
| F3 | Audit log schema + retention spec（append-only、destination、查詢介面） | Phase 6 | 對應 §2.11 + §5 |
| F4 | Dual-control workflow UX + state machine | Phase 6 | 對應 §5.2 |
| F5 | Vendor portal IA + role-aware navigation spec | Phase 3 / 6 | 落地 vendor admin 看到什麼 |
| F6 | Ops console IA + sensitive-action UX（step-up MFA、approval queue） | Phase 6 | 落地 platform_admin 看到什麼 |
| F7 | Support tool IA + scoped action set spec | Phase 6 | 落地 support 看到什麼 |
| F8 | Postgres RLS pattern + multi-tenant scoping conventions | Phase 6 | 對應 §4 backend 落點 |
| F9 | PII handling policy（masking、retention、impersonation 邊界） | Phase 1 補件 / Phase 6 | 對應 §2.10 + §5 |

---

## 8. Original brief（preserved）

Define the access model for the eSIM platform Phase 1 project.

Scope:

* Define platform admin, tier-1 vendor admin, tier-2 vendor admin, support, and end-user roles
* Specify what each role can view, create, edit, approve, and export
* Clarify ownership boundaries between platform-managed data and vendor-managed data
* Identify sensitive actions that require elevated privileges or auditability
* Capture unresolved permission questions for later implementation

The output should become the basis for backend authorization and admin UX planning.
