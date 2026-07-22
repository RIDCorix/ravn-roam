# Agent-Native Development

This repo is optimized for coding agents. The goal is not more ceremony; the
goal is faster, safer edits with fewer hidden assumptions.

## Agent Readiness Rubric

| Axis | Target | How to keep it true |
| --- | --- | --- |
| Instructions | One current source of truth for agent behavior | Keep `AGENTS.md` concise, concrete, and linked to deeper docs. |
| Discoverability | Agents can find the right package, command, and owner in under a minute | Keep `README.md`, `docs/ARCHITECTURE.md`, and package scripts synchronized. |
| Verification | Every work surface has a narrow check and a broad handoff check | Use the `verify:*` scripts in `package.json`; add a script before adding a new runtime. |
| Modularity | Files fit in context and have one reason to change | Split files before they become coordination hubs; prefer pure helpers and typed adapters. |
| DRY contracts | Shared product rules live in shared modules | Put cross-surface catalog rules in `packages/catalog`; avoid duplicating aliases, URL builders, schemas, and mappers. |
| Safety | Dirty worktrees, secrets, and infra changes are handled explicitly | Check `git status --short`, avoid real env files, and read `docs/INFRA.md` before infra work. |

## Canonical Commands

Run the narrowest command that proves the change:

```bash
pnpm verify:web
pnpm verify:landing
pnpm verify:api
pnpm verify:catalog
pnpm verify:lumi-agent
```

Run the broad handoff command before large cross-package delivery:

```bash
pnpm verify
```

Run the CI-equivalent Node/TypeScript checks without Python service tests:

```bash
pnpm verify:ci
```

Run the agent-native structural audit by itself:

```bash
pnpm agent:audit
```

Clear stale generated build/type artifacts when local checks behave strangely:

```bash
pnpm clean:generated
```

`pnpm agent:audit` fails only on blocking contradictions such as missing agent
docs, missing verify scripts, or mismatched local ports. It reports large files
and lint suppressions as warnings so existing architecture debt is visible
without blocking every PR.

## File Size Budget

Agents are most reliable when they can hold the edited unit in context.

- Aim for files under 500 lines.
- Treat 1000+ lines as agent-risk debt.
- Split UI by state hook, pure mapper, presentational component, and adapter.
- Split backend agent code by prompt contract, tool schema, provider adapter,
  validation, and route orchestration.

Existing large files should be decomposed as staged work, not casually while
touching unrelated behavior.

## Adding New Capabilities

When adding a new app, service, or package:

1. Add package-level `dev`, `typecheck`, `lint`, `test`, or equivalent scripts.
2. Add a root `verify:<surface>` script.
3. Add generated output paths to `scripts/clean-generated.mjs` when the runtime
   produces local caches that can affect verification.
4. Update `README.md`, `docs/DEVELOPMENT.md`, and `docs/ARCHITECTURE.md`.
5. Add or update a project-local skill under `.agents/skills/` if the surface
   introduces new operating rules.
6. Add the surface to CI when it can run without secrets or external dashboards.

## Known Agent-Risk Debt

These are intentional follow-up projects, not drive-by cleanup:

- Decompose the trip planning workspace into focused state, mapper, map, search,
  lodging, and presentation modules.
- Split Lumi provider code into prompt/tool contracts, provider transport,
  response validation, and journey normalization modules.
- Promote repeated country/place alias data into shared typed helpers.
- Add focused tests for frontend helpers such as shop links, trip mapping,
  route proxies, and Lumi context assembly.
