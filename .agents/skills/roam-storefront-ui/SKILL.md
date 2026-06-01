---
name: roam-storefront-ui
description: Use when building or modifying Roam consumer storefront UI, porting from the design prototype, touching trips/tasks/Lumi/shop/profile flows, changing i18n copy, or polishing responsive/mobile behavior.
---

# Roam Storefront UI

Use this skill for `apps/web` consumer-facing work under the `[lang]/(storefront)`
route group and `components/storefront`.

## Context Loading

Read only the context the task needs before editing:

- Always: `AGENTS.md` and the relevant production component, route, or local
  pattern in `apps/web/src/components/storefront/`.
- For visible UI changes: inspect nearby styling, shell behavior, and
  `apps/web/src/components/storefront/motion.tsx` when motion is involved.
- For user-visible copy: update and inspect both dictionaries in
  `apps/web/src/i18n/dictionaries/en.json` and `zh-TW.json`.
- For prototype ports: read `design/README.md`, `design/DESIGN-SYSTEM.md`,
  `design/SYSTEM-README.md` when needed, and the relevant
  `design/app/components/*.jsx` file.
- For Next.js behavior changes: read the relevant local Next.js 16 docs under
  `node_modules/.pnpm/next@*/node_modules/next/dist/docs/`.

## Product Priorities

- Mobile-first travel flow: home, trips, tasks, shop, me.
- Lumi should convert trip intent into itinerary context and eSIM recommendation.
- Preserve prefilter paths into Shop from Lumi CTAs and eSIM checklist shortcuts.
- Default to `zh-TW` and TWD mental model; do not add English-only copy.
- Empty states need one calm explanation and one obvious action.

## UI Rules

- Use shadcn/ui and local UI primitives for controls. Do not add raw native
  selects, ad hoc popovers, or custom dropdown overlays when a primitive exists.
- Use `lucide-react` for icons. No emoji or unicode glyphs as UI icons.
- Use Tailwind v4 classes and CSS variables from `apps/web/src/app/globals.css`.
  Do not hard-code brand hex values in components.
- Keep `"use client"` boundaries narrow. Server components should fetch/shape
  data; client components should own interaction state.
- Keep motion consistent with `apps/web/src/components/storefront/motion.tsx`.
- Preserve shell behavior: mobile bottom tabs, desktop left rail.
- Keep text fitting in translated layouts. Test long zh-TW and English labels.

## Porting From Prototype

- Port visual intent and behavior, not the Babel/CDN implementation.
- Convert `.jsx` prototype code to typed `.tsx`.
- Replace inline SVG icon patterns with `lucide-react`.
- Replace prototype mock data with typed data in `apps/web/src/lib/mock/` or
  existing API adapters.
- Do not port prototype-only phone frame or tweaks panel into production.

## Verification

- Run `pnpm --filter @roam/web typecheck` for TS changes.
- Run `pnpm --filter @roam/web lint` when component structure or hooks change.
- Use browser/Playwright verification for visible UI changes across mobile and
  desktop widths.
- For copy changes, update both dictionaries and inspect affected UI for fit.
