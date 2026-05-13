# Roam — eSIM landing page

Roam is the brand identity for Ravn's new eSIM product (ROA-13). This repo
holds the marketing site built on a modern frontend stack.

## Stack

- **Next.js 16** (App Router, Turbopack, static export-ready)
- **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** with CSS-variable design tokens
- **ESLint 9** + Next core-web-vitals + TypeScript rules
- **pnpm** package manager

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

## Project layout

```
src/
  app/
    layout.tsx        # html shell, metadata, fonts
    page.tsx          # composes the landing-page sections
    globals.css       # design tokens + tailwind import
  components/
    site-nav.tsx      # sticky header
    hero.tsx          # hero with animated globe visual
    how-it-works.tsx  # 3-step onboarding
    features.tsx      # 6-up feature grid
    coverage.tsx      # destination teasers
    pricing.tsx       # 3-tier plans
    testimonials.tsx  # quotes
    faq.tsx           # native <details> accordion
    cta-banner.tsx    # closing call-to-action
    site-footer.tsx   # footer
public/
  favicon.svg
```

## Design tokens

Tokens live in `src/app/globals.css` as CSS custom properties and are exposed
to Tailwind via `@theme inline`. Light and dark schemes share the same token
names — only the values flip — so components stay scheme-agnostic.

Core tokens: `background`, `foreground`, `surface`, `surface-muted`, `border`,
`border-strong`, `muted`, `subtle`, `brand`, `brand-strong`, `accent`,
`accent-strong`.
