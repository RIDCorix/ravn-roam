# Infra setup

End-to-end checklist for getting the Roam stack running on **Vercel**
(two projects — landing + system), **Railway** (`services/api`), and
the **shared Supabase project** (`ravn-shared`). Items marked
_dashboard_ must be done by a human with the right account access —
they cannot be driven from this repo.

This repo is **main-only** (per `CLAUDE.md` — rule 8's
`ravn/integration` overlay does NOT apply here). Production deploy
target = `main`; previews = every other branch.

Repo layout (post ROA-89 monorepo restructure):

```
apps/landing      → @roam/landing → Vercel project `roam-web`     (marketing site)
apps/web          → @roam/web     → Vercel project `roam-system`  (admin + storefront)
services/api      → @roam/api     → Railway project `roam-api`    (Hono + Drizzle)
packages/shared   → @roam/shared  → consumed by both apps (Supabase clients, env)
```

Railway is active for the backend API — see [§4](#4--railway--backend-api).

References:

- `node_modules/next/dist/docs/01-app/02-guides/deploying-to-platforms.md`
- `agent-rules/02-default-stack.md` (Vercel + Supabase defaults)
- `agent-rules/06-shared-supabase.md` (one project, schema-per-PoC)
- `agent-rules/07-company-firewall.md` (reject any `transbiz` resource)
- `agent-rules/09-pr-previews.md` (Vercel preview discipline)
- `agent-rules/10-secrets-via-linear.md` (creds via hub `secrets-get.sh`)

---

## 1. Vercel — two projects, one repo

Next.js 16 ships a verified Vercel adapter and Vercel auto-detects
everything, so **no `vercel.json` is needed** — but each app needs its
own Vercel project pointed at the right monorepo sub-path.

Both projects live in scope `ridcorixs-projects` (firewall-cleared, no
`transbiz` substring). Project metadata is recorded in
`.ravn/project.yaml` under `infra.vercel`.

| Vercel project | App package    | Root Directory   | Default deploy URL                              |
| -------------- | -------------- | ---------------- | ----------------------------------------------- |
| `roam-web`     | `@roam/landing`| `apps/landing`   | `https://roam-web-ridcorixs-projects.vercel.app`|
| `roam-system`  | `@roam/web`    | `apps/web`       | `https://roam-system-ridcorixs-projects.vercel.app` (TBD until project exists) |

Production branch = `main` for both. Preview deploys = every other branch.

### 1a. `roam-web` (landing — `apps/landing`)

Originally created (pre-monorepo) pointing at repo root. After ROA-89
moved Next.js code into `apps/landing/`, the Root Directory must be
re-pointed; without that, Vercel can't find `next` in `package.json`
and builds fail in <10s with:

```
Error: No Next.js version detected. Make sure your package.json has
"next" in either "dependencies" or "devDependencies". Also check your
Root Directory setting matches the directory of your package.json file.
```

**Dashboard steps (human, one-time — `manual-required`):**

1. Vercel dashboard → `roam-web` → _Settings → General → Root
   Directory_ → set to `apps/landing`. **Leave _Include source files
   outside of the Root Directory in the Build Step_ ON** so the
   workspace install can reach `packages/shared` and the root
   `pnpm-lock.yaml`.
2. _Settings → General → Framework Preset_ stays "Next.js" (auto).
   Build / Install / Output commands stay blank — Vercel's pnpm
   workspace detection handles them once Root Directory is right.
3. _Settings → Git → Ignored Build Step_ → set to:
   ```bash
   git diff --quiet HEAD^ HEAD -- apps/landing packages/shared pnpm-lock.yaml pnpm-workspace.yaml package.json
   ```
   so a `services/api`-only or `apps/web`-only PR doesn't waste a
   landing build. Vercel treats exit 0 as "skip", exit 1 as "build".
4. _Settings → Environment Variables_ → load the
   `apps/landing` row block from [§3 — Env vars](#3--env-vars) via the
   hub flow (see [§5](#5--credentials--hub-secrets-flow)). Do NOT
   paste secrets manually.
5. _Settings → Domains_ — keep the auto domain; add a custom domain
   later when marketing is ready.

### 1b. `roam-system` (system frontend — `apps/web`)

New project. Created together with the dashboard work above (ROA-92).
Same GitHub repo, different root.

**Dashboard steps (human, one-time — `manual-required`):**

1. Vercel dashboard → _Add New → Project_ → import
   `RIDCorix/ravn-roam` → scope `ridcorixs-projects`.
2. Name = `roam-system`. _Root Directory_ = `apps/web`. Keep
   _Include source files outside of the Root Directory_ ON.
3. Framework Preset auto-detects as Next.js. Build / Install / Output
   stay blank.
4. _Settings → Git_ → Production Branch = `main`. Preview deploys for
   every other branch (Vercel default).
5. _Settings → Git → Ignored Build Step_ → set to:
   ```bash
   git diff --quiet HEAD^ HEAD -- apps/web packages/shared pnpm-lock.yaml pnpm-workspace.yaml package.json
   ```
6. _Settings → Environment Variables_ → load the `apps/web` row block
   from [§3 — Env vars](#3--env-vars). `NEXT_PUBLIC_SITE_URL` here
   points at the system origin (NOT the landing origin).
7. Trigger a manual deploy from `main` to confirm green. Record the
   assigned `project_id` and default URL in
   `.ravn/project.yaml > infra.vercel.roam_system`.

### Acceptance gates (re-run after the dashboard work lands)

- [ ] `vercel list roam-web --scope ridcorixs-projects` shows the
      latest deploy as `Ready`, not `Error`, with build duration > 15s
      (sub-10s means Vercel still can't find Next.js).
- [ ] `vercel list roam-system --scope ridcorixs-projects` exists and
      latest deploy is `Ready`.
- [ ] Pushing a `services/api/**`-only commit produces "Build skipped"
      on both Vercel projects (proves Ignored Build Step).
- [ ] `infra.vercel.roam_web.root` = `apps/landing` and
      `infra.vercel.roam_system.root` = `apps/web` in
      `.ravn/project.yaml`.

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

Three deploy targets → three distinct env scopes. Templates:

- `apps/landing` → repo-root `.env.example` (legacy location — predates
  ROA-89's monorepo move; copy it into `apps/landing/.env.local`)
- `apps/web` → `apps/web/.env.example`
- `services/api` → `services/api/.env.example`

Copy to `.env.local` (Next.js) or `.env` (services/api) for local dev;
`.env*` is gitignored.

> Next.js 16 reads `.env*` from the **project root only** — keep them
> next to each app's `package.json` (i.e., inside `apps/landing/` or
> `apps/web/`), NOT at repo root and NOT inside `/src`.

### 3a. `apps/landing` (Vercel project `roam-web`)

| Variable                        | Where it runs    | Required | Hub secret path                                     |
| ------------------------------- | ---------------- | -------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server | Yes      | `supabase.shared.url`                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Yes      | `supabase.shared.anon_key`                          |
| `DATABASE_URL`                  | Server only      | When DB  | `supabase.shared.poc_roles.roam_poc.connection_url` |
| `NEXT_PUBLIC_SITE_URL`          | Browser + server | Yes      | (n/a — env-specific literal, marketing origin)      |

### 3b. `apps/web` (Vercel project `roam-system`)

| Variable                        | Where it runs    | Required | Hub secret path                                     |
| ------------------------------- | ---------------- | -------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server | Yes      | `supabase.shared.url`                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Yes      | `supabase.shared.anon_key`                          |
| `DATABASE_URL`                  | Server only      | When DB  | `supabase.shared.poc_roles.roam_poc.connection_url` |
| `NEXT_PUBLIC_SITE_URL`          | Browser + server | Yes      | (n/a — env-specific literal, system origin)         |
| `NEXT_PUBLIC_API_BASE_URL`      | Browser + server | When API | Railway public URL from `infra.railway.roam_api.public_url` |

`apps/web` uses the **same** `roam_poc_user` role as `apps/landing` —
both apps go through Supabase SSR / RLS, so they share the apps-tier
role. Backend-only writes route through `services/api`, NOT direct
from `apps/web`.

### 3c. `services/api` (Railway project `roam-api`)

| Variable                | Where it runs | Required          | Hub secret path                                             |
| ----------------------- | ------------- | ----------------- | ----------------------------------------------------------- |
| `DATABASE_URL`          | Server        | When DB           | `supabase.shared.poc_roles.roam_poc_backend.connection_url` |
| `FASTMOVE_BASE_URL`     | Server        | When Fastmove     | `fastmove.api.base_url`                                     |
| `FASTMOVE_MERCHANT_ID`  | Server        | When Fastmove     | `fastmove.api.merchant_id`                                  |
| `FASTMOVE_DEPT_ID`      | Server        | If Fastmove issues one | `fastmove.api.dept_id`                                 |
| `FASTMOVE_MERCHANT_KEY` | Server        | When Fastmove     | `fastmove.api.merchant_key`                                 |
| `PORT`                  | Server        | Auto              | Railway injects automatically                               |
| `GIT_SHA`               | Server        | No (informational)| Railway `${{RAILWAY_GIT_COMMIT_SHA}}`                       |

`services/api` env vars are all optional at boot — the service starts
and serves `/healthz` even with none set. Required-ness is enforced at
the point of use (`getDb()` requires `DATABASE_URL`,
`FastmoveClient` requires the `FASTMOVE_*` set).

---

## 4. Railway — backend API

`services/api` (Hono on Node 22 + Drizzle) ships to a personal-scope
Railway project `roam-api`. Activated 2026-05-13 (ROA-93) once
`services/api` had a real Hono service (ROA-91) and the
`roam_poc_backend` DB role existed (ROA-94).

Build is driven by [`railway.json`](../railway.json)'s `build.buildCommand`,
which Nixpacks honors — that part Just Works.

**Start command is NOT.** Empirically (ROA-95 first deploy attempt),
Railway's Nixpacks ignored `railway.json`'s `deploy.startCommand` and
fell back to the root `package.json`'s `start` script (= `pnpm --filter
@roam/landing start`), which booted Next.js landing on the API port and
made `/healthz` 404. The fix: explicitly set both Build and Start
Command at the **service** level (dashboard or
`serviceInstanceUpdate`) so they win over package.json fallbacks. The
`railway.json` is kept as a pinned source of truth for the values, but
the service-level fields are what the platform actually executes.

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
4. _Settings → Build_ / _Deploy_ → set **Build Command** =
   `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @roam/api build`
   and **Start Command** = `node services/api/dist/index.js`. **Don't**
   leave them blank — see the note above; Nixpacks ignores
   `railway.json`'s `startCommand` and runs the root `package.json`
   `start` script instead, which boots landing instead of the API.
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

Frontend (per Vercel project — run for `roam-web` AND `roam-system`):

- [ ] Production deploy green on `main`.
- [ ] Preview deploy on a sample PR resolves.
- [ ] Env vars present in **both** Preview and Production scopes, all
      sourced from the hub.
- [ ] `pnpm --filter @roam/landing build` and `pnpm --filter @roam/web build`
      both pass locally.
- [ ] `pnpm -r typecheck` and `pnpm -r lint` go green.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the actual deployed origin per app
      (`roam-web` → marketing origin, `roam-system` → system origin).
- [ ] Ignored Build Step skip works: pushing a `services/api`-only diff
      shows "Build skipped" on both Vercel projects.
- [ ] Custom domain (if any) verified and HTTPS active.

Backend (`services/api` on Railway):

- [ ] `GET /healthz` → 200 `{ ok: true, sha }` on the Railway public URL.
- [ ] `GET /readyz` → 200 `{ ok: true, db: "ok" }` (proves
      `DATABASE_URL` + `roam_poc_backend` wiring).
- [ ] Railway watch-paths filter (`services/api/**`, `packages/shared/**`)
      skips redeploys on `apps/**`-only changes.

Cross-stack:

- [ ] `apps/web`'s `NEXT_PUBLIC_API_BASE_URL` matches
      `infra.railway.roam_api.public_url` (or a stable custom domain
      pointing at it).
- [ ] `infra` block in `.ravn/project.yaml` matches every real
      `project_id` / `public_url` (no `null`s for live infra).
