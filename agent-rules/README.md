# Agent Rules

These files are shared RAVN operating rules. They are conditional policy, not
all globally applicable to Roam.

For this repository, `AGENTS.md` and `docs/INFRA.md` are the source of truth
when they differ from older scaffold guidance:

- Roam is main-only. The older `ravn/integration` overlay does not apply.
- The production API and its Postgres run on Railway since 2026-09-05
  (`docs/RUNBOOK-storefront.md` §3a).
- Production deploy branch is `main`.
- The database schema is `roam_poc`.

When following one of the numbered rules, first check whether `AGENTS.md` or
`docs/INFRA.md` explicitly overrides it for Roam.

## Index

- Stage completion or Linear handoff: `01-stage-completion.md`
- Default infra choices: `02-default-stack.md`
- PoC-stage decisions: `03-poc-stage.md`
- WBS / Linear planning: `04-wbs.md`
- CI and preview feedback: `05-ci-feedback.md`
- Shared Supabase: `06-shared-supabase.md`
- Company-resource firewall: `07-company-firewall.md`
- PR preview / backend compatibility: `09-pr-previews.md`
- Secrets via Linear: `10-secrets-via-linear.md`

