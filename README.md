# Roam

Roam is Ravn's eSIM product (ROA-13). This repo is the pnpm monorepo
holding the marketing site, the admin/storefront system, and the
backend API.

```
ravn-roam/
├── apps/
│   ├── landing/        @roam/landing  — marketing site (Next.js 16)
│   └── web/            @roam/web      — admin + storefront (Next.js 16)
├── packages/
│   └── shared/         @roam/shared   — Supabase clients, env helpers, shared types
├── services/
│   └── api/            @roam/api      — backend API (Hono on Node 22 + Drizzle)
├── docs/
│   ├── INFRA.md        deploy targets, env vars, hub secrets
│   └── development.md  local dev quickstart, drizzle workflow
└── .ravn/project.yaml  canonical infra metadata (Vercel / Railway / Supabase IDs)
```

## Stack

- **pnpm 11** workspace (`packageManager` pinned)
- **Next.js 16** + **React 19** + **TypeScript 5** (strict)
- **Tailwind CSS v4** + CSS-variable design tokens
- **Hono** on **Node 22** + **Drizzle ORM** for `services/api`
- **Supabase** (shared `ravn-shared` project, `roam_poc` schema)
- **Vercel** for both Next.js apps; **Railway** for `services/api`

## Quickstart

```bash
corepack enable
pnpm install
pnpm dev                                       # @roam/landing on :3000
pnpm --filter @roam/web dev -- --port 3001     # @roam/web on :3001
PORT=3002 pnpm --filter @roam/api dev          # @roam/api on :3002
```

Full local guide: [`docs/development.md`](docs/development.md). Env
vars, deploy targets, and hub secret paths:
[`docs/INFRA.md`](docs/INFRA.md).

## Deploy targets

| Workspace      | Hosted on   | Project / service       | Notes                                  |
| -------------- | ----------- | ----------------------- | -------------------------------------- |
| `apps/landing` | Vercel      | `roam-web`              | Root Directory = `apps/landing`        |
| `apps/web`     | Vercel      | `roam-system`           | Root Directory = `apps/web`            |
| `services/api` | Railway     | `roam-api`              | `railway.json` at repo root; healthcheck `/healthz` |

Production branch = `main` everywhere. Previews = every other branch
on Vercel; Railway redeploys on changes to
`services/api/**` + `packages/shared/**`.

## Design tokens

Tokens live in each app's `src/app/globals.css` as CSS custom
properties exposed to Tailwind via `@theme inline`. Light and dark
schemes share the same token names — only the values flip — so
components stay scheme-agnostic.

Core tokens: `background`, `foreground`, `surface`, `surface-muted`,
`border`, `border-strong`, `muted`, `subtle`, `brand`, `brand-strong`,
`accent`, `accent-strong`.

## Conventions

- Read [`AGENTS.md`](AGENTS.md) before changing Next.js config — this
  repo runs Next.js 16 (App Router + Turbopack); APIs may differ from
  prior knowledge.
- Cross-cutting rules live in [`agent-rules/`](agent-rules) — shared
  Supabase, company firewall, hub secrets flow, PR-preview discipline.
- Backwards-compatible API changes only (`agent-rules/09-pr-previews.md`).
  Breaking changes go through deprecate → migrate → remove across
  three PRs.
