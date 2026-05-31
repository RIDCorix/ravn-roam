# Assets

## Goals

Storefront images should make regions and activities inspectable without
slowing down the app or leaving ambiguous generated/source duplicates.

## Rules

- Keep one canonical runtime asset per visual. Do not commit both
  `name.png` and `name-generated.png` when their bytes are identical.
- Prefer WebP or AVIF for large photographic/illustrative runtime images.
- Keep original source prompts or source files outside runtime folders unless
  the app directly needs them.
- Use descriptive, stable filenames based on region or event slugs.
- Keep icons transparent and tightly cropped; do not bake white backgrounds
  into event icons.
- Add width/height or stable aspect-ratio constraints in UI that renders fixed
  image formats.

## Current Runtime Folders

- Region/event images: `apps/web/public/illustrations/events/`
- Timeline backgrounds: `apps/web/public/illustrations/timeline/`
- Event icon set: `apps/web/public/illustrations/event-icons/`

## Recommended Sizes

| Asset type | Target |
| --- | --- |
| Event card image | 1200px wide max, WebP/AVIF when possible |
| Timeline background | 1800-2200px wide max, compressed WebP/AVIF |
| Icon cutout | 128-256px square PNG/WebP with transparency |
| Avatar | 512px square max unless the UI needs higher density |

Large PNGs over 1MB should be treated as review items before commit.
