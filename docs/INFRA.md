# Infra setup

End-to-end checklist for getting the Roam marketing site running on
**Vercel** (web hosting + previews) and the **shared Supabase project**
(`ravn-shared`). Items marked _dashboard_ must be done by a human with
the right account access — they cannot be driven from this repo.

This repo is **main-only** (per `CLAUDE.md` — rule 8's
`ravn/integration` overlay does NOT apply here). Production deploy
target = `main`; previews = every other branch.

Railway is active for the backend API — see [§4](#4--railway--backend-api).

References:

- `node_modules/next/dist/docs/01-app/02-guides/deploying-to-platforms.md`
- `agent-rules/02-default-stack.md` (Vercel + Supabase defaults)
- `agent-rules/06-shared-supabase.md` (one project, schema-per-PoC)
- `agent-rules/07-company-firewall.md` (reject any `transbiz` resource)
- `agent-rules/09-pr-previews.md` (Vercel preview discipline)
- `agent-rules/10-secrets-via-linear.md` (creds via hub `secrets-get.sh`)

---

## 1. Vercel — hosting + preview deploys

Next.js 16 ships a verified Vercel adapter and Vercel auto-detects
everything, so **no `vercel.json` is needed** for the default deploy.

Project: `roam-web` in scope `ridcorixs-projects` (firewall-cleared —
no `transbiz` substring). Project metadata is recorded in
`.ravn/project.yaml` under `infra.vercel`.

**Verified at scaffold time (agent-driven):**

1. `vercel link --yes --project roam-web --scope ridcorixs-projects`
   linked the local checkout.
2. `vercel git connect …` connected the GitHub repo so every push /
   PR triggers a preview deploy automatically.
3. Production branch = `main` (matches this repo's main-only model).

**Dashboard steps (human, one-time):**

1. Open the Vercel project → _Settings → Environment Variables_ and add
   the entries listed in [§3 — Env vars](#3--env-vars). Values come
   from the hub (see [§5](#5--credentials--hub-secrets-flow)) — do NOT
   paste secrets manually from elsewhere.
2. Confirm _Settings → Git_ shows the repo connected and "Preview
   Deployments" is enabled for all branches.
3. (Later) Add the custom domain under _Settings → Domains_.

---

## 2. Supabase — shared Postgres (one project, schema-per-PoC)

All RAVN-managed PoCs share the single `ravn-shared` Supabase project.
Roam gets isolation via its own Postgres schema + a least-privilege
role, **not** a separate Supabase project. See
`agent-rules/06-shared-supabase.md`.

**Naming for this repo (two roles, one schema):**

| Asset            | `roam_poc_user` (apps)                                   | `roam_poc_backend` (services/api + migrations)                   |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Schema           | `roam_poc`                                               | `roam_poc`                                                       |
| Role search_path | `roam_poc`                                               | `roam_poc`                                                       |
| Secret root      | `supabase.shared.poc_roles.roam_poc.*` (hub Linear)      | `supabase.shared.poc_roles.roam_poc_backend.*` (hub Linear)      |
| Connection URL   | hub: `supabase.shared.poc_roles.roam_poc.connection_url` | hub: `supabase.shared.poc_roles.roam_poc_backend.connection_url` |
| Used by          | `apps/web` SSR, `apps/landing` SSR (read/write under RLS)| `services/api`, `drizzle-kit` migrations                         |

**Provisioning (one-time, human-driven against the shared project):**

1. From the hub repo:
   ```bash
   PGPASSWORD=$(<hub>/scripts/secrets-get.sh supabase.shared.db_password) \
     psql "host=$(<hub>/scripts/secrets-get.sh supabase.shared.db_host) port=5432 user=postgres dbname=postgres sslmode=require"
   ```
2. Inside psql, provision the schema + the read/write role for apps:
   ```sql
   CREATE SCHEMA roam_poc;
   CREATE ROLE roam_poc_user WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE ON SCHEMA roam_poc TO roam_poc_user;
   GRANT ALL ON SCHEMA roam_poc TO roam_poc_user;
   ALTER ROLE roam_poc_user SET search_path TO roam_poc;
   REVOKE ALL ON SCHEMA public FROM roam_poc_user;
   ```
3. Provision the backend / migration role (ROA-94). Same schema, separate
   credentials so `services/api` and `drizzle-kit` never share secrets with
   the apps tier:
   ```sql
   CREATE ROLE roam_poc_backend WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE, CREATE ON SCHEMA roam_poc TO roam_poc_backend;
   GRANT ALL ON ALL TABLES IN SCHEMA roam_poc TO roam_poc_backend;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA roam_poc TO roam_poc_backend;
   GRANT ALL ON ALL FUNCTIONS IN SCHEMA roam_poc TO roam_poc_backend;
   ALTER DEFAULT PRIVILEGES IN SCHEMA roam_poc GRANT ALL ON TABLES TO roam_poc_backend;
   ALTER DEFAULT PRIVILEGES IN SCHEMA roam_poc GRANT ALL ON SEQUENCES TO roam_poc_backend;
   ALTER ROLE roam_poc_backend SET search_path TO roam_poc;
   REVOKE ALL ON SCHEMA public FROM roam_poc_backend;
   ```
4. Record `roam_poc` + both role names (NOT passwords) in
   `.ravn/project.yaml` under `infra.supabase.roles`.
5. Add the credentials as rows to the hub master secrets issue (TEC-22) per
   `agent-rules/10-secrets-via-linear.md`:
   - `supabase.shared.poc_roles.roam_poc.password`
   - `supabase.shared.poc_roles.roam_poc.connection_url`
   - `supabase.shared.poc_roles.roam_poc_backend.password`
   - `supabase.shared.poc_roles.roam_poc_backend.connection_url`

   Backend connection URL shape:
   ```
   postgres://roam_poc_backend:<pass>@<db_host>:5432/postgres?sslmode=require&options=--search_path%3Droam_poc
   ```

**Client usage in this repo:**

- Browser components: `import { createSupabaseBrowserClient } from "@/lib/supabase/client"`.
- Server components / Route Handlers: `import { createSupabaseServerClient } from "@/lib/supabase/server"`.
- Server-side direct Postgres (Prisma / drizzle / pg): connect via
  `process.env.DATABASE_URL` only. **Do NOT** import the shared
  `service_role_key` from app code (rule 06).

---

## 3. Env vars

| Variable                        | Where it runs        | Required | Hub secret path                                             |
| ------------------------------- | -------------------- | -------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server     | Yes      | `supabase.shared.url`                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server     | Yes      | `supabase.shared.anon_key`                                  |
| `DATABASE_URL` (apps)           | `apps/*` server only | When DB  | `supabase.shared.poc_roles.roam_poc.connection_url`         |
| `DATABASE_URL` (api)            | `services/api`       | When DB  | `supabase.shared.poc_roles.roam_poc_backend.connection_url` |
| `FASTMOVE_BASE_URL`             | `services/api`       | Yes      | `fastmove.api.base_url`                                     |
| `FASTMOVE_MERCHANT_ID`          | `services/api`       | Yes      | `fastmove.api.merchant_id`                                  |
| `FASTMOVE_MERCHANT_KEY`         | `services/api`       | Yes      | `fastmove.api.merchant_key`                                 |
| `GIT_SHA`                       | `services/api`       | No       | Railway `${{RAILWAY_GIT_COMMIT_SHA}}` (informational)       |
| `NEXT_PUBLIC_SITE_URL`          | Browser + server     | Yes      | (n/a — env-specific literal)                                |

A local template lives at `.env.example`. Copy to `.env.local` and fill
values; `.env.local` is gitignored.

> Next.js 16 reads `.env*` from the **project root only** — keep them
> next to `package.json`, not inside `/src`.

---

## 4. Railway — backend API

`services/api` (Hono on Node 22 + Drizzle) ships to a personal-scope
Railway project `roam-api`. Activated 2026-05-13 (ROA-93) once
`services/api` had a real Hono service (ROA-91) and the
`roam_poc_backend` DB role existed (ROA-94).

Build/start are driven by [`railway.json`](../railway.json) at the repo
root — Nixpacks reads it and runs the monorepo-style install + filtered
build, so the dashboard "Build Command" / "Start Command" can stay
blank.

**Verified in code (already in this repo):**

- `railway.json` at repo root: Nixpacks builder, build =
  `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @roam/api build`,
  start = `node services/api/dist/index.js`, healthcheck `/healthz`.
- `package.json` (root): `packageManager: pnpm@11.0.9` so corepack pins
  the right pnpm — lockfile is v9, Nixpacks default pnpm is too old.
- `/healthz` returns `{ ok: true, sha }` (process-level liveness).
- `/readyz` runs `select 1` through Drizzle and returns 503 if DB is
  unreachable — wire this to Railway readiness if you want traffic
  gated on DB, otherwise leave `/healthz` as the dashboard healthcheck.

**Dashboard steps (human, one-time — `manual-required`):**

Personal scope only. `agent-rules/07-company-firewall.md` — reject any
workspace whose name contains `transbiz`.

1. Railway dashboard → _New Project_ → name = `roam-api`. Confirm the
   target workspace is the **personal** one (no `transbiz` in slug).
2. _Source_ → GitHub repo `RIDCorix/ravn-roam`. Leave **Root Directory
   empty** (build needs the monorepo root for `pnpm install`).
3. _Settings → Build_ → set **Watch Paths** = `services/api/**` and
   `packages/shared/**` so unrelated PR pushes don't redeploy.
4. _Settings → Build_ / _Deploy_ → leave Build Command and Start
   Command blank. `railway.json` drives both. Confirm Nixpacks is the
   detected builder.
5. _Variables_ → add the entries listed in [§3 — Env vars](#3--env-vars)
   from the hub via `secrets-get.sh` (see
   [§5](#5--credentials--hub-secrets-flow)). Do NOT paste values from
   elsewhere. `PORT` is auto-injected; map `GIT_SHA` to
   `${{RAILWAY_GIT_COMMIT_SHA}}`.
6. _Settings → Networking_ → generate the auto-assigned public domain.
   Record it as `infra.railway.roam_api.public_url` in
   `.ravn/project.yaml`.
7. _Settings → Healthcheck_ → confirm path = `/healthz`, timeout 30s,
   restart on failure (max 3 retries). Already declared in
   `railway.json` but the dashboard fields should match.
8. Trigger a manual deploy. Verify
   `https://<railway-domain>/healthz` returns `{ ok: true, sha: <...> }`,
   then `/readyz` returns `{ ok: true, db: "ok" }` once `DATABASE_URL`
   is set.

**Env vars (Railway service):**

| Variable                | Source                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | hub: `supabase.shared.poc_roles.roam_poc_backend.connection_url` |
| `FASTMOVE_BASE_URL`     | hub: `fastmove.api.base_url`                                     |
| `FASTMOVE_MERCHANT_ID`  | hub: `fastmove.api.merchant_id`                                  |
| `FASTMOVE_MERCHANT_KEY` | hub: `fastmove.api.merchant_key`                                 |
| `FASTMOVE_DEPT_ID`      | hub: `fastmove.api.dept_id` (if Fastmove dispenses one)          |
| `PORT`                  | auto-injected by Railway — do not set manually                   |
| `GIT_SHA`               | `${{RAILWAY_GIT_COMMIT_SHA}}` (Railway reference variable)       |

`fastmove.api.*` and the optional `railway.roam_api.project_token` rows
must be added to the hub TEC-22 master secrets issue per
`agent-rules/10-secrets-via-linear.md`. Until they're there,
`secrets-get.sh` returns empty and the service boots but Fastmove
calls fail.

**Acceptance gates (when re-running this section):**

- [ ] Railway service deploy is green; build picks up the
      `services/api/**` + `packages/shared/**` watch filter.
- [ ] `GET /healthz` → 200 `{ ok: true, sha }` on the public domain.
- [ ] `GET /readyz` → 200 `{ ok: true, db: "ok" }` (proves
      `DATABASE_URL` wiring).
- [ ] Pushing an unrelated change (e.g. `apps/landing/**`) does NOT
      trigger a redeploy.
- [ ] `infra.railway.roam_api.public_url` is recorded in
      `.ravn/project.yaml`.

---

## 5. Credentials — hub secrets flow

Per `agent-rules/10-secrets-via-linear.md`, every credential reaches
deployed envs via the hub's `secrets-get.sh` (which reads the sops
cache, kept fresh by the Linear-issue master at TEC-22). Never paste
tokens directly into Vercel.

When a new credential is needed:

1. Compute the canonical dot-path (e.g. `vercel.roam.token`).
2. Comment on the Linear issue dictating the exact path + scopes.
3. Move the issue to `In Review` + add `manual-required`.
4. Resume after `secrets-get.sh <path>` returns the value.

---

## 6. Health-check before going live

- [ ] Vercel production deploy is green on `main`.
- [ ] Preview deploy on a sample PR resolves.
- [ ] Env vars present in **both** Preview and Production scopes, all
      sourced from the hub.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass locally and
      in Vercel.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the actual deployed origin (drives
      OpenGraph cards).
- [ ] Custom domain (if any) verified and HTTPS active.
