# Architecture

## App Boundaries

`apps/web` owns the consumer storefront, authenticated travel product, admin
UI, and local BFF-style route handlers.

Public routes include:

- Home / storefront discovery.
- Region and activity introduction pages.
- Public shop and plan discovery.

Authenticated routes include:

- Trips, trip detail, checklist/tasks, and Lumi planning context.
- Profile/me, eSIM wallet-style surfaces, and account state.
- Admin routes.

Public pages should not show account-only affordances such as traveler badges
or notification bells. They may show public navigation, language selection,
login entry points, and shop CTAs.

## API Flow

Browser code calls local Next route handlers under `apps/web/src/app/api`.
Those handlers proxy to `services/api` through `apps/web/src/lib/api-proxy.ts`
and `apps/web/src/lib/server-api-base.ts`, keeping `ROAM_API_URL` server-only.

Server components may read from `services/api` directly with
`serverApiBase()` when they need SSR data. Supabase auth helpers come from
`@roam/shared`.

## Data Ownership

- Catalog and pricing rules belong in `packages/catalog` when shared across
  web, admin, and API.
- Supplier protocol code belongs in `services/api`.
- Storefront view models belong in `apps/web/src/lib/storefront-*`.
- Mock/demo fixtures should stay under `apps/web/src/lib/mock` and should not
  be imported into production request context unless the file name or call site
  makes that fallback explicit.

## i18n

`zh-TW` is the default product locale. User-visible strings in `apps/web`
should be present in both `apps/web/src/i18n/dictionaries/zh-TW.json` and
`apps/web/src/i18n/dictionaries/en.json`.
