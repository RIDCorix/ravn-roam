# Infra setup

End-to-end checklist for getting the Roam marketing site running on
**Vercel** (web hosting + previews) and the **shared Supabase project**
(`ravn-shared`). Items marked _dashboard_ must be done by a human with
the right account access — they cannot be driven from this repo.

This repo is **main-only** (per `CLAUDE.md` — rule 8's
`ravn/integration` overlay does NOT apply here). Production deploy
target = `main`; previews = every other branch.

Railway is deferred — see [§4](#4--railway-deferred).

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

**Naming for this repo:**

| Asset            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Schema           | `roam_poc`                                               |
| Role             | `roam_poc_user`                                          |
| Role search_path | `roam_poc`                                               |
| Secret root      | `supabase.shared.poc_roles.roam_poc.*` (hub Linear)      |
| Connection URL   | hub: `supabase.shared.poc_roles.roam_poc.connection_url` |

**Provisioning (one-time, human-driven against the shared project):**

1. From the hub repo:
   ```bash
   PGPASSWORD=$(<hub>/scripts/secrets-get.sh supabase.shared.db_password) \
     psql "host=$(<hub>/scripts/secrets-get.sh supabase.shared.db_host) port=5432 user=postgres dbname=postgres sslmode=require"
   ```
2. Inside psql:
   ```sql
   CREATE SCHEMA roam_poc;
   CREATE ROLE roam_poc_user WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE ON SCHEMA roam_poc TO roam_poc_user;
   GRANT ALL ON SCHEMA roam_poc TO roam_poc_user;
   ALTER ROLE roam_poc_user SET search_path TO roam_poc;
   REVOKE ALL ON SCHEMA public FROM roam_poc_user;
   ```
3. Record `roam_poc` + `roam_poc_user` (NOT the password) in
   `.ravn/project.yaml` under `infra.supabase`.
4. Add the password as the row
   `supabase.shared.poc_roles.roam_poc.password` to the hub master
   secrets issue (TEC-22) per `agent-rules/10-secrets-via-linear.md`.
   Also add the assembled `DATABASE_URL` as
   `supabase.shared.poc_roles.roam_poc.connection_url`.

**Client usage in this repo:**

- Browser components: `import { createSupabaseBrowserClient } from "@/lib/supabase/client"`.
- Server components / Route Handlers: `import { createSupabaseServerClient } from "@/lib/supabase/server"`.
- Server-side direct Postgres (Prisma / drizzle / pg): connect via
  `process.env.DATABASE_URL` only. **Do NOT** import the shared
  `service_role_key` from app code (rule 06).

---

## 3. Env vars

| Variable                        | App(s)                         | Where it runs    | Required        | Hub secret path                                     |
| ------------------------------- | ------------------------------ | ---------------- | --------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `apps/landing`, `apps/web`     | Browser + server | Yes             | `supabase.shared.url`                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/landing`, `apps/web`     | Browser + server | Yes             | `supabase.shared.anon_key`                          |
| `DATABASE_URL`                  | `services/api`                 | Server only      | Yes (for DB)    | `supabase.shared.poc_roles.roam_poc.connection_url` |
| `NEXT_PUBLIC_SITE_URL`          | `apps/landing`, `apps/web`     | Browser + server | Yes             | (n/a — env-specific literal)                        |
| `ROAM_API_URL`                  | `apps/web`                     | Server only      | Yes (in prod)   | (n/a — points at `infra.railway.roam_api.public_url`) |
| `ADMIN_API_TOKEN`               | `apps/web`, `services/api`     | Server only      | Yes (for sync)  | `roam.admin_api_token` (TEC-22)                     |
| `ROAM_ADMIN_USER`               | `apps/web`                     | Server only      | No (default "admin") | (n/a)                                          |
| `FASTMOVE_BASE_URL`             | `services/api`                 | Server only      | Yes (for sync)  | `fastmove.api.base_url`                             |
| `FASTMOVE_MERCHANT_ID`          | `services/api`                 | Server only      | Yes (for sync)  | `fastmove.api.merchant_id`                          |
| `FASTMOVE_DEPT_ID`              | `services/api`                 | Server only      | Yes (for sync)  | `fastmove.api.dept_id`                              |
| `FASTMOVE_MERCHANT_KEY`         | `services/api`                 | Server only      | Yes (for sync)  | `fastmove.api.merchant_key`                         |

> **`ROAM_API_URL` and `ADMIN_API_TOKEN` are not optional in production.**
> Without `ROAM_API_URL` the admin pages SSR-fetch `http://localhost:3001`
> and surface "API unreachable" banners; without `ADMIN_API_TOKEN` the
> `/admin/suppliers/:code/sync` route on `services/api` returns 503 and the
> manual-sync button in the admin UI never lights up.

A local template lives at `.env.example` (one per app:
`apps/landing/.env.example`, `apps/web/.env.example`,
`services/api/.env.example`). Copy to `.env.local` (or `.env` for
`services/api`) and fill values; all `.env*` are gitignored.

> Next.js 16 reads `.env*` from the **project root only** — keep them
> next to `package.json`, not inside `/src`.

---

## 4. Railway — deferred

Skipped for now (ROA-13, 2026-05-13). The marketing site does not need
Railway; Vercel + shared Supabase cover hosting, previews, and the
database. When a backend service or worker appears that needs Railway,
revisit this section to add the deploy artifact (Dockerfile or
`railway.json`), env wiring, and any per-PoC Postgres role rotation.

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
