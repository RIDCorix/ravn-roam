# Shared Supabase project

LOAD-BEARING.

All RAVN-managed PoCs share **one** Supabase project, `ravn-shared` (in `RIDCorix's Org`). PoCs are isolated by **Postgres schema**, not by separate Supabase projects. This rule is set by Ray (2026-05-01) and overrides the older one-project-per-PoC pattern. (Linear shares the same shape since ADR-001: one workspace `ravn`, one team per client — see `ravn-hub/docs/decisions/ADR-001-single-workspace-per-team.md`.)

## Why

- Supabase free tier caps active projects per org. Per-PoC projects cap our headroom for actual long-running clients.
- Centralizes auditing — one connection string, one set of API keys to rotate.
- Each PoC still gets a clean blast radius via schema + role isolation; cross-PoC access is denied at the Postgres `GRANT` layer.

## How to provision a new PoC's slice (stage-02 step 3)

1. Pull credentials from the hub repo (`~/.cyrus/worktrees/<hub>` or wherever `ravn-hub` is cloned):
   ```bash
   PGPASSWORD=$(<hub-path>/scripts/secrets-get.sh supabase.shared.db_password) \
     psql "host=$(<hub-path>/scripts/secrets-get.sh supabase.shared.db_host) port=5432 user=postgres dbname=postgres sslmode=require"
   ```
2. Inside that psql session, run (replace `<slug>` with the client's `.ravn/project.yaml` slug, lowercase, underscores only):
   ```sql
   CREATE SCHEMA <slug>_poc;
   CREATE ROLE <slug>_poc_user WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE ON SCHEMA <slug>_poc TO <slug>_poc_user;
   GRANT ALL ON SCHEMA <slug>_poc TO <slug>_poc_user;
   ALTER ROLE <slug>_poc_user SET search_path TO <slug>_poc;
   -- block this role from seeing other schemas
   REVOKE ALL ON SCHEMA public FROM <slug>_poc_user;
   ```
3. Build a connection string for the PoC and inject it into Vercel/Railway envs as `DATABASE_URL` (and `DIRECT_URL` for Prisma):
   ```
   postgres://<slug>_poc_user:<generated>@<db_host>:5432/postgres?options=--search_path%3D<slug>_poc&sslmode=require
   ```
4. Record the schema name + role name (NOT the password) into `.ravn/project.yaml` under `infra.supabase`. The role password belongs as a row in the hub's master secrets Linear issue (TEC-22) at path `supabase.shared.poc_roles.<slug>_poc.password` — see [`10-secrets-via-linear.md`](./10-secrets-via-linear.md) for the full rule. Either edit the issue description directly (Linear UI) or call `secrets-set.sh` from the hub; either way the syncer picks it up into the hub's `secrets.enc.yaml` cache. Do NOT put the password in the per-client repo.

## Migration discipline on a shared schema

Because all PRs in a PoC repo target **one** Postgres schema, two PRs running migrations in parallel will fight. The discipline that prevents this lives in [`09-pr-previews.md`](./09-pr-previews.md) under "Migration-first PR rule". Summary:

- Migration changes ship in their own PR, separate from feature logic.
- Only one migration PR may be open per repo at a time.
- Other open PRs rebase onto the merged migration before their CI re-runs.
- Migration PRs are additive (nullable columns, defaults, new tables) — never drops or renames in the same PR.

Read rule 09 before opening any PR that touches `migrations/` (or your framework's equivalent).

## What NOT to do

- Do NOT call `supabase projects create` for a PoC. The shared project is already provisioned; creating another one defeats the point.
- Do NOT use the `service_role_key` from inside the client's app code — it's the master key for the whole shared project (every PoC's data). The per-PoC `<slug>_poc_user` role is what apps connect with.
- Do NOT put `supabase.shared.*` values directly into the client repo's env files. Always fetch via `secrets-get.sh` at deploy time.
