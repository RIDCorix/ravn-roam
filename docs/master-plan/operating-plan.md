# Roam Master Plan — Operating Plan v0.1 (DRAFT)

> 這份是 **Roam eSIM 平台 master plan 的運作章程**，不是產品計畫本身。
> Status: DRAFT — 待 Ray 在 [ROA-80](https://linear.app/ravn-roam/issue/ROA-80/kick-off-master-planning-and-milestone-reviews) 上確認 §2 的階段命名後升為 v1.0。
> Issue: ROA-80 · Linear project: `esim-platform-master-plan`

## 0. 為什麼有這份文件

ROA-80 要求把 initiative roadmap 變成可運作的 master plan，並定義 milestone review 怎麼跑、跨階段風險 / 依賴 / 未決事項怎麼追蹤、整體 readiness 怎麼集中呈現。這份操作章程是 ROA-80 的「第一個交付物」，之後所有 coordination issue（risk register、decision log、各 gate review 等）都依本文建立。

## 1. 角色與正本

| 角色 | 對 master plan 的責任 |
|---|---|
| Ray (`@ridcorix`) | 產品 owner、所有 milestone gate 的最終裁決者 |
| ravn-agent | 維護 artifact、跑 cadence、寫 review pack、surface blocker |
| 外部協作者 (planned) | 預計 M2+ 加入；個別 gate 視情況拉人 |

**Source of truth：**

- repo 內 `docs/master-plan/*.md` 是敘事正本；Linear 是 runtime / 通知層。漂移時 markdown 為準，由 ravn-agent 同步回 Linear。
- `.ravn/project.yaml` 內的 `linear` 區塊是 Linear 綁定 metadata 的正本（已有）。

## 2. Phase / Milestone 預設地圖 (DRAFT — 等 Ray 確認)

下表是 ravn-agent 為一個 eSIM 平台 initiative 提的 5 個預設 milestone gate。**請 Ray 在 ROA-80 留言確認或改寫**——後面 coordination issue 都依這個分段建立，現在改最便宜。

| Gate | 名稱 | 必須證明什麼 |
|---|---|---|
| M0 | Discovery scope locked | 目標市場、connectivity 模型（MNO partner / BYOC / aggregator）、營收模型已選定；platform 方向 go / no-go |
| M1 | Technical PoC validated | eSIM provisioning end-to-end 在真機跑通；可重現的 test flow |
| M2 | Spec & WBS frozen | Feature list + module breakdown 完成（依 [`agent-rules/04-wbs.md`](../../agent-rules/04-wbs.md) checklist）；對外 API contract 凍結 |
| M3 | MVP shipped | 正式環境上線；至少一位 pilot / 付費用戶有 traction signal |
| M4 | Launch readiness | 法務 / 金流 / 客服 / 維運 checklist 清；公開上市 |

每個 gate 在 Linear 用一個 `milestone-gate` label 的 issue 代表；issue 狀態即 readiness 狀態（見 §5）。Gate 之間以 Linear `blocks` 關係串：M0 blocks M1，依此類推。

## 3. Milestone review 怎麼跑

所有 gate 共用同一個流程。

### 3.1 進入條件

每個 gate issue 的 description 維護一段 `## Entry condition` block，列出觸發 review 所需的可驗證條件（不是模糊敘事）。ravn-agent 隨工作推進在 entry condition checkbox 上勾選；全部勾完即 trigger §3.2。

### 3.2 證據包 (review pack)

ravn-agent 在 gate issue 留 comment 提交固定格式的 review pack：

```markdown
# M<N> review pack — YYYY-MM-DD

## Entry condition status
- [x] <條目 1>
- [x] <條目 2>

## Evidence
- <PR / doc / demo link 1>
- <PR / doc / demo link 2>

## Open items going into review
- <one-liner>

## Recommendation
ADVANCE / RE-LOOP / SCOPE-PIVOT — <one-liner 理由>
```

提交時 issue 狀態 → `In Review`，tag `@ridcorix`。

### 3.3 決議選項

Ray 在留言三選一：

- **ADVANCE**：gate 通過，issue 轉 `Done`；下一階段的 gate issue 解除 blocked-by。
- **RE-LOOP**：Ray 點名缺什麼，ravn-agent 補完再交付。
- **SCOPE-PIVOT**：階段本身需要重畫；本文 §2 同步更新，相關 Linear issue 重整。

每筆決議寫入 decision log（§4.3）。

### 3.4 節奏

**Event-driven，沒有固定排程會議。** Entry condition 達標才排 review，gate 之間沒有 weekly review meeting。Cadence 的安排在 §6 的 weekly tick 維護。

## 4. 跨階段追蹤

### 4.1 依賴 (dependencies)

兩層：

1. Linear project-to-project `blocks` 關係（runtime，給 Ray 在 Linear UI 直接看）
2. `docs/master-plan/dependency-map.md`（敘事正本，含「為什麼 A 依賴 B」）

ravn-agent 在每次 gate review 時 reconcile 兩層。新依賴出現時 markdown 先寫、Linear 後同步。

### 4.2 風險 (risks)

單一 Linear issue **Roam risk register**（長生命週期）寄存 markdown 表：

| ID | Risk | Phase | Likelihood | Impact | Mitigation | Status | Owner | Updated |

`Status` 取值：`OPEN` / `MITIGATING` / `ACCEPTED` / `CLOSED`。

新風險出現時 ravn-agent 加列並在該 issue 留 comment tag Ray。只有「需要排工」的 mitigation 才抽成獨立 sub-issue；多數風險只追不動，避免噪音。

### 4.3 未決議題 (decisions)

單一 Linear issue **Roam decision log**（長生命週期）寄存表：

| ID | Question | Phase | Options | Recommended | Decided | Decided by | Decided on | Notes |

Ray 在表上把 `OPEN` → `DECIDED` 並寫選擇；已決議的留在 log 不刪，保留 traceability。Gate review 的每次決議也回寫一筆，連結回該 gate issue。

## 5. Readiness 單一視角

Linear custom view 名稱 **Roam Readiness**：

- Filter：`label:milestone-gate`
- Sort：phase 順序（M0 → M4）
- 每個 issue 的狀態就是該階段的 readiness 信號
  - `Backlog` = 還沒排
  - `In Progress` = entry condition 部分達標
  - `In Review` = review pack 已交付，等 Ray 決議
  - `Done` = 通過

repo 內鏡像：`docs/master-plan/readiness.md`，ravn-agent on demand 重生（不自動寫，避免 commit 噪音）。

## 6. 操作章程自身的維護

- **每週一 tick**：ravn-agent 看 risk register / decision log / readiness 三項是否有變動。有 delta 才在 ROA-80 留 comment ping Ray；沒變動不打擾。
- **每個 gate review 結束後**：跑一次 dependency map reconcile。
- **每加一個新階段或拆分既有階段**：先改本文 §2，再對應建立 / 拆 Linear 階段 issue（順序很重要——markdown 是正本）。

## 7. 待建立的 coordination issue（Ray 確認 §2 後動工）

依本文，下列 Linear issue 待建立（全部在 `esim-platform-master-plan` project 下）：

1. **Roam risk register**（長生命週期，無 due date；§4.2 表的容器）
2. **Roam decision log**（長生命週期，無 due date；§4.3 表的容器）
3. **Roam dependency map**（長生命週期，無 due date；§4.1 narrative 容器，與 markdown 鏡像）
4. **Roam M0 gate review** ~ **M4 gate review**（每個帶 `milestone-gate` label；M0 blocks M1 → … → M4）

ravn-agent 會在 Ray 在 ROA-80 確認 §2 後另開一張 issue 建立以上 8 張 issue，並把 blocks 鏈接好。在那之前先不動。

## 8. 待 Ray 確認的事項

1. **§2 的階段命名與分段**：M0–M4 是否合理？想加 / 拆 / 改名請直接在 ROA-80 留言，本文與所有後續 issue 跟著改。
2. **既有的 sibling planning project**：除了 `esim-platform-master-plan`，roadmap 上還有哪些 Linear project 已建？給 project slug 我就能把 §4.1 的依賴關係一次接好。
3. **外部協作者進場時機**：目前假設 M2+ 才接入。若有特定 partner 預計更早參與（例如 M0 就要 MNO partner 進 discovery），請指明。
4. **Risk / decision log 結構**：本文預設「單一 long-lived issue + markdown table」。若你偏好「sub-project + 一風險一張 issue」（管理度高但 overhead 大），請告訴我，我改本文 §4。
5. **Weekly tick 時間**：每週一是否 OK？或想改雙週 / 每月？
