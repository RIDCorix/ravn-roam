# ROA-70 follow-up issues — drop-in 草稿

> 從 [`ROA-70-order-orchestration.md`](./ROA-70-order-orchestration.md) §13 拆出來。每張可直接複製進 Linear，建議全部掛在同一個 project（eSIM Platform Phase 4），parent = ROA-70。
>
> Status：草稿；Ray 確認 OQ-9（第一批 supplier）後可展開 F-S2/S3。

---

## 三 cluster + 依賴關係

```
F-O1 (state machine schema) ──┬──► F-O2 (routing engine)
                              ├──► F-O3 (idempotency layer)
                              └──► F-O4 (lifecycle worker)
                                        ▲
F-O5 (catalog model) ─────────────────────┘
                                        ▲
F-S1 (adapter interface + mock) ──────────┘
                                        ▲
F-S4 (supplier webhook endpoint) ─────────┘
                                        ▲
F-S5 (polling fallback) ──────────────────┘
                                        ▲
F-S2/S3 (real adapters, per supplier) ────┘

F-Obs1 (event log) ◄── 與 F-O4 並行（worker 寫 event）
F-Obs2 (dashboard) ◄── 等 F-Obs1
F-Obs3 (health-check) ◄── 並行可，但 wired-in 留 Phase 5
```

---

## Orchestration cluster

### F-O1 — Order state machine + persistence schema
**Scope**
- Migrations：`orders`、`order_events`、`supplier_orders`、`supplier_inbox`、`payment_inbox`、`order_idempotency_keys`。
- ORM models / type definitions（依 stack 選 Drizzle/Prisma/sqlc，待 PoC 階段定）。
- 不含 business logic — pure schema + 啟動空 model。

**Acceptance**
- `pnpm migrate` 在共用 Supabase `roam_dev` schema 跑得過。
- 每個 state（§1 spec）至少有 enum 對應。
- 適用 `agent-rules/09-pr-previews.md` migration-first 規則：本 issue 自成一個 PR，不夾任何 feature code。

**依賴**：無。

---

### F-O2 — Routing engine + candidate scoring
**Scope**
- `resolveCandidates(order) → ScoredCandidate[]`
- §3 結構讀取、§4 scoring（Phase 4 純 priority + 三層 tie-breaker）、§6 hard constraint filter（region / inventory cap / 維護窗 / 健康 / 合約）。
- 庫存 atomic reservation 介面（§6.1）。
- 不含實際呼叫 supplier — 純函式 + DB query。

**Acceptance**
- 單測涵蓋：候選為空 / 全部被 constraint 剔除 / tie-breaker 路徑 / inventory 競爭。
- 確定論：同樣輸入兩次跑要得到同樣排序（用 supplier_id 字典序 tie-break）。

**依賴**：F-O1, F-O5（catalog 資料才能 query）。

---

### F-O3 — Idempotency layer & inbox tables
**Scope**
- §10 列的所有點位：order create idempotency key、payment webhook inbox、order routing advisory lock、supplier dispatch attempt id、supplier webhook inbox、profile 寫入 transactional guard。
- 共用 helper（middleware / decorator）讓後續 adapter 接得進來。

**Acceptance**
- 對任一點位送 2 次相同 event → 只一筆生效。
- Replay test：把過去 24h 的 inbox 全部 replay → state 不變。

**依賴**：F-O1。

---

### F-O4 — Order lifecycle worker
**Scope**
- Long-running worker（Railway service per `agent-rules/02-default-stack.md`）。
- 訂閱 `order.paid` → 跑 routing（呼 F-O2）→ adapter dispatch（呼 F-S1）→ 處理 ack / failed / fallback（§5）→ 落 fulfilled / exhausted。
- 含 §5.3 async timeout 機制與 polling fallback hook（實作在 F-S5）。

**Acceptance**
- 用 mock adapter（F-S1）跑 happy path → state 走完。
- 注入 permanent / transient / billing error → 各自走預期分支。
- Kill worker mid-flight → 重啟後 advisory lock 釋放、流程可繼續。

**依賴**：F-O1, F-O2, F-O3, F-S1。

---

### F-O5 — Catalog data model（PackagedProduct + SupplierPlanCandidate）
**Scope**
- Migration：`packaged_products`、`supplier_plan_candidates`、`suppliers`、`supplier_maintenance_windows`。
- YAML loader（`catalog/*.yaml` → DB seed），供無 admin UI 期間更新。
- 不含 admin UI（拉到 Phase 5）。

**Acceptance**
- 改動 yaml + 重跑 loader → DB 收斂。
- 每個 PackagedProduct 至少 1 個 SupplierPlanCandidate，否則 loader 報錯。

**依賴**：F-O1。

---

## Supplier integration cluster

### F-S1 — Supplier adapter interface + mock implementation
**Scope**
- `SupplierAdapter` interface（§7.1 / §8.1 envelope in/out）。
- `MockSupplierAdapter`：可程式化注入「立即成功 / async ack 後 webhook / 立即失敗 / rate limit / 逾時」等行為。
- Adapter registry（`supplier_id → adapter` 對應）。

**Acceptance**
- F-O4 worker 可只依賴 MockSupplierAdapter 跑全套 e2e。
- 介面文件齊全：未來真實 adapter 不需動 worker 程式碼。

**依賴**：無（schema-only 的 envelope；不依 F-O1）。**這張先做，是其他 supplier 任務的前提**。

---

### F-S2 — Adapter — `<supplier_a>`
**Scope**：依 OQ-9 結果選定第一家後展開。實作 §7 / §8 投影 + auth + retry policy。
**依賴**：F-S1。OQ-9 阻擋。

### F-S3 — Adapter — `<supplier_b>`
（同上，第二家）

### F-S4 — Supplier webhook endpoint + signature verification
**Scope**
- `POST /webhooks/suppliers/{supplier_id}` 路由 → adapter → `SupplierOrderResult` → worker。
- HMAC 驗 + replay window 5min + IP allowlist（per supplier 設定）。
- 不認得的 event type 暫存 supplier_inbox。

**Acceptance**
- 重送同 event → 200 no-op。
- 偽造 signature → 401。

**依賴**：F-S1, F-O3。

---

### F-S5 — Polling fallback for async suppliers
**Scope**
- 對提供 query API 的 supplier 註冊 poller。Worker 在等 webhook 過半時間後啟動。
- 設定 §5.3 上限與 backoff。

**Acceptance**
- 模擬 supplier 不回 webhook、只回 poll → profile 仍可拿到。
- 模擬 supplier 同時回 webhook + poll → idempotent，僅一筆 profile 落地。

**依賴**：F-O4, F-S1, F-S4。

---

## Observability cluster

### F-Obs1 — Structured event log + trace_id propagation
**Scope**
- §11 events 全部 emit。trace_id 從 `POST /orders` 進來、貫穿 worker / adapter / webhook。
- 寫到 `order_events` table + console JSON line（forward to logging stack 在 Phase 5）。

**依賴**：F-O1。

### F-Obs2 — Order lifecycle dashboard + alerts
**Scope**
- P95 fulfillment time、supplier error-rate、exhausted rate、refund rate。
- 告警通道：先 Slack（待 secret 入），Linear comment fallback。

**依賴**：F-Obs1。

### F-Obs3 — Supplier health-check job
**Scope**
- 定期探 supplier endpoint（ping / 空查單 / 已知 plan dry-run）。
- 結果寫 `supplier_health` table，供 §4 dynamic_penalty 與 §6 健康 constraint 讀取。
- Phase 4 只建 schema + idle job；Phase 5 enable scoring。

**依賴**：F-O1, F-S1。

---

## 不直接屬於 Phase 4 ordering 子項（但建議單獨開 issue）

| Title | 依賴 OQ |
|---|---|
| 退款 / 退單 flow 設計 | OQ-4 |
| 用量 / 到期 / 暫停事件 webhook 處理 | OQ-8 |
| Bulk / B2B 訂單 API | OQ-3 |
| 多 SIM / 多 plan 訂單支援 | OQ-2 |
| Customer PII minimisation policy → supplier | OQ-6 |
| Catalog admin UI（取代 yaml） | OQ-10 |
