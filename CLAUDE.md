# Per-repo agent rules — `ravn-roam`

This is a personal RAVN-managed project (eSIM 產品「Roam」). External collaborators are planned but it is NOT a private freelance client engagement, so the dual-branch / Drive / stage-gate apparatus is intentionally lighter than the client template.

## Language

**一律使用繁體中文（zh-TW）與 Ray 對話、寫 Linear 評論、寫 issue 描述、寫 PR 標題與內文。** 技術名詞、CLI、檔名、code identifier、commit message、code comment 仍以英文為主。

## Source of truth

`.ravn/project.yaml` 是這個 repo 的 metadata canonical source（Linear workspace / team key、project type、created date）。Agent 動工前先讀它確認 binding 沒漂掉。

## Workflow scope

這個專案 **沒有** 走 client engagement 的 8-stage pipeline（01-Assessment → 08-Issue-Tracking）。直接 main-only branch model，無 `ravn/integration` overlay。但是底下的 infra / CI / firewall / secrets 規則仍然適用 —— 那些是跨所有 RAVN-managed repo 的共用 workflow。

## Index of agent rules

Each rule is a separate file under [`agent-rules/`](./agent-rules/). Read the relevant chapter when you start a task.

| # | Topic | When you need it |
|---|---|---|
| 1 | [Stage completion convention](./agent-rules/01-stage-completion.md) | Every issue. The 4-step finishing protocol. |
| 2 | [Default infrastructure stack](./agent-rules/02-default-stack.md) | Any deploy / infra question. Vercel + Railway + shared Supabase. |
| 3 | [PoC stage rules](./agent-rules/03-poc-stage.md) | Early exploration. Auto-decide everything reversible. |
| 4 | [Stage-04 WBS deliverable](./agent-rules/04-wbs.md) | Only if this project ever grows a WBS phase. |
| 5 | [CI feedback loop](./agent-rules/05-ci-feedback.md) | Any code-bearing issue. CI + Vercel preview gate before handoff. |
| 6 | [Shared Supabase project](./agent-rules/06-shared-supabase.md) | Any DB provisioning. One Supabase project, schema-per-project. |
| 7 | [Company-resource firewall](./agent-rules/07-company-firewall.md) | Before linking ANY external account. The `transbiz` substring rule. LOAD-BEARING. |
| 9 | [PR previews and backward-compatible changes](./agent-rules/09-pr-previews.md) | Any backend PR. Migration-first + backward-compat API rules. |
| 10 | [Secrets via Linear issue (upstream master)](./agent-rules/10-secrets-via-linear.md) | Whenever you need a credential that isn't in `secrets.enc.yaml` yet. |

Rule 8 (RAVN integration branch / dual-branch model) is **not applicable** to this repo — main-only by design (per `prompts/project-create.md` Section 2 in `ravn-hub`).

## The principle

Ray's Linear inbox is the dashboard. If your work doesn't appear there with a clear next-action, the work isn't done — even if the underlying file/PR is perfect.
