# PoC stage rules (stages 01 + 02)

Stages 01-Assessment and 02-PoC exist to **validate the development pipeline** — env build, first green CI, deploy works end-to-end on the default stack. They are NOT product / spec / legal gates. PoC code is reversible.

## Auto-decide everything reversible

In stage 01 + 02 docs, the agent decides everything that's reversible at PoC stage. No lock mechanism, no client gate. Standard auto-decisions:

| Topic | Default | When to revisit |
|---|---|---|
| Persistence | **Shared Supabase Postgres** (one project, schema-per-PoC) from day 1, no SQLite step | Stage 03 if client has hard policy that requires their own infra |
| Auth | **None in PoC**, single-tenant | Stage 03 if multi-user is needed |
| API contract | **Free to change shape** | Frozen at stage 05 (Spec), not earlier |
| IP scope on inherited code | **Free hand** to refactor / delete / rewrite | Revert at stage 03 if client objects |
| Framework | Match what's already in the repo, else use RAVN defaults | — |

If a question is genuinely irreversible at PoC stage (e.g. permanently destroying inherited prod data) — surface it as a blocker per [`01-stage-completion.md`](./01-stage-completion.md), don't ship it.

After stage-01/02 wrap-up, set state to `In Review` **without** the `manual-required` label (Ray is not gating during PoC). Auto-advance fires when he comments `OK` / `ok` / `go` / `開幹` / `ship`.

## Stage-02 bootstrap checklist (LOAD-BEARING — silent skip = bug)

Every stage-02 PoC issue must close out the following seven items. Each one MUST be marked `done`, `skipped: <one-line reason>`, or `blocked: <what's missing>`. **A blank checkbox or a silent skip is a defect** — that's how the first run dropped Railway. The checklist exists to make agent's judgment legible, not to wave items through.

| # | Item | When to provision | Default tooling |
|---|---|---|---|
| 1 | **Vercel project** | If repo has any frontend / Next.js / static site (≈ always for client work) | `vercel link` + `vercel env pull`; deploy a placeholder if the build target isn't ready yet |
| 2 | **Railway project** | If repo needs a long-running backend service that doesn't fit on Vercel Functions (e.g. Python worker, Go daemon, persistent socket server) | `railway init` + `railway up`; one Railway project per repo |
| 3 | **Supabase schema** (in shared project) | If the PoC needs Postgres. Skip only if (a) PoC genuinely has no persistence, or (b) client mandated a different DB | Don't create a new Supabase project — see [`06-shared-supabase.md`](./06-shared-supabase.md) |
| 4 | **CI pipeline** | Always | GitHub Actions: lint + typecheck + test on PR + main. The RAVN-private `ravn-notify-linear.yml` lives on `ravn/integration` only (see [`08-ravn-integration-branch.md`](./08-ravn-integration-branch.md)); the client-facing `ci.yml` lives on both branches. |
| 5 | **CD pipeline + production branch = `ravn/integration`** | If anything is deployable (≈ always when item 1 or 2 fired) | Vercel + Railway production branch set to `ravn/integration` (NOT `main`) — see [`08-ravn-integration-branch.md`](./08-ravn-integration-branch.md). Preview deploys cover all other branches. Run `scripts/bootstrap-deploy-targets.sh` to set this idempotently. |
| 6 | **PR preview discipline** | If item 1 or 2 fired | Vercel PR preview enabled (free, default). Railway PR Environments NOT enabled at stage-02 — backend protected by backward-compat + migration-first rules per [`09-pr-previews.md`](./09-pr-previews.md). |
| 7 | **Pre-commit hooks** | Always | `pre-commit` or husky + lint-staged; format + lint on staged files |

Format for the issue's `## Conclusion`:

```
- [x] Vercel — done · https://vercel.com/<team>/<project>
- [x] Railway — skipped: Next.js API routes cover the backend, no separate service needed
- [x] Supabase — done · schema `acme_poc` on shared project, conn string injected into Vercel env
- [x] CI — done · .github/workflows/ci.yml
- [x] CD + prod branch — done · Vercel production branch = `ravn/integration` (Railway skipped per #2)
- [x] PR preview — done · Vercel preview enabled; Railway PR Environments deferred to stage-03 per `09-pr-previews.md`
- [x] Pre-commit — done · .husky/pre-commit + lint-staged
```

Rules of thumb:

- **"Skipped: not sure"** is not a valid skip reason. If unsure, provision it — over-provisioning a free-tier resource at PoC stage is reversible; under-provisioning hides a gap until stage 03+.
- **Blocked** means a credential / API token is missing. Surface it as a blocker per stage-completion convention, add `manual-required`, stop with `In Review`.
- Record provisioned resource IDs / URLs into `.ravn/project.yaml` under `infra:` so later stages don't re-provision.
- Use the Linear `poc-bootstrap` issue template — don't free-form the description.
