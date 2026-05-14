# Development

How to run the Roam monorepo locally. Sister doc to
[`INFRA.md`](./INFRA.md) — INFRA is "how prod / preview deploys",
this is "how my laptop".

## 0. Prereqs

- **Node 22+** (`engines.node = >=22` enforced in root `package.json`).
- **pnpm 11** — pinned via `packageManager: pnpm@11.0.9`. `corepack
  enable` will fetch the right version automatically.
- **PostgreSQL access** is optional for landing-only work but required
  for `services/api` (`/readyz`, drizzle).

## 1. Install + bootstrap

```bash
corepack enable
pnpm install                # installs all workspace packages
```

Workspace layout:

```
apps/landing      → @roam/landing  (Vercel: roam-web)
apps/web          → @roam/web      (Vercel: roam-system)
services/api      → @roam/api      (Railway: roam-api)
packages/shared   → @roam/shared   (Supabase clients + env helpers — imported by both apps)
```

`pnpm-workspace.yaml` declares `apps/*`, `packages/*`, `services/*`,
so any new app/service auto-joins the workspace.

## 2. Env files

Each runnable package has its own template:

| Package         | Template file                | Local copy        |
| --------------- | ---------------------------- | ----------------- |
| `apps/landing`  | `.env.example` (repo root)¹  | `apps/landing/.env.local` |
| `apps/web`      | `apps/web/.env.example`      | `apps/web/.env.local`     |
| `services/api`  | `services/api/.env.example`  | `services/api/.env`       |

¹ The root template still lives at the repo root for now (legacy from
the pre-monorepo landing scaffold). Copy it into `apps/landing/.env.local`
when developing landing locally — Next.js 16 reads `.env*` from each
app's own root, not the repo root.

Values come from the hub via `secrets-get.sh` (per
`agent-rules/10-secrets-via-linear.md`). Don't paste secrets directly
between machines.

Suggested local port split (so all three can run at once):

| Package        | Port  | Set via                              |
| -------------- | ----- | ------------------------------------ |
| `apps/landing` | 3000  | `next dev` default                   |
| `apps/web`     | 3001  | `next dev --port 3001` or `PORT=3001`|
| `services/api` | 3002  | `PORT=3002` in `services/api/.env`   |

If you only run one app, ignore the port shifting.

## 3. Run each package

### Landing site (`@roam/landing`)

```bash
pnpm --filter @roam/landing dev          # http://localhost:3000
pnpm --filter @roam/landing build
pnpm --filter @roam/landing typecheck
pnpm --filter @roam/landing lint
```

Root shortcut: `pnpm dev` is wired to `@roam/landing dev` for the
common "just start the marketing site" path.

### System app (`@roam/web`)

```bash
pnpm --filter @roam/web dev -- --port 3001   # http://localhost:3001
pnpm --filter @roam/web build
pnpm --filter @roam/web typecheck
pnpm --filter @roam/web lint
```

Route groups:

- `(admin)/admin/*` — admin back-office surface.
- `(storefront)/*` — buyer-facing storefront flow.

Both groups share the `[lang]` i18n shell (`en`, `zh-TW`).

### Backend API (`@roam/api`)

```bash
pnpm --filter @roam/api dev              # tsx watch — hot reload
pnpm --filter @roam/api build            # tsup → services/api/dist/index.js
pnpm --filter @roam/api start            # node dist/index.js
pnpm --filter @roam/api test             # vitest run (incl. signer golden test)
pnpm --filter @roam/api typecheck
```

Health endpoints (also used by Railway):

- `GET /healthz` → `{ ok: true, sha }` — process liveness.
- `GET /readyz`  → `{ ok: true, db: "ok" }` — runs `select 1` through
  Drizzle. Returns 503 if `DATABASE_URL` is missing or the DB is
  unreachable.

### Shared package (`@roam/shared`)

No dev server. Imported in source form (`main: ./src/index.ts`), so
edits show up in any consuming app on the next reload.

```bash
pnpm --filter @roam/shared typecheck
```

## 4. Database — Drizzle migrations

All migration work runs from `services/api`. Schema source lives at
`services/api/src/db/schema/index.ts`; generated SQL lands under
`services/api/src/db/migrations/`.

```bash
# Generate a new migration from a schema diff
pnpm --filter @roam/api db:generate -- --name <slug>

# Apply pending migrations to the shared Supabase DB
pnpm --filter @roam/api db:migrate

# Push the current schema directly (dev-only — skips the migration file)
pnpm --filter @roam/api db:push

# Open drizzle-studio against DATABASE_URL
pnpm --filter @roam/api db:studio
```

Migrations connect via `DATABASE_URL`, which must point at the
`roam_poc_backend` role (NOT the apps-tier `roam_poc_user`). The
backend role has `CREATE` on the `roam_poc` schema; the apps role
doesn't. See INFRA.md §2.

**Migration-first PR rule still applies** (per
`agent-rules/09-pr-previews.md`): each migration ships in its own PR,
merged before any feature PR that depends on it. Only one migration
PR open at a time.

## 5. Cross-package commands

```bash
pnpm -r typecheck        # every package's typecheck
pnpm -r lint             # every package's lint
pnpm -r build            # build all that have a build script
```

Root scripts (`package.json`) bundle the landing-only shortcuts:
`pnpm dev`, `pnpm build`, `pnpm start` → `@roam/landing`.

## 6. End-to-end (when added)

Not wired yet. When E2E lands it goes in `packages/e2e/` or a
top-level `tests/`, runs against either local `pnpm dev` or a deployed
Vercel preview URL, and is invoked as `pnpm -r --filter @roam/e2e test`
or similar. Update this section when the harness ships.

## 7. Common gotchas

- **`Error: No Next.js version detected` from Vercel** — means the
  Vercel project's Root Directory is repo root instead of
  `apps/landing` (or `apps/web`). Fix in dashboard per
  INFRA.md §1a / §1b.
- **`pnpm install` failing on `unrs-resolver` or `sharp`** — root
  `package.json` allowlists these under `allowBuilds` /
  `onlyBuiltDependencies`. If you forked or reset the workspace
  config, re-add them.
- **`.env.local` not picked up** — Next.js 16 reads it from the app's
  own root (`apps/landing/.env.local`), NOT the repo root.
- **Drizzle migration fails with `permission denied for schema
  roam_poc`** — you're using the apps-tier role. Switch
  `DATABASE_URL` to the `roam_poc_backend` connection URL from the
  hub.
