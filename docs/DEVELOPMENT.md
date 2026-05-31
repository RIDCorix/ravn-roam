# Development

## Ports

| Surface | Command | URL |
| --- | --- | --- |
| Web app | `pnpm dev` or `pnpm dev:web` | `http://localhost:3010` |
| API | `pnpm dev:api` | `http://localhost:3001/healthz` |
| Landing | `pnpm dev:landing` | `http://localhost:3011` |

## Checks

Run the narrowest meaningful checks while iterating:

```bash
pnpm --filter @roam/web typecheck
pnpm --filter @roam/web lint
pnpm --filter @roam/api typecheck
pnpm --filter @roam/api test
pnpm --filter @roam/catalog test
```

Before a broad handoff, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Environment

Copy the relevant `.env.example` file to a local ignored env file:

- `apps/web/.env.example` -> `apps/web/.env.local`
- `apps/landing/.env.example` -> `apps/landing/.env.local`
- `services/api/.env.example` -> `services/api/.env`

Do not commit real env files or paste secret values into docs, issues, or
terminal output.

## Next.js 16

Both web apps use Next.js 16 App Router with Turbopack. Before changing
routing, layouts, server/client boundaries, caching, forms, or route handlers,
read the matching local docs under:

```text
node_modules/.pnpm/next@*/node_modules/next/dist/docs/
```
