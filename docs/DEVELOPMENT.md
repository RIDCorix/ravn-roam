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

Checks by changed scope:

- Shared TypeScript packages: `pnpm --filter <pkg> typecheck` and tests for
  the touched package.
- `services/api`: `pnpm verify:api`; add `pnpm build:api` when output or deploy
  code changes.
- `apps/web`: `pnpm verify:web` plus Playwright/browser verification for
  visible UI (`pnpm --filter @roam/web e2e`, specs in `apps/web/e2e/`).
- `apps/landing`: `pnpm verify:landing`, build when relevant, and browser
  verification for visible UI.
- Cross-package or release-risk changes: `pnpm typecheck`, `pnpm lint`, and
  targeted builds/tests.
- Before handoff of shippable work: `./scripts/oracle/run.sh` (install, verify,
  build, smoke, visual gates; exit 0 means shippable). `--fast` runs verify
  only; `--only <gate>` runs one gate.

If a check cannot run (missing deps, sandbox, credentials, external service),
report the command and the reason.

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

Use `find . -path '*/node_modules/next/dist/docs' -type d -print` if that path
is missing. Task-specific guides:

- App structure: `01-app/01-getting-started/02-project-structure.md`
- Layouts and pages: `01-app/01-getting-started/03-layouts-and-pages.md`
- Server/client components: `01-app/01-getting-started/05-server-and-client-components.md`
- Fetching, caching, revalidation: `01-app/01-getting-started/06-fetching-data.md`,
  `08-caching.md`, `09-revalidating.md`
- Mutations and forms: `01-app/01-getting-started/07-mutating-data.md`,
  `01-app/02-guides/forms.md`
- Route handlers: `01-app/01-getting-started/15-route-handlers.md`
- Proxy: `01-app/01-getting-started/16-proxy.md`
- Environment variables: `01-app/02-guides/environment-variables.md`
- Internationalization: `01-app/02-guides/internationalization.md`
- Deployment: `01-app/02-guides/deploying-to-platforms.md`

Installed docs and their deprecation notices beat memory.
