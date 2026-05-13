# Secrets via Linear issue (upstream master)

LOAD-BEARING — applies to every credential the agent reads or requests.

Per the TEC-17 pivot (2026-05-11), **each workspace's `[secrets] <workspace> agent credentials` Linear issue is the single upstream master** for every credential the agent uses. The hub's `secrets.enc.yaml` is a **derived sops cache** — kept fresh by a one-way `Linear → sops` syncer. You read from sops; Ray (or the agent via `secrets-set.sh`) writes to the Linear issue.

This supersedes the prior 1Password-as-master pattern. Ray accepted the plaintext-in-Linear tradeoff for workflow simplicity (one system to edit, audit history is the issue activity log, both UI and API patching work).

## The model

```
            ┌─────────────────────────────────┐
            │  Linear issue (per workspace)   │   ← edit description directly OR
            │  `[secrets] <ws> credentials`   │     `./scripts/secrets-set.sh`
            │  description = markdown table   │
            └────────────────┬────────────────┘
                             │
                       syncer (one-way)
                             │
                             ▼
              ┌───────────────────────────┐
              │ ravn-hub/secrets.enc.yaml │   ← agent reads here (cache)
              └─────────────┬─────────────┘
                            │
                    `secrets-get.sh <dot.path>`
                            │
                            ▼
                        agent code
```

Three invariants:

1. **Reads still go through `secrets-get.sh`** — never read the Linear issue from agent code, never call sops directly. The cache is what the agent reads. The syncer guarantees freshness.
2. **Writes go through either** the Linear UI (multi-value edits) **or** `secrets-set.sh` (single-leaf, scripted). Both patch the same row in the same issue. Never call `sops --set` — bypasses the Linear master and the firewall audit.
3. **One master issue per Linear workspace.** `ravn` (hub) → TEC-22. `ravn-orbit` → ORB-7. Each per-client workspace gets its own when scaffolded. The pointer lives in `secrets/source.yaml` (plaintext, committed).

## When the agent needs a credential that isn't there yet

You will hit this when bootstrapping (e.g. a new Vercel personal token, a per-project Linear PAT, a GitHub fine-grained token). Do **NOT** silently paste tokens or invent a path. Instead:

1. **Compute the canonical dot-path.** e.g. `linear.<slug>.token`, `vercel.<slug>.token`, `github.fine_grained.<slug>`. Match existing prefixes — the syncer parses by exact path.
2. **Post a Linear comment dictating the exact row path** to add to the master secrets issue, plus a one-line description of which scopes / permissions the credential needs.
3. **Move the issue to `In Review`** with the `manual-required` label. Stop. Wait for Ray to add the row + run the syncer (or for the agent itself to call `secrets-set.sh` if Ray supplies the value inline).
4. On resume, verify with `./scripts/secrets-get.sh <dot.path>` before continuing. If still empty, the syncer hasn't caught up — wait, don't loop.

### Comment template

```
需要新 credential：

- Master issue：<TEC-22 / ORB-7 / …>（這個 workspace 的 [secrets] 主 issue）
- Row path（必須一字不差）：`<dot.path>`
- 用途：<one-line — what scopes / permissions / which service>

存好後 ping 我，我會等 syncer 跑完再續跑（或直接貼 token 給我，我用 secrets-set.sh 寫進去）。
```

## Why this rule exists

The earlier 1Password-as-master design hit too many friction points: `op` CLI quirks, service-account token rotation, vault ACLs, cross-machine seed, and the chicken-and-egg of "secret to unlock the secret store". The Linear-issue model trades plaintext-on-Linear (accepted by Ray) for:

1. **One system to edit** — Ray already reads/writes Linear daily.
2. **Both UI and API paths work** — humans edit description directly; scripts patch via GraphQL.
3. **Free audit log** — Linear issue activity history shows every change.
4. **Per-workspace isolation** is structural, not bolted on — each workspace has its own master issue, its own row table, its own `linear.<ws>.token` bootstrap seed.

## What NOT to do

- Do NOT read `secrets.enc.yaml` directly. Use `./scripts/secrets-get.sh`.
- Do NOT call `op` (the 1Password CLI). 1Password is no longer in the loop.
- Do NOT ask Ray to "paste the token in this comment" without naming the row path — dictate the dot-path so he can copy-paste it as the table row identifier.
- Do NOT invoke `sops --set` directly. Use `secrets-set.sh` (patches Linear, triggers sync) or edit Linear UI then re-run the syncer.
- Do NOT invent a new dot-path style — match the existing prefixes (`linear.<slug>.*`, `vercel.<slug>.*`, `supabase.shared.*`, etc.).
- Do NOT add a row whose path or value contains `transbiz` (case-insensitive). The syncer rejects with exit code 2.
