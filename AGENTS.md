# Roam

RAVN's eSIM travel product. pnpm monorepo; the product center is the consumer travel flow: trips, tasks, Lumi AI planning, eSIM recommendation, shop prefiltering.

## Where things live

- `apps/web` (`@roam/web`): consumer storefront, admin, i18n app. Next.js 16.2 App Router, React 19.2, Turbopack, shadcn/ui, Tailwind v4. Dev on `:3010`.
- `apps/landing` (`@roam/landing`): public marketing site, Next.js 16. Dev on `:3011`.
- `services/api` (`@roam/api`): Hono on Node 22, Drizzle, Fastmove supplier integration. Dev on `:3001/healthz`.
- `services/lumi-agent`: Python Lumi agent (uv, pytest).
- `packages/catalog`: catalog schema, pricing, substitution, publication rules shared by web/admin/API.
- `packages/shared`: shared env and Supabase utilities.
- `design/`: Lume design system and the consumer app prototype.
- `scripts/oracle/`: the shippable verdict (build, smoke, visual gates).
- `agent-rules/`: RAVN operating rules (Linear handoff, CI, secrets); `docs/INFRA.md` overrides them where Roam differs.
- `.agents/skills/`: project skills `roam-storefront-ui`, `roam-api-catalog`, `roam-infra-release`. If your session does not discover them, read their `SKILL.md` directly.

## Rules an agent would not guess

- Next.js 16 differs from older versions: read the matching guide under `node_modules/.pnpm/next@*/node_modules/next/dist/docs/` before changing routing, layouts, server/client boundaries, caching, forms or route handlers.
- Every new user-visible string in `apps/web` goes into both `apps/web/src/i18n/dictionaries/zh-TW.json` and `en.json`. Default locale `zh-TW`, default currency TWD.
- Every Lumi itinerary stop has a non-empty `place_name`; fix gaps in the structured output contract, not with keyword lists.
- Preserve the CTA chain: trip or checklist context -> shop prefilter -> plan comparison -> purchase.
- The API boots `/healthz` without optional credentials; validate required env vars at point of use.
- Reject any resource, account, URL, org or scope containing `transbiz` in any casing; if it is the only option, stop and report the blocker (`agent-rules/07-company-firewall.md`).
- Credentials come only through the RAVN hub `secrets-get.sh` flow (`agent-rules/10-secrets-via-linear.md`). `.env.example` files are editable; real env files are not.

## Workflow

1. Branch from `origin/main` as `ravn/<slug>` in its own worktree.
2. Implement, reusing the existing component library, tokens and shared packages.
3. Check the changed scope with `pnpm verify:web`, `verify:landing`, `verify:api`, `verify:catalog` or `verify:lumi-agent`; screenshot visible UI in a browser at mobile and desktop widths.
4. Before handoff of shippable work, run `./scripts/oracle/run.sh` (exit 0 = shippable). `pnpm verify:ci` mirrors CI.
5. Deliver through a PR to `main`. Merging to `main` deploys production (Vercel for web; the API on Railway), so land changes only through a PR.
6. For Linear-driven work, finish with the stage-completion steps in `agent-rules/01-stage-completion.md`.

## Docs

- UI, product copy, storefront and admin rules: `docs/UI.md`.
- Commands, ports, checks by scope, Next.js guide index: `docs/DEVELOPMENT.md`.
- App boundaries, data ownership, Lumi authorization, API/catalog rules: `docs/ARCHITECTURE.md`.
- Infra, env vars, Vercel, credentials: `docs/INFRA.md`.
- Production storefront outage, `/readyz`, Railway API and database, which build is live: `docs/RUNBOOK-storefront.md`.
- Adding a runtime/package, file size budget, known agent-risk debt: `docs/AGENT_NATIVE.md`.
- Images and icon assets: `docs/ASSETS.md`.
- Feature specs and plans: `docs/specs/`, `docs/superpowers/`.
