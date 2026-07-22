# Trips Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Living travel journal visual system across the Trips list and the full trip-planning workspace without removing existing behavior.

**Architecture:** Server routes continue to own auth and dictionary loading. Shared editorial presentation primitives are added under the Trips component folder, while the existing client workspaces keep data fetching and mutations. A development-only fixture renders production components with mock data so visual behavior can be tested without mutating a user trip.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 tokens, shadcn/Radix primitives, lucide-react, SWR, Playwright.

## Global Constraints

- Preserve user-owned work and all existing trip mutations.
- Use existing CSS variables and Tailwind tokens; no new component-level brand hex values.
- Update both `en.json` and `zh-TW.json` for any new visible copy.
- Keep high-frequency interaction motion minimal and under 250 ms.
- Respect reduced motion, keyboard focus, mobile layout, and translated text.
- Do not commit, push, or deploy; this repository requires explicit user authorization.

---

### Task 1: Lock the editorial information architecture with a dev fixture

**Files:**
- Create: `apps/web/e2e/trips-editorial.spec.ts`
- Create: `apps/web/src/app/[lang]/dev/trips-editorial/page.tsx`
- Create: `apps/web/src/app/[lang]/dev/trips-editorial/fixture.tsx`
- Create: `apps/web/src/components/storefront/trips/trip-detail-labels.ts`
- Modify: `apps/web/src/app/[lang]/(storefront)/trips/[id]/page.tsx`
- Modify: `apps/web/src/components/storefront/trips/backend-trips-page.tsx`

**Interfaces:**
- `buildTripDetailLabels(storefront)` returns `TripDetailClientLabels` for both production and the fixture.
- `BackendTripsPage` accepts optional `initialTrips` and `preview` props; production behavior remains unchanged when omitted.
- The dev route accepts `?view=list` and `?view=detail` and returns 404 in production.

- [ ] **Step 1: Write the failing Playwright assertions**

  Assert that the list fixture exposes the Trips heading, status navigation,
  and a real trip card; assert that the detail fixture exposes the trip title,
  daily itinerary, map region, and Progress/Tasks/Notes/Budget inspector tabs.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm --filter @roam/web exec playwright test e2e/trips-editorial.spec.ts --project=chromium`

  Expected: FAIL because `/en/dev/trips-editorial` does not exist.

- [ ] **Step 3: Add the dev-only fixture and shared label builder**

  Use typed `Trip`, `ApiCity`, and `ApiCompanion` data for Barcelona, Paris,
  and London. Render the production list or detail workspace based on `view`.
  Move the existing dictionary-to-label mapping into the shared builder.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run the command from Step 2. Expected: PASS with no real trip creation.

### Task 2: Add shared editorial presentation primitives

**Files:**
- Create: `apps/web/src/components/storefront/trips/trip-editorial-ui.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- `EditorialRouteStamp` renders dates/city count as a quiet, non-interactive motif.
- `EditorialCover` renders a supplied cover or a deterministic fallback.
- `EditorialSectionLabel` provides the shared eyebrow/section treatment.

- [ ] **Step 1: Extend the fixture test with visual-structure assertions**

  Assert stable test ids for the route stamp, editorial masthead, and cover.

- [ ] **Step 2: Run the test and verify RED**

  Expected: FAIL because the editorial primitives are absent.

- [ ] **Step 3: Implement tokens and primitives**

  Add an editorial font token backed by local system serif families, paper and
  ink semantic tokens, press feedback, hover gating, and reduced-motion rules.

- [ ] **Step 4: Run the test and verify GREEN**

  Expected: PASS; run `pnpm --filter @roam/web typecheck` for the new exports.

### Task 3: Rebuild the Trips list in the Plan C language

**Files:**
- Modify: `apps/web/src/components/storefront/trips/backend-trips-page.tsx`
- Modify: `apps/web/src/i18n/dictionaries/en.json`
- Modify: `apps/web/src/i18n/dictionaries/zh-TW.json`

**Interfaces:**
- Existing creation, deletion, filtering, SWR cache, and Lumi dispatch functions remain unchanged.
- Trip covers prefer explicit cover paths; fallbacks are deterministic and do not infer intent from free text.

- [ ] **Step 1: Add failing list-state assertions**

  Cover populated cards, empty state CTA, search, tabs, and create trigger in
  desktop and mobile fixture widths.

- [ ] **Step 2: Run focused tests and verify RED**

  Expected: FAIL on the approved editorial hierarchy and stable selectors.

- [ ] **Step 3: Implement the list masthead, cards, side notes, and empty state**

  Recompose the existing behaviors using the shared cover, stamp, section
  label, serif title treatment, and responsive layout. Keep one primary CTA.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Expected: PASS at desktop and mobile viewports.

### Task 4: Recompose the trip detail workspace without dropping behavior

**Files:**
- Modify: `apps/web/src/components/storefront/trips/trip-planning-workspace.tsx`
- Modify: `apps/web/src/components/storefront/trips/trip-detail-client.tsx`

**Interfaces:**
- Existing map, day, stop, movement, lodging, task, note, budget, and Lumi callbacks remain the source of behavior.
- Presentation wrappers may change, but mutation signatures and data types do not.

- [ ] **Step 1: Add failing detail hierarchy assertions**

  Assert the compact editorial masthead, synchronized map/day workspace,
  inspector tabs, share/export/companions actions, and mobile stacking order.

- [ ] **Step 2: Run focused tests and verify RED**

  Expected: FAIL on new structural selectors and responsive layout.

- [ ] **Step 3: Implement the editorial masthead and workspace grid**

  Recompose `TripHeader`, the map, `DailyItinerary`, and `TripSidePanel` using
  the approved hierarchy. At very wide widths, map and itinerary share the
  primary work row; narrower widths stack. Preserve sheet behavior for details.

- [ ] **Step 4: Polish motion and interaction states**

  Remove broad `transition: all`, gate hover motion to fine pointers, keep press
  feedback at 100–160 ms, and retain immediate high-frequency navigation.

- [ ] **Step 5: Run focused tests and verify GREEN**

  Expected: PASS for desktop and mobile detail fixtures.

### Task 5: Visual critique and production verification

**Files:**
- Modify only files from Tasks 2–4 when critique finds a concrete issue.

**Interfaces:**
- No new product behavior; this task is verification and refinement only.

- [ ] **Step 1: Run static checks**

  Run: `pnpm --filter @roam/web typecheck`

  Run: `pnpm --filter @roam/web lint`

- [ ] **Step 2: Capture fixture screenshots**

  Verify list and detail at desktop and mobile widths in both English and
  zh-TW. Check overflow, hierarchy, focus states, and translated label fit.

- [ ] **Step 3: Perform the Emil polish review**

  Review animation decisions in a Before/After/Why table, then fix only issues
  that affect responsiveness, spatial continuity, or feedback.

- [ ] **Step 4: Re-run the focused Playwright test and static checks**

  Expected: all commands pass with no new browser console errors.
