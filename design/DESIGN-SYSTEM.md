# Lume Design System

> **Soft futuristic productivity.** A premium AI-native workspace for modern creative teams.

Lume is a next-generation productivity platform. The design language sits at the intersection of **Linear's precision**, **Framer's polish**, **Notion's calm**, and **Raycast's economy** — minimal, futuristic, and quietly confident. The interface relies on whitespace, typography hierarchy, and layered depth instead of heavy borders or loud colors.

---

## Brand voice in one line
> *Lume is the calm, intelligent surface where your team thinks together.*

## Source materials

This system was authored from a written brief — **no Figma file, codebase, or existing assets were provided**. Everything here (logo, illustrations, components, screens) is original to this project and should be treated as the canonical source of truth until a production codebase exists. When a real codebase lands, replace the recreations in `ui_kits/` with imports.

- Brief: pasted into the kickoff conversation (see project history)
- Visual references called out in brief: Linear, Framer, Notion, Raycast, Vercel, Arc, Superhuman
- Type references called out in brief: Inter, Geist, Satoshi, SF Pro Display

---

## CONTENT FUNDAMENTALS

Lume's copy is **quiet, declarative, and second-person**. We write the way the product feels — calm, precise, and a little editorial. Sentences are short. Marketing copy reads like a thought, not a pitch.

### Voice rules
- **Second person ("you"), never "we" in product UI.** Marketing can use "we" sparingly when describing the team or philosophy.
- **Sentence case everywhere.** Headings, buttons, menu items, settings, toasts. Title Case only appears in legal pages and proper nouns.
- **No exclamation marks.** Lume never shouts. Replace enthusiasm with precision: "Saved." not "Saved!"
- **No filler.** Cut "simply," "just," "easily," "powerful," "seamless," "robust." If a sentence still says the same thing without the word, the word doesn't belong.
- **Verbs over nouns.** "Share with your team" beats "Team sharing capabilities."
- **No emoji.** Anywhere. Not in marketing, not in empty states, not in onboarding. The visual system carries warmth so the language doesn't have to.

### Casing
- Product name: **Lume** (never LUME, never lume except in URLs)
- Feature names: sentence case ("Focus mode", not "Focus Mode")
- Buttons: sentence case, max ~3 words ("Create document", "Invite team", "Save changes")
- Empty states: one calm sentence, one action. No illustrations of cartoon characters.

### Tone by surface

| Surface | Tone | Example |
|---|---|---|
| Marketing hero | Editorial, declarative | *A quieter place to think with your team.* |
| Product UI | Direct, minimal | *Add a teammate* |
| Empty state | Inviting, one beat | *Nothing here yet. Start a document to begin.* |
| Error | Honest, never apologetic-fluffy | *Couldn't save. Check your connection and try again.* |
| Success toast | Single word when possible | *Saved.* / *Invited.* / *Shared.* |
| AI response | Confident, hedges only when honest | *Here's a draft. Tighten the second paragraph if you want.* |

### What we don't do
- No "AI-powered ✨" — the sparkle emoji is banned. AI is named, not decorated.
- No "Get started for free!" CTAs. Use "Start with Lume" or "Open Lume."
- No fake personality. The brand is calm, not chatty. Don't write "Oops!" on errors.
- No marketing-speak: "revolutionary," "game-changing," "next-level," "supercharged."

### Sample copy

**Hero (marketing):**
> A quieter place to think with your team.
> Lume is the AI workspace built for creative work — fast, focused, and shared.

**Empty document:**
> Untitled
> Start typing, or press `/` for commands.

**Onboarding step:**
> One last thing.
> Invite a teammate to see Lume the way it was built to be used — together.

**AI prompt placeholder:**
> Ask Lume, or describe what to build.

---

## VISUAL FOUNDATIONS

### Color
A **near-monochrome** palette anchored by warm white (`#F7F7F5`) and deep charcoal (`#111111`), with a single soft purple accent (`#0FB8B4`). Color is a tool of emphasis, never decoration. A typical screen uses three colors total: surface, text, and one accent moment. Semantic colors (success, warning, error, info) are desaturated — never the bright Material defaults.

### Type
**Inter** is the system typeface (substituted from Geist/Satoshi in the brief — see Caveats), paired with **Intel One Mono** for code, keyboard hints, and data. Type does the heavy lifting: hierarchy comes from **weight contrast** (400/500/600/700) and **size jumps**, not color. Display sizes are dramatic (72–96px). Tight tracking on headings (`-0.02em` to `-0.04em`), comfortable tracking on body. Line-height tightens as size grows.

### Spacing
**8px base unit.** Generous. Layouts breathe. Card padding starts at 24px and scales up. Section spacing on marketing pages is 96–160px. Never crowd; if a screen feels dense, remove something.

### Backgrounds
- **Warm white** (`#F7F7F5`) is the default canvas — never pure white, never pure gray.
- **Subtle gradients** appear at section transitions and behind hero modules — radial, low-contrast, often a faint purple bloom in the upper-left or behind a CTA.
- **Faint noise texture** (1–2% opacity) on full-bleed hero sections only. Optional.
- **Orbital decorative lines** — thin (1px), 8% opacity, used sparingly as section dividers or behind illustration moments.
- **No full-bleed photography by default.** When imagery is used, it's product UI screenshots floating in 3D, not stock photos of people.

### Animation & motion
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style ease-out) for most movement; `cubic-bezier(0.4, 0, 0.2, 1)` for material-style ease-in-out where needed.
- **Duration:** 180ms for micro (hover, focus); 260ms for state changes; 420ms for entrance/page transitions.
- **No bounces, no overshoots.** Spring physics are banned — they feel toy-like.
- **Fades + subtle lifts.** Most transitions are opacity + 4–8px translateY. Blur transitions (`backdrop-filter`) for modal/sheet entrances.
- **Stagger** lists by 30–40ms when introducing rows.

### Hover & press states
- **Hover:** background gets +4% brightness (or a faint surface fill on transparent buttons), shadow grows by ~30% blur. No color shifts.
- **Press:** scale to `0.98`, shadow contracts. 80ms in, 120ms out.
- **Focus:** 2px purple ring with 4px transparent purple halo. Never a default browser outline.
- **Disabled:** 40% opacity, `cursor: not-allowed`, no shadow.

### Borders
- **Almost no borders.** Separation comes from shadow, surface color, and spacing.
- Where used: `1px solid rgba(0,0,0,0.06)` — barely visible. Inputs get this on resting state; cards usually don't.
- **No colored borders.** No left-accent-bar pattern (banned).

### Shadows (elevation system)
Five layers, ambient and soft. All shadows are blue-shifted slightly (using `rgba(17, 17, 32, …)`) to feel atmospheric rather than gray.

```
--shadow-xs: 0 1px 2px rgba(17,17,32,0.04)
--shadow-sm: 0 2px 8px rgba(17,17,32,0.04), 0 1px 2px rgba(17,17,32,0.04)
--shadow-md: 0 8px 24px rgba(17,17,32,0.06), 0 2px 6px rgba(17,17,32,0.04)
--shadow-lg: 0 16px 48px rgba(17,17,32,0.08), 0 4px 12px rgba(17,17,32,0.05)
--shadow-xl: 0 32px 80px rgba(17,17,32,0.12), 0 8px 24px rgba(17,17,32,0.06)
--shadow-glow-purple: 0 12px 40px rgba(15, 184, 180,0.24), 0 0 0 1px rgba(15, 184, 180,0.08)
```

Cards: `--shadow-sm` at rest, `--shadow-md` on hover. Modals: `--shadow-xl`. Primary CTA: `--shadow-md` plus the purple glow on hover.

### Corner radii
Nothing is sharp. The smallest radius in the system is 8px.

| Element | Radius |
|---|---|
| Pills, tags | 999px |
| Inputs, small buttons | 12–14px |
| Buttons | 14–18px |
| Cards | 20–24px |
| Floating panels, modals | 24–32px |
| Hero canvas | 28–32px |

### Cards
- Surface: `#FFFFFF` or `#FCFCFD` (elevated)
- Radius: 20–24px
- Shadow: `--shadow-sm` resting → `--shadow-md` hover
- Border: usually none; optional `1px solid rgba(0,0,0,0.04)` for cards on white surfaces
- Padding: 24px minimum, 32–40px for hero cards
- Hover: lift 2px (`translateY(-2px)`), shadow grows

### Transparency & blur
- **`backdrop-filter: blur(20px)` + 70–85% surface opacity** for sticky headers, command palette, popovers, sheets.
- Modal scrims: `rgba(17,17,32,0.32)` with 8px blur.
- Never use transparency on body content — only on chrome (overlays, headers).

### Imagery
- **Cool, neutral, slightly desaturated.** When stock photography appears, it leans cool with a hint of grain. No warm Instagram tones.
- Product screenshots are the primary imagery. They float on the canvas with `--shadow-lg`, often tilted 2–4° on hero pages, sometimes layered (one behind, one in front).
- No illustrations of people. No corporate-Memphis blobs. No 3D blender renders.

### Layout rules
- **Centered, max-width 1200px** for marketing content; **1440px** for app surfaces.
- **Floating chrome.** Top nav floats with a glass effect; sidebars have rounded outer corners.
- **8px grid.** Every spacing value is a multiple of 8 (with 4px allowed for micro-adjustments).
- **Fixed elements** (nav, sidebar, command palette) all use the glass-blur treatment.

### Color vibe of imagery
Cool, low-contrast, slightly grainy. Think early-morning light, not golden hour.

---

## ICONOGRAPHY

Lume uses **Lucide** (lucide.dev) as its icon system — thin, geometric, rounded line icons at a consistent 1.5px stroke. Lucide was chosen over Phosphor and Tabler because of its tighter, more uniform proportions and excellent React/CDN support.

### Usage
- **Stroke weight:** `1.5px` (Lucide default). Never thicken to 2px for "emphasis" — use color or scale instead.
- **Sizes:** 16px (inline / small UI), 20px (default UI / buttons), 24px (cards / nav), 32–40px (feature illustrations).
- **Color:** inherits `currentColor`. Monochrome by default. Accent purple reserved for *active* states only, never decoration.
- **Stroke-linecap:** round. Stroke-linejoin: round.
- **No filled icon variants.** Outline only.
- **Loading:** import per-icon from CDN; do not ship the whole icon font.

### CDN
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<i data-lucide="search"></i>
<script>lucide.createIcons();</script>
```

### Emoji & unicode
- **No emoji in product UI or marketing.** Ever.
- **No unicode glyphs as icons.** No ★, ✓, ➜. Use Lucide.
- Exceptions: typographic dashes (`—`, `–`), curly quotes (`"` `"` `'` `'`), and the multiplication sign (`×`) for close buttons are allowed because they are punctuation, not icons.

### Logo
The Lume mark is a single geometric form — a soft "lume" glyph (rounded lens shape) — paired with the wordmark in **Inter 600 with -0.04em tracking**. The mark works monochrome (charcoal on warm white) and inverted (white on charcoal). The purple variant is reserved for the favicon and rare brand moments.

See `assets/logo.svg`, `assets/logo-mark.svg`, `assets/logo-inverted.svg`.

---

## Index

```
README.md                  — this file
SKILL.md                   — Agent Skill manifest
colors_and_type.css        — CSS variables (colors, type, spacing, shadows, radii)
fonts/                     — webfont files (currently CDN-loaded; see Caveats)
assets/                    — logos, marks, brand SVGs
preview/                   — design system tab cards (one per token group)
ui_kits/
  web-app/                 — Lume product recreation (sidebar, editor, command palette)
    index.html
    components/*.jsx
  marketing/               — Lume marketing site recreation
    index.html
    components/*.jsx
```

### Quick links
- Type scale → `preview/type-scale.html`
- Color palette → `preview/colors-neutrals.html`, `preview/colors-accent.html`, `preview/colors-semantic.html`
- Buttons → `preview/buttons.html`
- Cards → `preview/cards.html`
- Product UI → `ui_kits/web-app/index.html`
- Marketing site → `ui_kits/marketing/index.html`

---

## Caveats

- **No source codebase or Figma was provided.** This system is authored from a written brief; the logo, components, and screens are original recreations of the described aesthetic, not imports.
- **Sans font substituted:** brief suggested Geist / Satoshi / SF Pro Display. We are loading **Inter** (Google Fonts) as the closest fully-licensed match with full weight coverage. If the team licenses Geist or Satoshi, swap by editing the `@import` in `colors_and_type.css` and the `--font-sans` variable.
- **Mono font shipped:** **Intel One Mono** (variable, weights 300–700) is the canonical mono — used for code, kbd hints, table data, and token names. File lives at `fonts/IntelOneMono-VariableFont_wght.ttf`.
- **No slide template** was provided, so `slides/` is intentionally absent.
- **Lucide is CDN-loaded** rather than vendored. If air-gapped use is required, run `npm i lucide-static` and copy the SVGs into `assets/icons/`.
