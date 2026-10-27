# UI and product rules

Read this before consumer storefront, admin, or product-copy work in
`apps/web` or `apps/landing`. The `roam-storefront-ui` skill
(`.agents/skills/roam-storefront-ui/SKILL.md`) carries the same context in
skill form.

## Product thinking

- Roam helps travelers stay connected without thinking about telecom details.
  Favor clear next actions over dense configuration.
- The consumer app is mobile-first. Desktop should feel like a wider product
  surface, not a separate admin dashboard unless the route is actually admin.
- Lumi is a core product surface, not decoration. It should convert trip intent
  into itinerary context and useful eSIM recommendations.
- Lumi-generated itinerary stops follow one invariant: every stop has a
  non-empty `place_name` map anchor. Fix missing anchors in the structured
  output contract (require a mappable place for every stop), not with keyword
  lists or category-specific patches.
- Preserve the CTA chain: trip or checklist context -> shop prefilter ->
  plan comparison -> purchase/action.
- Default locale is `zh-TW`; default currency is TWD. User-facing copy goes
  through `apps/web/src/i18n/dictionaries/` (`en.json` and `zh-TW.json`).
- Empty states are useful and calm: one clear explanation, one obvious next
  action.
- Admin surfaces are operational tools. Optimize for scanning, comparison,
  stable table behavior, and explicit status.

## Product style (Lume, from `design/`)

- Calm, precise, premium, "soft futuristic productivity."
- Warm neutral canvas, deep charcoal text, restrained teal accent `#0FB8B4`.
- Near-monochrome screens; accent color only for active states and meaningful
  actions.
- No emoji in product UI or marketing copy.
- Sentence case everywhere except proper nouns and legal names.
- Copy is short, declarative, and direct. Avoid filler such as "simply",
  "just", "powerful", "seamless", "robust", "revolutionary".
- Errors are honest and actionable. Avoid chatty copy such as "Oops".
- Success feedback is terse: "Saved.", "Published.", "Synced."

Read before substantial UI or copy work:

- `design/README.md`
- `design/DESIGN-SYSTEM.md`
- `design/SYSTEM-README.md`
- `design/app/components/*.jsx` when porting prototype behavior

## Design gate (substantial consumer UI, redesigns, new flows)

Skill routing per stage comes from the machine-level design workflow
(`~/.codex/skills/design-workflow/SKILL.md`). Roam adds:

1. Apply `roam-storefront-ui` first; existing Lume tokens and patterns win.
2. Get a visual mockup approved before implementing. When the choice is broad,
   show four clearly differentiated options in one comparison image.
3. Motion, gestures, popovers and transitions communicate state and stay fast,
   interruptible, and reduced-motion safe.
4. Before handoff, run a critique/polish pass and screenshot the real UI at
   representative mobile and desktop sizes.
5. Landing-page or Awwwards-oriented skills are not the authority for
   authenticated product UI.

Routine copy edits, exact bug fixes and small design-system-aligned changes
skip the gate but still follow `roam-storefront-ui` and existing tokens.

## Implementation

- Interactive controls come from the shared component library
  (`apps/web/src/components/ui/*`: `Select`, `DropdownMenu`, `Popover`,
  `Dialog`, `Sheet`, `Tabs`, `Tooltip`, ...), not raw native controls or ad hoc
  menus.
- When a form needs native POST compatibility, wrap the library component in a
  local adapter such as `FormSelect` (`apps/web/src/components/admin/form-select.tsx`).
- Preserve existing storefront motion, radius, typography, and chip/menu
  treatments.
- Icons: `lucide-react`. No emoji or unicode glyphs as icons.
- Colors and tokens: Tailwind v4 tokens and CSS variables from
  `apps/web/src/app/globals.css`. Brand hex values live only in the token
  source.
- Add `"use client"` only for state, effects, browser APIs, event handlers, or
  animation that needs it. Server components fetch and shape data; client
  components render interaction state.
- Avoid layout shift: tabs, nav, grids, cards and icon buttons keep stable
  dimensions across loading, hover, and translated text.
- Port prototype behavior and visual intent into typed TSX, Tailwind,
  shadcn/ui and the existing app structure, not prototype implementation
  details.

## Storefront

Production consumer UI:

- `apps/web/src/app/[lang]/(storefront)/`
- `apps/web/src/components/storefront/`
- `apps/web/src/lib/mock/consumer.ts`
- `apps/web/src/lib/shop-link.ts`
- `apps/web/src/lib/storefront-*`

Flows to preserve:

- Home active eSIM hero with usage, remaining data, and signal treatment.
- Trips list and trip detail with overview, checklist/tasks, and Lumi context.
- Lumi responses can produce itinerary cards and eSIM recommendation CTAs.
- Checklist items with `kind: "esim"` shortcut into shop prefiltering.
- Shop filters are URL-query addressable (for example country and days).
- Mobile uses bottom tab navigation; desktop uses a left rail.

## Admin

Admin UI lives under `apps/web/src/components/admin/` and related routes.

- Dense, stable screens optimized for repeated operations.
- Reuse the table, select, dialog, popover, sheet, switch, checkbox and form
  adapters already in that folder.
- Preserve publication, supplier, plan, vendor, mapping, commission and sync
  workflows.
- Show API or sync failures explicitly instead of generic loading UI.
