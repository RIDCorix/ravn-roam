# Company-resource firewall

LOAD-BEARING — violation = stop and escalate.

Ray works at **TransBiz**. Any account, organization, project, repository, credential, environment, or resource whose name contains the substring **`transbiz`** (case-insensitive — `transbiz`, `TransBiz`, `TRANSBIZ`, `transbizco`, `transbiz-…`, `…-transbiz`, etc.) belongs to Ray's employer and is **OFF-LIMITS for every private-client project**. This is not a soft preference — it's a hard isolation boundary.

This applies to (non-exhaustive):

- Supabase orgs / projects, Vercel teams / projects, Railway workspaces / projects
- GitHub orgs / repos, npm scopes, Cloudflare accounts, AWS / GCP / Azure accounts
- Linear workspaces, Slack workspaces, Drive folders, GCP service accounts
- API tokens, OAuth credentials, env vars, Keychain entries
- Any URL, email, or identifier where `transbiz` appears anywhere in the string

## Mandatory pre-provision check

Before creating, linking, or writing to **any** external resource for a client (Vercel, Railway, GitHub, GCP, etc. — Supabase is already locked to the shared project, see [`06-shared-supabase.md`](./06-shared-supabase.md)), the agent MUST:

1. **Fetch credentials only via `./scripts/secrets-get.sh`** from the hub repo. Never run `<service> login` (those write to the default Keychain entry, which was the exact mechanism that caused the 2026-05-01 leak). If the credential you need isn't yet in `secrets.enc.yaml`, follow [`10-secrets-via-linear.md`](./10-secrets-via-linear.md) to add it to the workspace's master secrets issue — dictate the dot-path row, don't invent a new path.
2. List available accounts / orgs / scopes using the fetched token (e.g. `VERCEL_TOKEN=$(secrets-get vercel.personal.token) vercel teams ls`, `gh org list`).
3. Reject every entry whose name, slug, ID, or URL contains `transbiz` (case-insensitive).
4. If a non-`transbiz` candidate exists → use it (and record which one in `.ravn/project.yaml`).
5. If the **only** available candidate contains `transbiz` → **STOP**. Do not proceed. Surface the blocker per [`01-stage-completion.md`](./01-stage-completion.md): post a comment "no personal account available for `<service>` — need Ray to add personal credentials to hub `secrets.enc.yaml`", add the `manual-required` label, and move the issue to `In Review`.

## Mandatory post-action audit

After any provisioning step, re-read the resource URL / ID / project ref. If it contains `transbiz` → the resource was misplaced. **Immediately** delete it (or ask Ray to delete it if you lack permission), comment on the Linear issue describing the slip, add `manual-required`, and move to `In Review`. Do not continue the bootstrap.

## Why this rule exists

On 2026-05-01 during ACME-1 PoC bootstrap, the agent ran `supabase orgs list`, saw `TransBiz` as the only org, and created `acme-demo-poc` inside Ray's employer's Supabase org. That mixed private-freelance client work into company-paid infra — a serious confidentiality and billing problem. The simple substring rule above would have caught it: "TransBiz" contains `transbiz` → reject → stop and escalate.

The PoC-stage "auto-decide reversibles" rule ([`03-poc-stage.md`](./03-poc-stage.md)) does **not** override this. Using a company resource is **not** reversible — even if the project is deleted, the API logs and audit trail remain.
