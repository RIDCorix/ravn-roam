# Journey Drafting Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an immersive Lumi-driven trip creation canvas that appears immediately for create-trip requests and keeps progress visible through streaming, final draft creation, and recoverable failures.

**Architecture:** Keep first-version drafting sessions local to the existing `LumiAssistant` client component. Add a focused canvas component next to the assistant, map existing SSE progress events to traveler-facing stages, and show the final `trip_draft` inside the canvas before auto-navigation or manual creation.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind v4, shadcn/ui buttons, lucide-react, framer-motion.

---

### Task 1: Draft Session Types And Labels

**Files:**
- Modify: `apps/web/src/components/storefront/trips/lumi-assistant.tsx`
- Modify: `apps/web/src/i18n/dictionaries/en.json`
- Modify: `apps/web/src/i18n/dictionaries/zh-TW.json`

- [ ] Add `drafting_canvas` labels under `storefront.trips.lumi` in both dictionaries.
- [ ] Extend `LumiAssistantLabels` with stage labels, empty/speaking/status text, retry/close/open actions, and final draft summary labels.
- [ ] Add local `JourneyDraftSession` and `JourneyDraftStage` types in `lumi-assistant.tsx`.

### Task 2: Canvas Component

**Files:**
- Modify: `apps/web/src/components/storefront/trips/lumi-assistant.tsx`

- [ ] Add `JourneyDraftingCanvas` inside the assistant file to keep the first slice local.
- [ ] Use a fixed immersive overlay with warm neutral canvas, compact stage path, map-like route preview, skeleton day cards, and Lumi avatar speech bubble.
- [ ] Render final `TripDraft` with day/city preview and create/created actions.
- [ ] Keep all visible text from dictionaries.

### Task 3: Streaming State Wiring

**Files:**
- Modify: `apps/web/src/components/storefront/trips/lumi-assistant.tsx`

- [ ] Start a drafting session immediately when `sendPrompt` runs with `skill: "create-trip"` or `autoCreateTrip`.
- [ ] On each progress event, advance stage based on stable tool/status names: analyzing -> Direction, stage draft days -> Places, finalizing/lumi_response -> Prep.
- [ ] On final `trip_draft`, set canvas status to ready and store the draft.
- [ ] On error/timeout, keep the canvas open in failed state and expose retry with the original prompt.

### Task 4: Entry Point Cleanup

**Files:**
- Modify: `apps/web/src/components/storefront/trips/local-trips-page.tsx`

- [ ] Ensure signed-in Lumi trip creation dispatches `skill: "create-trip"` and `autoCreateTrip: true`, matching the backend trips page.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `pnpm --filter @roam/web typecheck`.
- [ ] Run a browser pass at `http://localhost:3010/en/trips`.
- [ ] Verify create-trip submission opens the canvas immediately, progress appears without raw OpenAI/tool JSON, and the UI remains usable on desktop/mobile widths.
