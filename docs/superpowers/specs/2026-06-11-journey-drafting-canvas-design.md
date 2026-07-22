# Journey Drafting Canvas Design

Date: 2026-06-11
Scope: Roam storefront Trips + Lumi create-trip flow

## Goal

Create an immersive, consumer-friendly drafting surface for Lumi trip creation.
When a traveler asks Lumi to create a new journey, the app should immediately
open a visible canvas that shows the trip taking shape, even before OpenAI has
finished the first response.

The experience should feel like Notion creating a database or ChatGPT preparing
an image canvas: the user sees a dedicated workspace, meaningful progress, and
contextual questions instead of waiting inside a chat bubble.

## Product Principles

- Lumi remains a guide, not an engineering console. The UI must not expose raw
  tool calls, schemas, JSON, or model mechanics.
- The main flow should feel AI-driven but not AI-themed. Lumi is represented by
  a small avatar that moves to the active part of the journey canvas when it has
  something to say.
- The canvas should be useful before the model completes. It can show inferred
  high-level structure, skeleton sections, progress stages, and pending
  questions.
- Missing critical information is handled inside the canvas. Lumi asks for the
  missing choice near the relevant section, then continues drafting.
- Progress should follow the traveler-facing planning model already present in
  Roam: direction first, then time, places, route, and prep.

## First Version Scope

First version covers create-trip requests from the Trips page, including pasted
itineraries and free-form prompts that clearly intend to create a new journey.

Included:

- Open an immersive drafting canvas as soon as the user submits a create-trip
  prompt.
- Show a five-stage progress path: Direction, Time, Places, Route, Prep.
- Show a high-level journey outline before detailed days are ready.
- Show Lumi avatar and contextual speech bubble for status or critical
  questions.
- Stream progress events into the canvas.
- Render staged draft days as they become available.
- Preserve the drafting canvas if the model times out, with a retry path.
- Convert the completed draft into the existing trip creation flow.

Out of scope for first version:

- Replacing the existing trip detail planning workspace.
- Rebuilding all Lumi chat UI.
- Real collaborative editing.
- Full offline draft persistence beyond the current browser session.
- Showing raw model/tool output to the user.

## Experience Model

### Stage 1: Direction

Purpose: confirm the trip shape before asking Lumi for detailed days.

Visible content:

- Working title or destination hint.
- Main destination cities or regions.
- Date range or duration.
- Trip pace choice when needed.

Critical information examples:

- Missing destination.
- Missing dates or duration.
- Conflicting date range.
- Ambiguous pace for a dense prompt.

User interaction:

- Lumi asks a short question in a speech bubble near the Direction section.
- Choices appear as segmented buttons when possible, such as Light, Balanced,
  Packed.
- Free-form answer is available when choices are insufficient.

### Stage 2: Time

Purpose: arrange the macro timeline.

Visible content:

- City blocks.
- Nights per city.
- Travel days.
- Known flights or intercity moves.

The canvas should still avoid detailed POIs at this stage. The user should feel
that Lumi is laying down the journey skeleton.

### Stage 3: Places

Purpose: add primary places and regional exploration slots.

Visible content:

- Day cards begin to fill with main stops.
- Regional stops appear as choice areas rather than fake exact pins.
- Candidate count can be shown, but individual suggested places can remain
  pending until background lookup finishes.

### Stage 4: Route

Purpose: turn places into a usable day order.

Visible content:

- Movement hints.
- Airport/station segments.
- Hotel or lodging placeholders.
- Map preview shifts from city pins to coarse route segments.

### Stage 5: Prep

Purpose: add practical next actions.

Visible content:

- Checklist preview.
- eSIM recommendation entry point.
- Ticket, booking, reservation, document, and transit reminders.

## Layout

The drafting canvas is a full-screen or near-full-screen mode launched from the
Trips page. It should feel immersive but still familiar to a normal traveler.

Recommended desktop layout:

- Top: compact progress path with the five stages.
- Center: journey outline and progressive day cards.
- Right: map and prep preview.
- Bottom or contextual area: primary action and retry/continue state.
- Lumi avatar: starts near the lower-right, then moves near the active section
  when speaking.

Recommended mobile layout:

- Top: stage path as horizontal scroll or compact stepper.
- Main: stacked canvas sections.
- Lumi bubble overlays near the active section, with careful collision handling.
- Map preview collapses behind a tab or expandable row.

## Lumi Avatar Behavior

Lumi is not a fixed chat panel during drafting.

States:

- Idle guide: avatar rests near the lower-right of the canvas.
- Speaking: avatar moves near the active section and displays a speech bubble.
- Asking: speech bubble includes choices or a small input.
- Working: speech bubble becomes a concise status message.
- Done: avatar returns near the final create action.

Movement should be subtle and calm:

- Fade and translate, no bouncy motion.
- Respect reduced motion.
- Never cover critical content.

## Data And State

Introduce a client-side drafting session model.

Drafting session fields:

- `id`: local session id.
- `status`: `starting | needs_input | drafting | ready | failed`.
- `stage`: `direction | time | places | route | prep`.
- `prompt`: original user prompt.
- `outline`: destination, dates, cities, pace, and known constraints.
- `questions`: pending critical information prompts.
- `stagedDays`: days received so far.
- `stagedChecklist`: prep items received so far.
- `tripDraft`: final Lumi trip draft when ready.
- `events`: progress events and user answers.
- `error`: recoverable failure message.

This can start as local React state owned by the Trips page or Lumi assistant
shell. Persistence to the database can follow once the behavior is stable.

## API And Streaming

The current `/api/lumi/chat/stream` SSE path should be extended with
traveler-facing draft events.

Recommended event types:

- `draft_session_started`: open the canvas immediately.
- `draft_stage_changed`: update the active stage.
- `draft_outline`: update high-level destination/date/city/pace outline.
- `draft_question`: ask for missing critical information.
- `draft_days_staged`: append or replace staged days.
- `draft_prep_staged`: append checklist or prep preview.
- `draft_ready`: final trip draft is ready to create.
- `draft_failed`: keep canvas open with retry actions.

The backend should not invent regional intent with free-text post-processing.
Lumi must emit structured intent. Backend processing can validate contracts,
resolve stable facts, and enrich with deterministic services such as Google
Place IDs, coordinates, and lookup results.

## Critical Information Flow

When critical information is missing, the canvas pauses in `needs_input`.

Question design:

- Ask one concise question.
- Prefer 2-3 choice buttons when the trade-off is clear.
- Offer free-form input when the choices cannot cover the need.
- Keep the partially built canvas visible.

Examples:

- Destination missing: "Where should this journey go?"
- Dates missing: "When do you want to travel?"
- Pace ambiguous: "How packed should the days feel?"
- Travel group missing when required: "How many travelers should I plan for?"

After the user answers, the same drafting session resumes with the answer added
to the event history.

## Timeout And Failure Behavior

Timeout should not collapse the experience back into an error bubble.

If OpenAI times out:

- Keep the drafting canvas open.
- Preserve prompt, outline, progress events, staged days, and answers.
- Show a calm failure state at the current stage.
- Offer retry from the same session.
- If staged days exist, allow the user to continue with partial draft or retry
  only the missing stages.

Copy direction:

- Good: "Lumi paused while drafting. Your outline is still here."
- Good: "Retry from Places."
- Avoid: "OpenAI request timed out" in product UI.

## Visual Direction

The visual direction should follow Roam/Lume:

- Warm neutral canvas.
- Deep charcoal text.
- Restrained teal accent for active stage and primary action.
- Soft glass panels.
- No emoji.
- No code-like labels.
- No raw tool names.
- No busy dashboard chrome.

The experience should feel like a travel document coming into focus, not a
developer workflow.

## Acceptance Criteria

- Starting a create-trip prompt immediately opens a drafting canvas.
- The user sees Direction stage before any model result is complete.
- Progress events update the canvas, not only the chat bubble.
- Missing critical information is asked inside the canvas.
- A completed `trip_draft` appears in the canvas with the existing Create trip
  action.
- Timeout leaves a recoverable canvas state.
- The UI works on desktop and mobile.
- New user-facing copy exists in both `zh-TW.json` and `en.json`.
- No raw OpenAI errors, tool call JSON, or schema language appears in the
  product UI.

## Open Implementation Questions

- Should the first version persist drafting sessions to the backend, or keep
  them local until final draft creation?
- Should the Trips page own the canvas, or should Lumi assistant own it and
  render a portal over the page?
- Should critical information questions be handled by a separate lightweight
  classifier before OpenAI drafting, or by the same Lumi turn through SSE?

Recommended defaults for implementation planning:

- Keep first-version drafting sessions local.
- Let Lumi assistant own session state and render the canvas as a page overlay.
- Use deterministic preflight extraction for obvious fields such as dates and
  destination only when stable; leave nuanced decisions to Lumi and the user.
