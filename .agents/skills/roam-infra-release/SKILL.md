---
name: roam-infra-release
description: Use when working on Roam infrastructure, env vars, Vercel, Supabase, Railway, CI, deploys, secrets, Linear handoff, or release readiness.
---

# Roam Infra And Release

Use this skill for infra, deployment, credentials, CI, release readiness, and
Linear handoff work.

## Read First

- `AGENTS.md`
- `docs/INFRA.md`
- Relevant `agent-rules/*.md` files:
  - `01-stage-completion.md` for Linear handoff
  - `05-ci-feedback.md` for CI/preview gates
  - `06-shared-supabase.md` for shared database rules
  - `07-company-firewall.md` for company-resource isolation
  - `09-pr-previews.md` for preview/backward-compatible changes
  - `10-secrets-via-linear.md` for credential flow

## Repo-Specific Facts

- Roam is main-only. The older `ravn/integration` overlay does not apply unless
  a newer user instruction explicitly changes it.
- Vercel production branch is `main`; preview deploys cover other branches.
- Vercel project scope is `ridcorixs-projects`; reject anything containing
  `transbiz` in any casing.
- Supabase is shared project `ravn-shared`, schema `roam_poc`, role
  `roam_poc_user`.
- Railway is deferred unless a backend service or worker truly needs it.

## Secrets And External Resources

- Do not run login flows or create/link external resources unless the user asks.
- Fetch credentials only through the RAVN hub secrets flow described in
  `agent-rules/10-secrets-via-linear.md`.
- Never paste secrets into code, docs, terminal output, or dashboards.
- Before using external account/org/scope names, apply the `transbiz`
  substring firewall. If the only option violates it, stop and report the
  blocker.

## Release Checks

- Code-bearing changes need local verification before handoff.
- Frontend changes need typecheck/lint and build or browser verification based
  on risk.
- API changes need typecheck/tests and build when deploy output changes.
- Cross-package changes need root-level checks when practical.
- Do not mark work done or ready if CI/build/test status is unknown; report the
  exact command that still needs to run.
