# Admin / Support Tools — Audit & Launch Readiness Spec

> Roam eSIM · Phase 6 (Commissions, Settlement, Operations) · Linear: [ROA-78](https://linear.app/ravn-roam/issue/ROA-78/spec-admin-support-tools-audit-and-launch-readiness)
>
> 目的：定義平台正式上線前必須具備的「可支援、可治理、可審計」管理介面與運維能力。本文件是 spec，不是設計稿；交付物是後續一系列 implementation issues。

---

## 0. TL;DR

要在上線前長出三層能力：

1. **Support surface** — L1 客服能解 80% 常見問題（重發 QR、退款、查訂單），不需要工程師介入。
2. **Operations surface** — L2 運維能處理 vendor 異常、stuck order、人工指派 ICCID、佣金調整。
3. **Audit & governance** — 任何敏感動作（金流、客戶封鎖、vendor 暫停、override）都進 append-only audit log，含 actor / before / after / reason code；金額過閾值的動作走 two-person approval。

外加 **observability** + **runbooks** + **exception 處理路徑**，才算 launch-ready。

---

## 1. Personas & access tiers

| Tier | 角色 | 權限範圍 | 階段審批 |
|---|---|---|---|
| L1 Support | 客服 | 讀全部、重發 QR、重發發票、低額退款（< NT$1,500 / order）、標記 fraud 待覆核 | 單人 |
| L2 Operations | 運維 / 訂單處理 | L1 全部 + 訂單狀態 override（forward-only）、vendor pause、人工 ICCID 指派、好意 credit ≤ NT$3,000 | 單人，但所有金流動作記 audit |
| Admin / Finance | 財務 / 主管 | 全部，含 settlement run、payout hold/release、commission claw-back、規則覆寫 | 高額（≥ NT$10,000 / 累積 ≥ NT$50,000 日）強制 two-person approval |

設計原則：
- Role snapshot 於 audit 時凍結（升降級不會回溯改變歷史紀錄）。
- Admin tier 強制 MFA；L1/L2 至少 SSO + session 30 分鐘 idle timeout。
- 任何 PII 匯出（CSV / 報表）只開放給 Admin tier，且需填 reason code。

---

## 2. Admin actions catalogue

### 2.1 Orders

- 查詢：order ID、客戶 email/phone、ICCID、payment intent ID
- 檢視完整 timeline（events / payments / fulfillment attempts / communications）
- Pre-fulfillment 取消 → 自動退款
- 重發 QR / 啟用 email
- 重發發票
- 標記為 fraud（鎖客戶帳號、撤銷未發 eSIM、freeze 相關 payout）
- Vendor 失敗後重觸發 fulfillment
- State machine override（**僅允許 forward direction**，e.g. `paid → fulfilling → fulfilled`；禁止 `fulfilled → paid` 等回退）

### 2.2 Fulfillment / eSIM

- Vendor 庫存檢視（依 data plan SKU）
- 強制指定 vendor 取號
- 標記 eSIM 不良 → 自動補發 + 內部 vendor dispute ledger 記一筆
- 人工 ICCID 指派（vendor API 全死時的最後手段）
- 啟用狀態查詢（vendor 有支援的話）
- 批次補發（大規模事故）

### 2.3 Customers

- 個人資料、訂單、消費紀錄
- 封鎖 / 解封鎖（KYC / fraud）
- 重複帳號合併
- 重設認證（passwordless / OTP 卡住時）
- GDPR / CCPA / PDPA 刪除請求處理

### 2.4 Vendors

- 健康度看板：成功率、平均 fulfillment 延遲、錯誤率（rolling 24h / 7d / 30d）
- Pause（停止派新單，in-flight drain）
- Per-SKU 優先序（多 vendor 都能出同 plan 時）
- 對帳與成本/毛利顯示

### 2.5 Payouts / Settlement（Phase 6 核心）

- Commission ledger entries per affiliate/partner
- 人工調整佣金（reason code + dual approval）
- 觸發 settlement run（手動 override；正常為排程）
- Hold / release payout（fraud 覆核中）
- 對外帳單生成（PDF / CSV）
- Settlement 健康度：matched vs unmatched payments、currency reconciliation

### 2.6 Financial adjustments

- Partial / full refund
- 好意 credit（依 tier 上限）
- Refund 回沖（極少數場景）
- FX 調整（vendor 成本 FX 與 payout FX 不同時）

---

## 3. Auditability requirements

### 3.1 Audit log record schema

每筆 sensitive action 寫一筆，**append-only**：

```
audit_event {
  id                 uuid
  actor_id           uuid          -- 操作者
  actor_role         text          -- 行為當下的角色快照
  action_type        text          -- enum（見 §3.3）
  target_resource    text          -- e.g. order:abc / customer:xyz / ledger:n
  before_state       jsonb         -- 金流動作為完整 snapshot，其他為 diff
  after_state        jsonb
  reason_code        text          -- enum，部分動作必填（見 §3.3）
  reason_text        text          -- 自由說明，非必填
  ip                 inet
  user_agent         text
  session_id         uuid
  correlation_id     text          -- 對應 Linear / Slack / Zendesk 票
  approver_id        uuid          -- two-person approval 才有
  occurred_at        timestamptz   -- server-side，DB default
}
```

### 3.2 Storage policy

- Postgres append-only table，RLS 鎖死（只有審計角色能 read，誰都不能 update/delete）
- 每日 dump 到冷儲存（Supabase Storage / S3）
- 保留期：金流相關 7 年，其他 3 年
- 提供 read-only UI（actor / target / 日期 / action filter）
- SIEM webhook export 預留接口（不在 launch 必須項）
- 同 session 超過 N 分鐘執行 sensitive action → step-up auth（重輸密碼 / MFA）

### 3.3 「Sensitive」動作清單（強制走 audit + reason code）

| Action | Reason code 必填 | Two-person 門檻 |
|---|---|---|
| Refund / partial refund | ✓ | Admin tier 才能 > NT$10,000 |
| 好意 credit | ✓ | L2 ≤ NT$3,000 / Admin > NT$10,000 走 dual |
| Commission 調整 | ✓ | Admin tier，全部走 dual |
| Customer block / unblock | ✓ | 單人 |
| Vendor pause / unpause | ✓ | 單人 |
| Manual ICCID 指派 | ✓ | 單人 |
| Order state override | ✓ | 單人 |
| GDPR / CCPA delete | ✓ | Admin 單人，但 audit 永久保留動作摘要（非客戶資料） |
| Settlement run 手動觸發 | ✓ | 強制 dual |
| Payout hold / release | ✓ | Admin 單人 |
| 反向回沖 refund | ✓ | 強制 dual |

`reason_code` 應該 enum 化（e.g. `customer_request`, `chargeback`, `goodwill`, `fraud_flag`, `vendor_failure`, `internal_correction`, `legal_request`）以便日後 reporting。

---

## 4. Exception cases（launch 前必須能處理）

| # | 例外狀況 | 處理路徑 |
|---|---|---|
| 1 | **Partial fulfillment**（多項訂單部分 eSIM 失敗） | UI 顯示 per-line item 狀態；可單獨重試或退單行金額 |
| 2 | **Vendor 已收費但未交付** | 自動寫入 vendor dispute ledger；運維面板可列出未銷項 |
| 3 | **客戶重複付款** | 自動偵測 + 自動退一筆；audit 註記「duplicate_charge」 |
| 4 | **使用後退款**（data 已啟用） | 必填 reason code，預設依使用量比例核算；可被 admin override |
| 5 | **幣別錯位**（TWD 收 / USD 付 vendor） | 結算時固定 FX rate；差額入 FX adjustment ledger |
| 6 | **Stale order**（付款後 > 24h 未 fulfilled） | 自動 escalate Slack + Linear，運維介面有專屬佇列 |
| 7 | **Vendor 被 rate-limited** | Backoff + alert；超過 N 分鐘自動切備援 vendor |
| 8 | **Commission claw-back**（settlement 後底層訂單被退款） | Negative ledger entry；下次結算自動沖銷或產生 partner 負債 |
| 9 | **GDPR delete 與 7 年金流保存衝突** | 客戶 PII 刪除，金流 ledger 改存 hashed customer id；audit 永久保 |
| 10 | **客戶手機不支援 eSIM** | L1 流程：核實機型 → 退款 → mark `unsupported_device` reason code（用於 product analytics） |

---

## 5. Launch readiness checklists

### 5.1 Observability（金牌指標）

- [ ] Order funnel：`paid → fulfilling → fulfilled → activated`，每段轉換率 + p95 latency
- [ ] Vendor SLO 看板：每 vendor 的 success rate / latency p50/p95/p99
- [ ] 金流：payment provider 成功率、webhook 延遲
- [ ] 庫存：eSIM low-watermark per SKU per vendor
- [ ] Audit pipeline：事件落地速率 anomaly（drop = pipeline 壞）
- [ ] Webhook DLQ 深度（Stripe / vendor / partner）
- [ ] Client-facing 4xx / 5xx per endpoint
- [ ] Background job queue depth + oldest age

### 5.2 Runbooks（launch 前必須完成；放 `docs/runbooks/*.md`）

- [ ] `vendor-outage.md`
- [ ] `payment-provider-outage.md`
- [ ] `stuck-order-recovery.md`
- [ ] `refund-storm.md`
- [ ] `suspected-fraud-wave.md`
- [ ] `activation-failure-spike.md`
- [ ] `db-failover.md`（Supabase incident）
- [ ] `audit-log-gap-backfill.md`
- [ ] `gdpr-export.md`
- [ ] `gdpr-delete.md`

每份 runbook 結構固定：症狀、判斷流程、處理步驟（含指令 / 連結）、何時 escalate、事後文件責任人。

### 5.3 Security / Compliance

- [ ] 所有 admin endpoint：auth + role check + audit middleware（中間層攔截，不依賴呼叫端記得寫）
- [ ] Session timeout 30 min idle；強制 MFA 給 Admin tier
- [ ] PII 匯出 gated；reason code 必填
- [ ] Secrets 走 sops（per `agent-rules/10-secrets-via-linear.md`），無共用帳號
- [ ] Privacy policy 反映 audit 保留期
- [ ] Pen test scope（post-MVP，預算允許）

### 5.4 客服 launch readiness

- [ ] Top 10 預期工單的 L1 runbook（重發 QR / 退款 / 不能用 / 我手機支援嗎 / ...）
- [ ] L1 → L2 → on-call eng 升級矩陣
- [ ] 公開 status page
- [ ] Help center activation troubleshooting 文章

---

## 6. Build priorities

### P0 — blocks launch

1. Admin auth + RBAC（含 MFA、session timeout、audit middleware）
2. Audit log writer middleware + schema
3. Audit log read UI（filter + export）
4. Order lookup + 基本動作（view / resend QR / cancel / refund）
5. Vendor pause toggle + 健康度看板（簡版）
6. Refund flow（含 reason code、tier 額度檢查）
7. Top-3 runbook（vendor down / payment outage / stuck order）
8. Order funnel alert + payment success alert
9. Webhook DLQ + replay UI

### P1 — 上線後 30 天內補

10. Commission ledger + adjustment flow（含 dual approval）
11. Manual ICCID assignment
12. Customer block / unblock + customer 360 view
13. Bulk operations（批次重發 / 批次補發）
14. 剩餘 runbooks
15. Vendor cost reconciliation

### P2 — post-launch optimization

16. SIEM webhook 接出
17. 異常 anomaly auto-detection
18. Partner self-serve settlement portal
19. Status page 自動化
20. Help center 多語

---

## 7. Open questions for Ray

1. **Two-person approval 機制**：自建在 admin UI 內，還是先用 Slack #approvals channel + 截圖佐證？前者要工 2-3 週，後者可立即上線但治理較弱。
2. **退款 / credit 額度上限**：上面的數字（NT$1,500 / NT$3,000 / NT$10,000）是 placeholder，要不要照 Roam 客單價重定？
3. **資料管轄區**：launch 階段我們會服務哪幾區？GDPR（EU）/ CCPA（CA）/ PDPA（TW）保留期跟 delete 流程要先對齊。
4. **Vendor 已簽哪幾家**：spec 要不要直接放 adapter shape，還是先 generic？
5. **Affiliate / partner program**：launch 一起出，還是 Phase 6.5？這個會影響 commission ledger 的 schema 複雜度。
6. **客服工具是自建還是接 Zendesk / Intercom**：影響 audit correlation_id 設計。

---

## 8. 後續 follow-up Linear issues（建議在 Phase 6 project 內開）

| # | Issue 標題 | 描述要點 |
|---|---|---|
| 1 | Admin app scaffold (`apps/admin`) | Next.js + auth-gated + RBAC |
| 2 | Audit log schema + writer middleware | Postgres append-only table + Drizzle / Hono middleware |
| 3 | Audit log review UI | Filter / export / step-up auth |
| 4 | Order lookup + admin actions（P0 動作清單） | Vertical slice：lookup → view → resend / cancel / refund |
| 5 | Vendor health dashboard + pause toggle | 含 SLO 指標 |
| 6 | Commission ledger + adjustment flow + dual approval | Phase 6 核心 |
| 7 | Refund + credit flow + reason code enum | tier 額度檢查 |
| 8 | Runbook index + top-3 runbook draft | `docs/runbooks/` |
| 9 | Observability baseline | metrics / alerts / on-call rota |
| 10 | Customer data export / delete (GDPR/CCPA) flow | 含與 audit 保留期的衝突解法 |
| 11 | Webhook DLQ + replay tooling | Stripe / vendor / partner |
| 12 | MFA for admin tier | 走 Supabase Auth 或 WorkOS |

---

## 9. 與 Phase 6 其他 issues 的關係

本 spec 預期會被 Phase 6 project 內後續所有 implementation issues 參考。建議在 P0 issues 上線時：

- 每個 implementation PR 在 description 連回本 spec 對應段落（e.g. §2.5、§3.3）
- Spec 修訂走 PR review，commit history 即版本歷史
- 重大變更（例如新增 sensitive action 類別）需在 Linear 用 comment 公告，並回標 ROA-78

---

_文件最後更新：2026-05-13（initial draft by ravn-agent for ROA-78）_
