# Trips editorial redesign

## Product outcome

Redesign the complete Trips surface as a calm, editorial travel workspace. The
list should make every trip feel like a journey in progress; the detail page
should retain the current planning depth while becoming easier to scan and
more coherent across desktop and mobile.

## Approved direction

The approved visual lane is **Living travel journal (Plan C)**:

- Warm ivory paper canvas, white working surfaces, charcoal text, and a
  restrained teal accent.
- An editorial serif is reserved for trip names and major section moments;
  controls and data stay in the existing sans and mono families.
- Cool, slightly desaturated destination photography provides identity.
- A route stamp and fine route line are the signature motifs. They encode
  trip dates and sequence rather than acting as decoration.
- The interface remains a professional product workspace. It must not become a
  scrapbook, a photo blog, a generic analytics dashboard, or a card wall.

## Trips list

- Keep search, status tabs, create, delete, loading, and empty states.
- Replace the oversized empty canvas with an editorial first-trip composition:
  one clear explanation, one primary create action, and destination imagery
  that shows the product's intended richness without inventing user data.
- Present real trips with a destination image, status, title, city sequence,
  dates, companion context, and planning progress in one scan path.
- Preserve the existing manual, Explore, and Lumi creation modes.
- Secondary destination and planning content remains subordinate to the user's
  own trips and collapses naturally on smaller screens.

## Trip detail

- Preserve all existing capabilities: title/date editing, companions,
  share/export, map search and focus, map autoplay, overview/day selection,
  stop reordering, movement segments, lodging, transport, booking attachments,
  place details, candidates, tasks, notes, budget, weather, planning progress,
  and Lumi.
- Use a compact editorial masthead with trip title, date range, route context,
  photography, and actions. It is application chrome, not a marketing hero.
- Keep map and itinerary synchronized. At wide desktop widths they may share a
  working row; at narrower widths they stack without losing order or context.
- Keep the contextual inspector persistent on wide screens and sheet-like on
  smaller screens. Its Progress, Tasks, Notes, and Budget modes remain visible.
- High-frequency actions such as day switching, map focusing, and dragging do
  not receive decorative animation. Occasional drawers and state transitions
  use existing 150–250 ms motion tokens and respect reduced motion.

## Responsive behavior

- Mobile retains a compact sticky trip context, a horizontally scrollable day
  rail, map and timeline in document order, and reachable contextual tools.
- Desktop uses the available width for the map, itinerary, and inspector rather
  than stretching empty space.
- English and zh-TW must fit without fixed label widths or layout shift.

## Architecture

- Keep route pages as server components for authentication and dictionaries.
- Keep interactive state in the existing client workspaces.
- Add small shared editorial presentation primitives instead of duplicating
  stamps, mastheads, and cover treatments.
- Do not replace structured trip data with text guessing. Cover selection uses
  an explicit cover path when available and a deterministic fallback otherwise.
- Add a development-only fixture route so both list and detail can be reviewed
  without creating or mutating a real trip.

## Acceptance criteria

- The list and detail surfaces visibly match the approved Plan C family.
- Existing trip operations and Lumi entry points remain functional.
- Empty, loading, populated, and not-found states have stable layouts.
- Desktop and mobile screenshots show no overflow, clipped controls, duplicate
  navigation, or unreadable translated text.
- Web typecheck and lint pass; focused browser checks cover both fixture views.
