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
pnpm verify:web
pnpm verify:landing
pnpm verify:api
pnpm verify:catalog
pnpm verify:lumi-agent
```

Before a broad handoff, run:

```bash
pnpm verify
```

To mirror the GitHub Actions checks locally without the Python service tests,
run:

```bash
pnpm verify:ci
```

To check agent-native repository affordances only, run:

```bash
pnpm agent:audit
```

The audit fails on blocking contradictions such as missing docs, missing verify
scripts, or mismatched local ports. It reports large files as warnings so
agents can plan decomposition work without blocking unrelated PRs.

If typecheck errors point at generated `.next`, `dist`, `.pytest_cache`, or
`*.tsbuildinfo` files, clear local generated artifacts:

```bash
pnpm clean:generated
```

## Agent-Native Workflow

Read `docs/AGENT_NATIVE.md` before broad structural cleanup, new package
creation, or changes that affect how future agents should work in this repo.

Use these defaults:

- Add one root `verify:<surface>` script for every new runtime.
- Keep cross-surface business rules in shared packages instead of copying them.
- Treat 1000+ line files as refactor candidates when work already touches that
  domain.
- Keep generated or local agent state out of commits unless the file is
  intentionally documented as shared project configuration.

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
