---
name: roam-api-catalog
description: Use when changing Roam backend API, catalog schema, supplier sync, Fastmove integration, pricing, substitution, publication, or shared catalog behavior.
---

# Roam API And Catalog

Use this skill for `services/api`, `packages/catalog`, and shared backend-facing
logic.

## Read First

- `AGENTS.md`
- `README.md` backend section
- `docs/INFRA.md` for env, Supabase, and deployment constraints
- Existing tests near the touched catalog/API code
- `services/api/.env.example` before adding or changing env vars

## Architecture

- `services/api`: Hono on Node 22, ESM, TypeScript, Drizzle, Fastmove supplier
  client, Vitest.
- `packages/catalog`: shared product/catalog business rules. Put reusable
  pricing, publication, substitution, and schema behavior here instead of
  duplicating it in apps.
- API must keep `/healthz` bootable without optional credentials.
- Validate required env vars at point of use, not module import, matching
  existing patterns.

## Supplier And Catalog Rules

- Keep supplier protocol details deterministic and isolated.
- Use typed parsers and `zod` or existing schema helpers for untrusted data.
- Do not mix supplier transport/signing code with UI or admin workflow code.
- Make pricing/publication/substitution behavior testable in package tests.
- Migration changes should be isolated and backward compatible where practical.

## Data And Secrets

- Supabase project is shared `ravn-shared`; Roam schema is `roam_poc`.
- Never expose or paste real connection strings, Fastmove secrets, admin tokens,
  or Supabase service keys.
- Add env names to the relevant `.env.example` files and `docs/INFRA.md` when
  introducing a new variable.

## Verification

- For API changes: run `pnpm --filter @roam/api typecheck` and
  `pnpm --filter @roam/api test`.
- For catalog changes: run `pnpm --filter @roam/catalog typecheck` and package
  tests covering the touched behavior.
- Run builds when changing deploy output, module boundaries, or package exports.
