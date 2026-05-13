# PR previews and backward-compatible changes

LOAD-BEARING. The PR preview gate ([`05-ci-feedback.md`](./05-ci-feedback.md)) only catches frontend regressions, because that is what Vercel actually builds. Backend changes — migrations, API contract shifts, new endpoints — never touch Vercel preview, so without explicit discipline they ship blind. This rule is the discipline that keeps stage-02 PoCs honest **without** the cost of Railway PR Environments.

## Why no Railway PR Environments by default

Railway's PR Environments require Pro plan ($20/seat/month + per-PR compute). Spending $20-30/mo per PoC repo is wrong for stage-02 (which validates the dev pipeline, not multi-developer workflows). The cost makes sense only at stage-03+, when there are real reviewers iterating on the same PoC.

So at stage-02:

- **Default**: PR previews = Vercel preview (frontend) + the four discipline rules below for backend
- **Stage-03 upgrade**: when client trial / multi-reviewer kicks in, surface a one-line note in the stage-completion comment ("Recommend Railway Pro upgrade — PR Environments would catch X regressions earlier"). Don't auto-upgrade.

## The four discipline rules (apply on every backend PR)

### 1. Migration-first PR rule

Migrations get their own PR, merged **before** any feature PR that depends on them.

- A migration PR contains only: files in `migrations/` (or framework equivalent), and the **minimum** model / schema additions needed to keep the existing app booting (typically: `nullable` columns, default values, new tables — never column renames or drops in the same PR).
- A migration PR must NOT include feature logic, business code changes, or anything that depends on the new schema being populated.
- **Only one migration PR may be open at a time** for a given repo. If two migrations queue up, hold the second until the first merges.
- After a migration PR merges, every other open PR in the same repo MUST rebase onto the new base before its CI re-runs. The reviewer checks: does the rebased CI still go green?

The rule exists because all PoC PRs share **one** Postgres schema (per [`06-shared-supabase.md`](./06-shared-supabase.md)). Two PRs running migrations against the same shared schema in parallel will fight, and the second to merge wins silently. Serializing migrations through their own PR makes the conflict visible.

### 2. Backward-compatible API rule

Backend API changes are additive only:

| Change | Allowed in a single PR? |
|---|---|
| Add a new endpoint | Yes |
| Add an optional field to a request body | Yes |
| Add a new field to a response | Yes |
| Make a required field optional | Yes |
| Rename an endpoint | **No** — add new, deprecate old, remove in a later PR |
| Rename or remove a response field | **No** — same deprecation flow |
| Change a field's type | **No** — add a new field with the new type, deprecate the old |
| Tighten validation (reject previously-valid input) | **No** — gate behind a versioned endpoint |

The rule exists because frontend PR previews on Vercel point at **production** Railway (since there is no PR-scoped backend env). If a backend PR breaks the API contract, every open frontend PR's preview goes red the moment the backend merges. Backward-compat means the frontend preview stays green during the backend's review window, and the frontend can adopt the new field on its own schedule.

### 3. Deprecation path for breaking changes

When a breaking change is genuinely needed (not just convenient):

1. **Add the new shape** in PR A (new endpoint `/v2/foo`, or new field `userIdV2`). Both old and new live side-by-side.
2. **Migrate frontend to the new shape** in PR B. Old shape still works.
3. **Remove the old shape** in PR C, only after every consumer has been migrated.

For a PoC repo with a single frontend, B and C can be in the same week, but they MUST be separate commits — NOT the same PR. The reason is the same as rule #2: the moment PR A merges, the frontend's open PRs need a working backend; if A and C ship together, the frontend PRs go red.

### 4. Frontend pins backend contract

In the frontend repo (or in the same repo's frontend section), the API client / generated types are versioned. When the backend rule #2 adds a new field, the frontend explicitly opts into it by regenerating types or bumping a contract version. This makes "is this PR safe?" answerable by reading the contract diff, not by deploying both halves.

For TypeScript + Django, the canonical setup is `drf-spectacular` → `openapi-typescript-codegen`, with the generated client checked in. For other stacks, the equivalent: a generated artifact in version control whose diff is the API contract change.

## Vercel PR preview — what to set up

This is the part the agent does provision automatically at stage-02 (it's free, reversible, and the foundation of the rest):

1. **Production branch on Vercel = `ravn/integration`** (NOT `main`). See [`08-ravn-integration-branch.md`](./08-ravn-integration-branch.md) — `main` is client-clean, `ravn/integration` is what actually runs the live PoC.
2. **Preview deploys**: enabled for every branch other than `ravn/integration`. Default Vercel behavior; just verify it's on.
3. **Preview env vars**: any `NEXT_PUBLIC_*` or runtime env the preview needs goes into the Preview scope. The default `DATABASE_URL` (shared Supabase) is correct; the preview talks to the same DB as production, by design (rule #1 + #2 keep it safe).
4. **Branch deploy filter**: if the repo has paths that don't need Vercel builds (e.g. `backend/**` in a monorepo), set Vercel's "Ignored Build Step" to skip when only those paths change. This is what makes a backend-only PR's Vercel preview "skip" cleanly rather than build a stale frontend.

`scripts/bootstrap-deploy-targets.sh` (in this template) automates 1-3 against the Vercel API. Step 4 is repo-shape-dependent and stays manual.

## Railway production deploy branch

Same as Vercel: production deploy on Railway = `ravn/integration`, NOT `main`. The reason is identical — the live PoC environment serves what `ravn/integration` carries (RAVN overlay + scaffold), and `main` is the client-clean export that nobody runs.

`bootstrap-deploy-targets.sh` sets this via Railway's GraphQL API at scaffold time. If the repo doesn't have a Railway service (Vercel Functions cover the backend), this step is skipped — same as item #2 in the stage-02 checklist.

## When to reconsider

Move from "discipline rules" to "Railway PR Environments" when any of:

- A second non-Ray reviewer is regularly opening backend PRs (cost of breakage > cost of $20/mo)
- A PoC graduates to client trial with non-Ray users (regressions cost client trust)
- Migration cadence exceeds 1/week and rule #1's serialization becomes a queue

Surface the recommendation in the stage-completion comment; let Ray decide.

## What this rule does NOT relax

- The shared-Supabase rule ([`06-shared-supabase.md`](./06-shared-supabase.md)) — PR previews still hit the shared schema, not a forked one.
- The `transbiz` firewall ([`07-company-firewall.md`](./07-company-firewall.md)) — preview deploys can leak resource references just as easily as production deploys. Preview env vars go through `secrets-get.sh` from the hub, not directly into Vercel/Railway dashboards.
- The CI gate ([`05-ci-feedback.md`](./05-ci-feedback.md)) — `gh pr checks --watch --fail-fast` still runs. The Vercel preview gate is what changes shape (skip cleanly when no frontend target); the GitHub Checks gate is unconditional.
