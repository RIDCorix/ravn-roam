---
name: lume-design
description: Use this skill to generate well-branded interfaces and assets for Lume, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

**Core philosophy:** "Soft futuristic productivity." A premium AI-native workspace for modern creative teams. Minimal, futuristic, calm, polished. Whitespace, type hierarchy, and layered depth over heavy borders or loud colors.

**Quick references**
- `colors_and_type.css` — the single source of truth for color, type, spacing, shadows, radii, motion. Import this at the root of any page.
- `fonts/IntelOneMono-VariableFont_wght.ttf` — the brand mono. Inter (Google Fonts) is the sans, substituted from the brief's Geist/Satoshi suggestion.
- `assets/logo.svg`, `assets/logo-mark.svg`, `assets/logo-inverted.svg`, `assets/logo-mark-purple.svg` — the Lume mark, wordmark, and inverted variants.
- `preview/` — one HTML card per token group (colors, type, spacing, components, brand). Use as visual reference when designing.
- `ui_kits/web-app/` — the product surface (sidebar, glass top bar, document editor, AI panel, ⌘K palette). Components are in `components/*.jsx`, composed in `index.html`.
- `ui_kits/marketing/` — the marketing site (glass nav, hero, feature blocks, quote, pricing, CTA, footer).

**Iconography:** Lucide via CDN (`https://unpkg.com/lucide@latest/dist/umd/lucide.js`). 1.5px stroke, round caps, monochrome. No emoji anywhere. No unicode glyphs as icons.

**Tone:** Quiet, declarative, second-person. Sentence case. No exclamation marks. No filler ("simply", "just", "powerful"). Verbs over nouns. AI is named, never decorated with sparkles in copy.

**Color usage:** Near-monochrome — warm white (#F7F7F5) canvas, deep charcoal (#111) text, one purple accent (#0FB8B4) reserved for active states and key moments. Semantic colors are desaturated. A typical screen uses three colors total.

**Depth & motion:** Ambient, blue-shifted shadows. Large radii (nothing under 8px). Easing is `cubic-bezier(0.32, 0.72, 0, 1)` — no bounces, no overshoots. Durations: 140/180/260/420/560ms.

**If creating visual artifacts** (slides, mocks, throwaway prototypes, decks):
1. Copy `colors_and_type.css` into the new file's directory and `@import` it.
2. Copy any logos you need from `assets/` into the new directory.
3. Reuse components from `ui_kits/*/components/` as `<script type="text/babel" src>` imports.
4. Output static HTML the user can open and view.

**If working on production code**, read this README as a spec and translate the tokens into your CSS framework / design tokens system. The `:root` block in `colors_and_type.css` is the canonical list.

**If invoked without guidance:** Ask the user what they want to build (mock? slide? component? real app?), confirm the surface (product vs marketing), ask 2–3 clarifying questions about content, then produce the artifact.
