# Roam

Roam is RAVN's eSIM travel product. This repository is a pnpm monorepo for
the public marketing site, consumer storefront, admin tools, API, and shared
catalog logic.

## Workspace

| Package | Path | Purpose |
| --- | --- | --- |
| `@roam/web` | `apps/web` | Consumer storefront, public shop/region pages, admin UI, i18n app |
| `@roam/landing` | `apps/landing` | Public marketing site |
| `@roam/api` | `services/api` | Hono API, Drizzle, Fastmove integration, Lumi/event crawlers |
| `@roam/catalog` | `packages/catalog` | Shared catalog schema, pricing, publication logic |
| `@roam/shared` | `packages/shared` | Shared Supabase/env utilities |

## Local Development

```bash
pnpm install

pnpm dev          # web app at http://localhost:3010
pnpm dev:api      # API at http://localhost:3001/healthz
pnpm dev:landing  # landing app at http://localhost:3011
```

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test

pnpm --filter @roam/web typecheck
pnpm --filter @roam/web lint
pnpm --filter @roam/api typecheck
pnpm --filter @roam/api test
```

## Product Boundaries

Public users can browse the landing site, storefront, region pages, activity
pages, and plan discovery. Authenticated users get trip planning, tasks, Lumi
context, profile/me, wallet-style eSIM views, and full account navigation.

The default consumer locale is `zh-TW`; English is maintained alongside it.
Any user-facing string in `apps/web` should go through
`apps/web/src/i18n/dictionaries/`.

## Docs

- `AGENTS.md` is the operating manual for coding agents.
- `docs/DEVELOPMENT.md` covers local commands, ports, and verification.
- `docs/ARCHITECTURE.md` covers app boundaries and data-flow decisions.
- `docs/ASSETS.md` covers image/icon asset rules.
- `docs/INFRA.md` covers Vercel, Supabase, env vars, and deploy constraints.

## Infra Posture

This repo is main-only: production deploys from `main`, preview deploys from
other branches. Railway is deferred until a long-running backend service or
worker actually needs it. Secrets must flow through the RAVN hub process
documented in `docs/INFRA.md`; do not paste real credentials into this repo.
