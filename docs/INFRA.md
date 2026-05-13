# Infra setup

End-to-end checklist for getting the Roam marketing site running on
**Vercel** (web hosting + previews) and **Supabase** (shared Postgres).
Items marked _dashboard_ must be done by a human with the right account
access — they cannot be driven from this repo.

Railway is deferred — see [§4](#4--railway-deferred).

> Next.js 16 specifics referenced below come from the bundled docs in
> `node_modules/next/dist/docs/01-app/02-guides/`.

---

## 1. Vercel — hosting + preview deploys

Vercel ships a verified Next.js 16 adapter and auto-detects everything,
so **no `vercel.json` is needed** for the default deploy. Previews are on
by default for every branch and PR.

**Dashboard steps:**

1. In Vercel → _Add New Project_ → import the GitHub repo
   `RIDCorix/ravn-roam`.
2. Framework preset: Next.js (auto-detected). Root directory: `./`.
   Build command and output directory: leave as defaults.
3. _Settings → Git_: confirm "Production Branch" is `main` and "Preview
   Deployments" is enabled for all branches.
4. _Settings → Environment Variables_: add the entries listed in
   [§3 — Env vars](#3--env-vars). Use the **Preview** scope for staging
   values and **Production** for prod values.
5. Trigger a redeploy of `main` after env vars land.

**Custom domain (later):** _Settings → Domains_ → add `roam.example.com`
(or final domain) and follow the DNS instructions.

---

## 2. Supabase — shared Postgres

A single Supabase project hosts the shared database. Use **Supabase
Branching** to give the Vercel _Preview_ environment its own ephemeral
copy of the schema without spinning up a second project.

**Dashboard steps:**

1. Create a Supabase project (region close to Vercel's primary, e.g.
   `ap-southeast-1` for SG, `us-east-1` for NJ).
2. _Project Settings → API_: copy
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only).
3. _Database → Branching_: enable branching, then connect the GitHub
   repo. Supabase will spin up a preview branch DB per Vercel preview
   deploy and inject the matching env vars at deploy time.
4. _Auth → URL Configuration_: set the site URL to the Vercel production
   domain. Add the preview wildcard (`https://*-yourteam.vercel.app`) to
   _Additional Redirect URLs_.
5. _Database → Network Restrictions_: leave open during early dev; lock
   to Vercel egress CIDRs once stable.

**Client usage in this repo:**

- Browser components: `import { createSupabaseBrowserClient } from "@/lib/supabase/client"`.
- Server components / route handlers: `import { createSupabaseServerClient } from "@/lib/supabase/server"`.
- Admin / cron / webhook handlers: `createSupabaseAdminClient` (uses the
  service-role key — never call from a Client Component).

---

## 3. Env vars

| Variable                          | Where it runs        | Required | Notes                                                                |
| --------------------------------- | -------------------- | -------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Browser + server     | Yes      | Inlined into client bundle at build time.                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Browser + server     | Yes      | Safe to ship; scoped by Row Level Security.                          |
| `SUPABASE_SERVICE_ROLE_KEY`       | Server only          | Yes      | Bypasses RLS. **Never** prefix with `NEXT_PUBLIC_`.                  |
| `NEXT_PUBLIC_SITE_URL`            | Browser + server     | Yes      | Canonical origin per environment (used for OpenGraph + redirects).   |

A local template lives at `.env.example`. Copy to `.env.local` and fill
values; `.env.local` is gitignored.

> Next.js 16 reads `.env*` from the **project root only** — keep them
> next to `package.json`, not inside `/src`.

---

## 4. Railway — deferred

Skipped for now (ROA-13, 2026-05-13). The marketing site does not need
Railway; Vercel + Supabase cover hosting, previews, and the shared
database. When a backend service or worker appears that needs Railway,
revisit this section to add the deploy artifact (Dockerfile or
`railway.json`), env wiring, and any Supabase role rotation.

---

## 5. Health-check before going live

Before announcing the URL:

- [ ] Vercel production deploy is green on `main`.
- [ ] Preview deploy on a sample PR resolves with its own Supabase branch.
- [ ] All four env vars present in **both** Preview and Production
      scopes.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass locally and
      in Vercel.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the actual deployed origin (drives
      OpenGraph cards).
- [ ] Custom domain (if any) verified and HTTPS active.
