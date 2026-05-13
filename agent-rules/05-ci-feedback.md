# CI feedback loop

LOAD-BEARING — silent green = bug.

The agent does not get to declare a code-bearing issue done on the basis of "I pushed the PR". CI and preview deploys are the actual proof. Without this gate the agent has shipped red work as green — the exact failure mode that lost ACME-2.

## Before transitioning any code-bearing issue to `In Review`

After `git push` (whether driven by `verify-and-ship` or any other path), the agent MUST:

1. **Block on GitHub checks** until they all resolve:
   ```bash
   gh pr checks --watch --fail-fast
   ```
   Non-zero exit means at least one check failed. **Do not transition to `In Review`.** Treat the failure as a fix-loop: read the failing job's logs (`gh run view <run-id> --log-failed`), patch, push again, re-watch.

2. **Block on the Vercel preview deploy — only if the PR actually built one.** The gate is conditional on Vercel having a frontend build target on the PR's diff:
   ```bash
   VERCEL_TOKEN=$(<hub-path>/scripts/secrets-get.sh vercel.personal.token) \
     vercel inspect <preview-url> --wait
   ```
   The preview URL is the one Vercel posts as a GitHub Check on the PR. A failed deploy is the same class of defect as a failed test — fix-loop, not handoff.

   **Skip cleanly when**: the PR's diff is backend-only (e.g. monorepo `backend/**`, or a pure-backend repo where `vercel.json` excludes the changed paths). In that case Vercel posts no preview Check, and waiting for one is a deadlock. The "Ignored Build Step" config on Vercel is what makes this skip explicit; see [`09-pr-previews.md`](./09-pr-previews.md) for setup. Treat "no Vercel Check posted within 60s of `gh pr checks --watch` finishing" as the skip signal — don't wait longer.

   **Backend-only PRs are NOT unprotected.** They're covered by the four discipline rules in [`09-pr-previews.md`](./09-pr-previews.md): migration-first PR, backward-compat API, deprecation path, frontend pins contract. The Vercel preview only covers frontend regressions; backend correctness rides on those rules + the GitHub Checks gate above.

3. Only after both gates resolve (Checks green + Vercel preview either green or cleanly skipped): post the `## Conclusion`, @-mention Ray, transition to `In Review` per [`01-stage-completion.md`](./01-stage-completion.md).

## Re-trigger when CI goes red after the agent has already exited

Even with the proactive gate, CI can go red later (flaky test, post-merge deploy, dependency change). The `ravn/integration` branch carries `.github/workflows/ravn-notify-linear.yml` (seeded at scaffold time per [`08-ravn-integration-branch.md`](./08-ravn-integration-branch.md); never on `main`). On any `workflow_run` failure on a branch tied to a Linear issue, that workflow posts a Linear comment that **@-mentions the agent** with the failing job + run URL.

This means the notify glue only fires for CI runs on `ravn/integration` and its feature branches — not for `main`-bound ship PRs. That's intentional: ship PRs are a deliberate human-supervised handoff, not the agent's iteration loop. For ship-PR CI failures the agent relies on the proactive `gh pr checks --watch --fail-fast` gate above.

When the agent picks up such a mention:

- It is **not** an informational ping. It is a fix request on an issue the agent thought was done.
- The agent reopens the issue's branch, reads the failing log, patches, pushes, and re-runs the proactive gate above.
- Only after CI is green again does the agent re-transition to `In Review` and re-mention Ray.

## Branch-name convention (load-bearing for the workflow)

For `notify-linear-on-failure.yml` to know which Linear issue to comment on, branches MUST be named so the issue key is extractable:

```
<ISSUE-KEY>-<short-slug>            # e.g. ACME-12-fix-login-redirect
<ISSUE-KEY>/<short-slug>            # e.g. ACME-12/fix-login-redirect
```

The first match of the regex `[A-Z]+-[0-9]+` in the branch name is treated as the issue key. Don't deviate — branches without an extractable key skip the notify step entirely (silent), which defeats the gate.

## What this rule does NOT relax

- The PoC-stage "auto-decide reversibles" rule ([`03-poc-stage.md`](./03-poc-stage.md)) does not relax this. Red CI is not a reversible. Ship it green or surface a blocker.
