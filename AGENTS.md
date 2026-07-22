# Codex Agent Environment — Roam

This file is the repo-level operating manual for Codex and other coding
agents. Treat it as the first source of truth when working in
`/Users/youngray/ravn-roam`.

## Project Snapshot

Roam is RAVN's eSIM product. The repo is a pnpm monorepo with:

- `apps/landing`: public marketing site, Next.js 16 App Router.
- `apps/web`: consumer storefront, admin system, i18n app, Next.js 16 App
  Router, shadcn/ui, Tailwind v4.
- `services/api`: Hono on Node 22, Drizzle, Fastmove supplier integration.
- `packages/catalog`: catalog schema, pricing, substitution, publication logic.
- `packages/shared`: shared environment and utility code.
- `design`: canonical consumer app design bundle and Lume design system.
- `agent-rules`: RAVN operating rules for infra, CI, secrets, Linear, and
  deployment workflows.

The product center of gravity is the consumer travel flow: trips, tasks, Lumi
AI planning, eSIM recommendation, and shop prefiltering.

## Non-Negotiables

- Protect user work. Inspect before editing, never revert unrelated changes,
  and never run destructive git commands unless explicitly requested.
- Keep changes scoped to the request. Do not refactor unrelated code while
  touching a nearby file.
- Use `rg` / `rg --files` for searching.
- Use `apply_patch` for manual file edits.
- Do not commit, push, deploy, provision external resources, or change
  credentials unless the user explicitly asks.
- Do not read, print, paste, or invent secrets. Environment templates may be
  edited; real `.env*` values are not to be exposed.
- If work touches UI, verify visually with a browser or Playwright when a local
  target is available.
- If work touches behavior, run the narrowest meaningful checks first, then
  broaden when the blast radius is shared.

## Next.js 16 Rule

This is not older Next.js. The repo uses Next.js `16.2.6`, React `19.2.4`,
App Router, and Turbopack.

Before changing Next.js code, read the relevant local guide under the installed
package docs. In pnpm layouts, the docs usually live at:

`node_modules/.pnpm/next@*/node_modules/next/dist/docs/`

Use `find . -path '*/node_modules/next/dist/docs' -type d -print` if the
direct path is missing. Read the task-specific guide, for example:

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

Heed deprecation notices from the installed docs over memory.

## Product Thinking

- Roam helps travelers stay connected without thinking about telecom details.
  Favor clear next actions over dense configuration.
- The consumer app is mobile-first. Desktop should feel like a wider product
  surface, not a separate admin dashboard unless the route is actually admin.
- Lumi is a core product surface, not decoration. It should convert trip intent
  into itinerary context and useful eSIM recommendations.
- Lumi-generated itinerary stops follow one simple invariant: every stop must
  have a non-empty `place_name` map anchor. Do not solve missing map anchors
  with positive keyword lists or category-specific patches; make the structured
  output contract require a mappable place for every stop.
- Preserve the CTA chain: trip or checklist context -> shop prefilter ->
  plan comparison -> purchase/action.
- Default locale is `zh-TW`; default currency is TWD. Any user-facing copy must
  account for the dictionary structure under `apps/web/src/i18n/dictionaries/`.
- Empty states should be useful and calm: one clear explanation, one obvious
  next action.
- Admin surfaces are operational tools. Optimize for scanning, comparison,
  stable table behavior, and explicit status.

## Product Style

Roam currently uses the Lume design language from `design/`:

- Calm, precise, premium, "soft futuristic productivity."
- Warm neutral canvas, deep charcoal text, restrained teal accent `#0FB8B4`.
- Near-monochrome screens with accent color reserved for active states and
  meaningful actions.
- No emoji in product UI or marketing copy.
- Sentence case everywhere except proper nouns and legal names.
- Copy is short, declarative, and direct. Avoid filler such as "simply",
  "just", "powerful", "seamless", "robust", "revolutionary".
- Errors are honest and actionable. Avoid chatty copy such as "Oops".
- Success feedback is terse: "Saved.", "Published.", "Synced."

Read these before substantial UI or product-copy work:

- `design/README.md`
- `design/DESIGN-SYSTEM.md`
- `design/SYSTEM-README.md`
- `design/app/components/*.jsx` when porting prototype behavior

## UI Implementation Rules

### Design Quality Gate

For substantial consumer-facing UI work, redesigns, new product flows, or
visual direction changes, do not move directly from requirements to code. Use
this design stack in order:

1. Apply `roam-storefront-ui` for Roam product, brand, component, i18n, and
   mobile-first constraints.
2. Before implementation, use the official `frontend-design` skill for a
   brief-specific visual direction and self-critique, then use Impeccable
   `shape` with its product register to turn that direction into a coherent
   product interaction. Existing Lume tokens and patterns remain authoritative.
3. Generate a visual mockup for approval. When the choice is broad, show four
   clearly differentiated options in one comparison image. Do not implement a
   visual direction that has not been approved.
4. Use `emil-design-eng` when the surface includes motion, gestures, popovers,
   transitions, state changes, or other interaction details. Motion must
   communicate state and remain fast, interruptible, and reduced-motion safe.
5. Before completion, run an Impeccable `critique` or `polish` pass and verify
   the real UI with browser screenshots at representative mobile and desktop
   sizes. Fix generic AI patterns, inconsistent component vocabulary, weak
   hierarchy, missing states, and unnecessary decoration before handoff.

Do not use landing-page or Awwwards-oriented skills as the primary authority
for authenticated product UI. Routine copy edits, exact bug fixes, and small
design-system-aligned changes do not require the full stack, but still follow
`roam-storefront-ui` and existing tokens.

- All app UI must use the shared component library and local design-system
  patterns for interactive controls.
- Do not introduce raw native controls such as `<select>`, custom dropdown
  overlays, or ad hoc menus when a library component exists (`Select`,
  `DropdownMenu`, `Popover`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`, etc.).
- If a form needs native POST compatibility, wrap the library component in a
  local adapter such as `FormSelect`; do not render a bare native control in
  product UI.
- Storefront UI must preserve existing motion, radius, typography, and
  chip/menu treatments.
- Prefer existing `apps/web/src/components/ui/*` primitives and local patterns
  before creating a new primitive.
- Use `lucide-react` icons for UI symbols. Do not use emoji or unicode glyphs
  as icons.
- Use Tailwind v4 tokens and CSS variables from `apps/web/src/app/globals.css`.
  Do not hard-code brand hex values in components unless extending the token
  source itself.
- Keep client components small and purposeful. Add `"use client"` only for
  state, effects, browser APIs, event handlers, or animation that requires it.
- Server components should fetch and shape data where possible; client
  components should render interaction state.
- Avoid layout shift. Fixed-format UI like tabs, nav, grids, cards, and icon
  buttons need stable dimensions across loading, hover, and translated text.
- Any new user-visible string in `apps/web` must go through the dictionaries.
  Update both `en.json` and `zh-TW.json`.
- Do not port prototype implementation details blindly. Port the product
  behavior and visual intent into typed TSX, Tailwind, shadcn/ui, and existing
  app structure.

## Storefront Context

Production consumer UI lives under:

- `apps/web/src/app/[lang]/(storefront)/`
- `apps/web/src/components/storefront/`
- `apps/web/src/lib/mock/consumer.ts`
- `apps/web/src/lib/shop-link.ts`
- `apps/web/src/lib/storefront-*`

Important product flows to preserve:

- Home active eSIM hero with usage, remaining data, and signal treatment.
- Trips list and trip detail with overview, checklist/tasks, and Lumi context.
- Lumi response can produce itinerary cards and eSIM recommendation CTAs.
- Checklist items with `kind: "esim"` should shortcut into shop prefiltering.
- Shop filters should be URL-query addressable, for example country and days.
- Mobile uses bottom tab navigation; desktop uses a left rail.

## Admin Context

Admin UI lives under `apps/web/src/components/admin/` and related routes.

- Keep admin screens dense, stable, and optimized for repeated operations.
- Use table, select, dialog, popover, sheet, switch, checkbox, and form
  adapters already present in the admin component folder.
- Preserve publication, supplier, plan, vendor, mapping, commission, and sync
  workflows. These are operational surfaces, not marketing pages.
- Show API or sync failures explicitly; do not hide failed states behind generic
  loading UI.

## API And Catalog Rules

- `services/api` is Hono on Node 22 with ESM, TypeScript, Drizzle, Vitest, and
  Fastmove supplier integration.
- The API must boot `/healthz` without optional credentials. Validate required
  env vars at point of use, matching existing patterns.
- Keep supplier protocol code separated from business logic. Types and signing
  code should stay deterministic and testable.
- Use `zod` or existing schema helpers for external input.
- Catalog business rules belong in `packages/catalog` when they are shared by
  web/admin/API, not duplicated in app code.
- Add or update focused tests for pricing, publication, substitution, supplier
  parsing, signing, and sync behavior when touched.

## Data, Env, And Secrets

- Read `docs/INFRA.md` before infra, env, deploy, Supabase, Vercel, Railway, or
  credential work.
- This repo is main-only. The `ravn/integration` overlay from older RAVN rules
  does not apply here.
- Vercel production branch is `main`; previews run for other branches.
- Supabase uses shared project `ravn-shared`, schema `roam_poc`, role
  `roam_poc_user`.
- Railway is deferred until a backend service or worker actually needs it.
- Never use resources, accounts, URLs, credentials, orgs, or scopes containing
  `transbiz` in any casing. Stop and surface the blocker if that is the only
  available option.
- Credentials flow through the RAVN hub `secrets-get.sh` and Linear master
  issue process. Do not paste secrets into code, docs, terminal output, or
  dashboards from memory.
- `.env.example` files document variables. Real `.env`, `.env.local`, and
  deployed values are outside normal code edits.

## RAVN Agent Rules

Use `agent-rules/` as conditional operating policy:

- Stage completion or Linear handoff: `agent-rules/01-stage-completion.md`
- Default infra choices: `agent-rules/02-default-stack.md`
- PoC-stage decisions: `agent-rules/03-poc-stage.md`
- WBS / Linear planning: `agent-rules/04-wbs.md`
- CI and preview feedback: `agent-rules/05-ci-feedback.md`
- Shared Supabase: `agent-rules/06-shared-supabase.md`
- Company-resource firewall: `agent-rules/07-company-firewall.md`
- PR preview / backend compatibility: `agent-rules/09-pr-previews.md`
- Secrets via Linear: `agent-rules/10-secrets-via-linear.md`

These rules are not all globally applicable to this repo. `docs/INFRA.md`
overrides them where it explicitly says Roam differs, especially main-only
deployment.

## Commands

Install:

```bash
pnpm install
```

Root:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm verify
pnpm verify:ci
pnpm agent:audit
```

Web app:

```bash
pnpm --filter @roam/web dev
pnpm --filter @roam/web build
pnpm --filter @roam/web lint
pnpm --filter @roam/web typecheck
pnpm --filter @roam/web e2e
```

Landing:

```bash
pnpm --filter @roam/landing dev
pnpm --filter @roam/landing build
pnpm --filter @roam/landing lint
pnpm --filter @roam/landing typecheck
```

API:

```bash
pnpm --filter @roam/api dev
pnpm --filter @roam/api build
pnpm --filter @roam/api test
pnpm --filter @roam/api typecheck
```

Catalog:

```bash
pnpm --filter @roam/catalog test
pnpm --filter @roam/catalog typecheck
```

Agent-native shortcuts:

```bash
pnpm verify:web
pnpm verify:landing
pnpm verify:api
pnpm verify:catalog
pnpm verify:lumi-agent
pnpm agent:audit
```

## Verification Policy

Run checks based on changed scope:

- Docs / instructions only: inspect rendered markdown mentally and run a text
  search for stale or contradictory paths.
- Shared TypeScript packages: `pnpm --filter <pkg> typecheck` and tests for
  the touched package.
- `services/api`: `pnpm --filter @roam/api typecheck` and
  `pnpm --filter @roam/api test`; add build when output or deploy code changes.
- `apps/web`: `pnpm --filter @roam/web typecheck`, lint for edited files or
  package lint when practical, and Playwright/browser verification for visible
  UI.
- `apps/landing`: `pnpm --filter @roam/landing typecheck`, lint/build when
  relevant, and browser verification for visible UI.
- Cross-package or release-risk changes: run `pnpm typecheck`, `pnpm lint`, and
  targeted builds/tests.

If a check cannot run because of missing deps, sandboxing, credentials, or an
external service, report that explicitly with the command and reason.

## Git And Delivery

- Check `git status --short` before broad edits and before final response.
- Treat a dirty worktree as user-owned unless you know you created the changes.
- Keep final summaries concise: what changed, where, and what was verified.
- Do not claim a test passed unless you ran it and saw a successful result.
- Do not open a PR or update Linear unless the user asks.

## Project-Local Codex Skills

This repo includes project-local Codex skills under `.agents/skills/`. Use the
skills when relevant:

- `roam-storefront-ui`: consumer storefront, design porting, UI polish.
- `roam-api-catalog`: API, catalog, supplier, pricing, publication work.
- `roam-infra-release`: infra, env, deploy, CI, secrets, Linear handoff.

If the current Codex session does not auto-discover newly added project skills,
read their `SKILL.md` files directly before doing the matching work. Local
`.codex/` files are ignored workspace state unless a future change explicitly
force-adds and documents a shared project config file.
