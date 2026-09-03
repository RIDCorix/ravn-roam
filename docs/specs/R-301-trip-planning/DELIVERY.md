# R-301 delivery notes

The planning surface lives at `/[lang]/dev/trip-planner`. It is a fixture
route, and c-1 is the reason: the fixture composes the real storefront
bottom navigation (`StorefrontShell`) with the planner, so "the sheet does
not overlap the navigation" is a claim about a navigation that is actually
on screen.

## Where the work is

| Piece | File |
| --- | --- |
| Geometry, detents, gesture math, stay segments, field mapping | `apps/web/src/components/storefront/trips/planner/planner-model.ts` |
| Sheet, map, timeline, overview, CTAs | `.../planner/planner-workspace.tsx` |
| Map (Leaflet on OSM, unchanged provider) | `.../planner/planner-map.tsx` |
| Type-specific full view | `.../planner/planner-full-view.tsx` |
| Labels (zh-TW + en) | `storefront.trips.planner` in both dictionaries |
| Layout, materials, accessibility modes | `apps/web/src/app/globals.css`, `.planner*` block |
| Fixture trip | `apps/web/src/app/[lang]/dev/trip-planner/fixture-trip.ts` |

## The numbers D-1 argues about

The denominator is the planning space: the viewport minus the planner's own
top chrome minus the space the bottom navigation reserves. It is CSS-first,
so the first paint is already correct and JavaScript only takes over while a
finger is on the grabber:

```
--planner-planning-space: 100dvh - var(--planner-top-chrome) - var(--planner-nav-reserve)
sheet  = planning space x detent fraction   (map 0.24, plan 0.62, full 0.94)
map    = planning space - sheet
```

At 390x844 that is 660px of planning space, a 409px sheet and a 251px map —
a 38% map share, inside the 35-41% band, with the sheet's bottom edge 2px
clear of the navigation.

## Criteria and their checkers

| # | Checker |
| --- | --- |
| c-1 | `e2e/trip-planner.spec.ts` baselines at 390/1280/1440/1720, plus overflow, single-visible-nav and clipped-control assertions. Map tiles are masked; the composition is ours, the tiles are a third party's. |
| c-2 | Measured from real bounding boxes (nav top minus chrome bottom); day/item/detent asserted across opening and leaving the full view. |
| c-3 | `planner-model.test.ts` for the stay-segment and field-mapping contracts, e2e for what the sheet and the full view actually render. |
| c-4 | Reduced motion via `emulateMedia`, reduced transparency via a CDP `Emulation.setEmulatedMedia` feature (Playwright has no option for it), higher contrast via `emulateMedia({ contrast: "more" })`. The full-motion case is asserted too, so the reduced-motion assertion means something. |
| c-5 | Rendered checks in both locales at 390 and 1280: no box intersections, nothing truncated, and identical chrome height across locales. |
| c-6 | Both CTAs are clicked and land on `/[lang]/shop/japan/plans?days=8`, with the region page rendered and the trip-length control reading 8. |
| c-7 | Human. Not claimed here. |
| c-8 | All four item types edited, saved, closed and reopened. |

## Two things a reviewer should know

**The shop routes were restored.** `buildShopHref` has always pointed at
`/[lang]/shop/<region>/plans`, but that route was deleted from this branch by
`4015d20`. c-6 cannot be honest against a 404, so the three shop pages are
restored from `4015d20^` unchanged, with the same Supabase-optional guard the
storefront layout already needed for anonymous browsing. The purchase flow
itself is untouched.

**Editing is in-memory.** The fixture has no backend, so a saved item survives
closing and reopening the editor, day switching and detent changes, but not a
page reload. Wiring the planner to the trips API is the follow-up, and it is
where the existing autosave behaviour belongs.

## Running it

```bash
pnpm --filter @roam/web test          # unit
pnpm --filter @roam/web dev           # then, in another shell:
pnpm --filter @roam/web exec playwright test e2e/trip-planner.spec.ts
```

Baselines are macOS baselines (`-darwin` suffix). A Linux CI run needs its own.
