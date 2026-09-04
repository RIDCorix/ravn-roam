# R-301 delivery notes

The planning surface lives at `/[lang]/dev/trip-planner`. It is a fixture
route, and c-1 is the reason: the fixture composes the real storefront
bottom navigation (`StorefrontShell`) with the planner, so "the sheet does
not overlap the navigation" is a claim about a navigation that is actually
on screen.

## Where the work is

| Piece | File |
| --- | --- |
| Geometry, detents, gesture math, stay segments, field mapping | `apps/web/src/components/storefront/trips/planner/planner-model.ts` |
| Sheet, map, timeline, overview, CTAs | `.../planner/planner-workspace.tsx` |
| Map (Leaflet on OSM, unchanged provider) | `.../planner/planner-map.tsx` |
| Type-specific full view | `.../planner/planner-full-view.tsx` |
| Labels (zh-TW + en) | `storefront.trips.planner` in both dictionaries |
| Layout, materials, accessibility modes | `apps/web/src/app/globals.css`, `.planner*` block |
| Fixture trip | `apps/web/src/app/[lang]/dev/trip-planner/fixture-trip.ts` |

## The numbers D-1 argues about

The denominator is the planning space: the viewport minus the planner's own
top chrome minus the space the bottom navigation reserves. It is CSS-first,
so the first paint is already correct and JavaScript only takes over while a
finger is on the grabber:

```
--planner-planning-space: 100dvh - var(--planner-top-chrome) - var(--planner-nav-reserve)
sheet  = planning space x detent fraction   (map 0.24, plan 0.62, full 0.94)
map    = planning space - sheet
```

At 390x844 that is 660px of planning space, a 409px sheet and a 251px map —
a 38% map share, inside the 35-41% band, with the sheet's bottom edge 2px
clear of the navigation.

## Criteria and their checkers

| # | Checker |
| --- | --- |
| c-1 | `e2e/trip-planner.spec.ts` baselines at 390/1280/1440/1720, plus overflow, single-visible-nav and clipped-control assertions. Map tiles are masked; the composition is ours, the tiles are a third party's. |
| c-2 | Measured from real bounding boxes (nav top minus chrome bottom); day/item/detent asserted across opening and leaving the full view. |
| c-3 | `planner-model.test.ts` for the stay-segment and field-mapping contracts, e2e for what the sheet and the full view actually render. |
| c-4 | Reduced motion via `emulateMedia`, reduced transparency via a CDP `Emulation.setEmulatedMedia` feature (Playwright has no option for it), higher contrast via `emulateMedia({ contrast: "more" })`. The full-motion case is asserted too, so the reduced-motion assertion means something. |
| c-5 | Rendered checks in both locales at 390 and 1280: no box intersections, nothing truncated, and identical chrome height across locales. |
| c-6 | Both CTAs are clicked and land on `/[lang]/shop/japan/plans?days=8`, with the region page rendered and the trip-length control reading 8. |
| c-7 | `e2e/trip-planner-touch.spec.ts`, run by the `gesture` oracle gate. Real touch input on a 390px `hasTouch` profile; the press jump, the takeover and each reversal are measured inside the page's own `pointerdown` listener. The 60fps per-frame assertions self-gate on a cadence probe — see below. |
| c-8 | All four item types edited, saved, closed and reopened. |

## Two things a reviewer should know

**The shop routes were restored.** `buildShopHref` has always pointed at
`/[lang]/shop/<region>/plans`, but that route was deleted from this branch by
`4015d20`. c-6 cannot be honest against a 404, so the three shop pages are
restored from `4015d20^` unchanged, with the same Supabase-optional guard the
storefront layout already needed for anonymous browsing. The purchase flow
itself is untouched.

**Editing is in-memory.** The fixture has no backend, so a saved item survives
closing and reopening the editor, day switching and detent changes, but not a
page reload. Wiring the planner to the trips API is the follow-up, and it is
where the existing autosave behaviour belongs.

## Running it

```bash
pnpm --filter @roam/web test          # unit
pnpm --filter @roam/web dev           # then, in another shell:
pnpm --filter @roam/web exec playwright test e2e/trip-planner.spec.ts
```

Baselines are macOS baselines (`-darwin` suffix). A Linux CI run needs its own.

## Reaching it for UAT (added after the first UAT round)

The first UAT round could not run a single gesture check, and the reason was
not the gestures. Two things were in the way, and both are fixed here.

**1. The route could not survive a production build.** `StorefrontShell`
reads `useSearchParams()` to carry the query string across navigation. The
storefront routes never trip the static-generation bailout because Supabase
makes them dynamic; this fixture has no backend, so Next tried to prerender
it and `next build` failed outright on `/en/dev/trip-planner`. That failure
was invisible for as long as the page called `notFound()` in production —
the build never got far enough to render it. The route is now
`export const dynamic = "force-dynamic"`, which is also what UAT wants:
complete server-rendered HTML with the navigation already in it, rather than
a Suspense fallback swapping out under the sheet mid-gesture.

**2. The route deliberately 404'd in production.** Every other `/dev`
fixture still does, and should. This one is the exception, because its
remaining criteria — first frame on press, 1:1 tracking, mid-drag reversal,
release velocity — can only be judged by a human on a real phone against the
deployed build. A surface that 404s cannot be pressed; c-7 was not failing,
it was unobservable.

The access decision is in `apps/web/src/app/[lang]/dev/uat-fixture-access.ts`:

- The trip is built in memory by `fixture-trip.ts`. The page reads no
  backend, writes nothing, and no credential reaches it.
- Nothing in the product links to it, and there is no sitemap entry.
- It is served `noindex, nofollow, nocache`, so search cannot surface it.
- `ROAM_DISABLE_UAT_FIXTURES=1` in the deployment environment takes it back
  down after sign-off, with no code change. Verified: with the flag set, the
  route 404s and `/zh-TW/shop` still serves 200.

**The UAT URL is an app URL, not a dashboard URL.** `roam-system` is the
Vercel project whose root directory is `apps/web` (`.ravn/project.yaml`), and
it is public — `/zh-TW`, `/zh-TW/shop` and `/zh-TW/trips` all served 200
during this round while `/zh-TW/dev/trip-planner` was the only 404. Once this
commit deploys, the surface to hand the UAT operator is:

```
https://<roam-system-deployment>.vercel.app/zh-TW/dev/trip-planner
```

`roam-web` is a different project rooted at `apps/landing` and has
Deployment Protection on; it never had this route and is not the UAT target.

## Running the acceptance suite the way UAT sees it

```
pnpm --filter @roam/web e2e        # next dev — all fixtures, 27 checks
pnpm --filter @roam/web e2e:prod   # next build + next start — planner only, 22 checks
```

`e2e:prod` exists because the whole first UAT round was lost to a difference
between the two. The other `/dev` fixtures 404 in production by design, so
only the planner spec runs there. `c-0` asserts the surface is reachable,
`noindex`, and server-renders its navigation in whichever build is under
test.

## A defect found in production mode, not fixed here

The bottom navigation's "tasks" tab points at `/{lang}/tasks`, and no such
route exists — in any commit, including this branch's base `cda9665`. It is
invisible in `next dev`, which does not prefetch, and produces a console
resource 404 in production, where Next prefetches every nav link. A signed-in
user who taps that tab on a real phone gets a 404 page.

It is pre-existing and shared across every signed-in surface, and removing a
tab would change the navigation this ticket was told to compose against and
invalidate all four visual baselines, so it is reported rather than fixed.
`c-1` names it explicitly: the check now records failing request *URLs* and
allows only this one, so a genuine planner 404 still fails — by name.


## c-7 stopped being a human-only gate (added after the second UAT round)

Two UAT rounds returned this ticket with c-7's three items unchanged, and
neither round found a defect. Both times the report said the same thing: no
physical handset was reachable, so there was no way to run the test. The
second round did drive the deployed page with a desktop mouse and observed
everything the criteria ask for — and was right to refuse to count it.

The mouse was the actual problem, and it was ours, not UAT's. `page.mouse`
never produces a `touch` pointer type, is not subject to `touch-action`, and
never makes Chromium weigh scrolling the page against handing the events to
the grabber. The acceptance suite had **no coverage of the touch path at all**
— the only path a phone takes. c-7 was not failing; it was unaskable, and an
unaskable gate gets deferred to a human who turns out not to have the
hardware either.

`e2e/trip-planner-touch.spec.ts` makes it askable. It runs in a `mobile-touch`
Playwright project (390x844, `hasTouch`, `isMobile`, DPR 3) and dispatches
genuine `Input.dispatchTouchEvent` sequences over CDP.

### What it measures, and why it is measured that way

Three things were wrong with the obvious implementation, and all three were
found by writing it and watching it fail — twice locally and once on the CI
runner:

**A CDP round trip is slower than the thing under test.** Reading the sheet
from the test process after dispatching an event costs tens of milliseconds;
"the sheet did not jump on press" is a single-frame property. The first draft
reported a 210px seam on takeover that was only the transition continuing
during the round trip. So the press height, the takeover height and the
pointer type are all recorded by a listener installed on the handle itself,
which runs before React's delegated handler and sees the sheet exactly as the
finger found it. Nothing that could race the browser is measured across the
wire.

The same round trip made c-7b's grab unaimable: the handle rides the top of
the sheet, which climbs 211px toward `full` at up to 1.6px/ms, so a grab point
is stale before the touch using it is dispatched. That version passed on macOS
and missed the 28px grabber on every attempt on ubuntu. It now stops the
animation clock over CDP and grabs the transition where it stands — still
unfinished, still reported as running, just holding still long enough to be
aimed at. Freezing removes the race instead of retrying through it.

**Headless Chromium cannot serve 60fps.** Measured on this machine: a median
`requestAnimationFrame` gap of 50-83ms headless, and
`--disable-frame-rate-limit`, `--disable-gpu-vsync` and swiftshader all make
it *worse* (~147ms). Headed on a real display serves a clean 16.7ms. An
earlier version gated the per-frame checks on a measured median gap — which
is not a promise about any individual gap. It passed a 126px step that was
several dropped frames' worth of ordinary motion and failed a legitimate one.

So no assertion here assumes a frame rate. The settle is checked two ways that
do not need one. First, against the CSS transition it hands off to: the test
reads the transition itself — property, duration, from-value, to-value — while
it runs. A transition is a contract the compositor honours at any frame rate,
so "did it teleport" is answerable without watching a single frame; a teleport
is the absence of that record. Second, per interval, against what that
transition's easing can cover in the time the interval actually took
(`frameBudget`). Each run annotates the cadence it saw, so a 60fps run is
legible as one without being required.

**rAF timestamps are not frame timestamps.** The recorder originally stamped
each sample with `performance.now()`. Two callbacks can run inside one frame —
the test's own next-frame read schedules one — which produced pairs 7ms apart
that looked like frame intervals and were not, collapsing any budget divided
by dt. Samples are now keyed by the frame time rAF is handed, and repeats
within a frame are dropped.

| Item | What is asserted |
| --- | --- |
| c-7a press ≤4px, tracking ±6px | press jump from the in-page listener; worst tracking error over a 200px up-and-back path sampled every 8px; pointer type is `touch`; `touch-action: none`; nav clearance on every sample |
| c-7b takeover and two reversals | the grab lands on a still-running animation, continuity ≤4px, the old animation is dropped, each reversal shows in the next painted frame, and no frame of the drag is animation-driven |
| c-7c four release cases | the settle is a 320ms `height` transition starting where the finger let go and ending exactly on a detent; a flick is honoured over proximity; no interval exceeds `frameBudget`; the settle starts on the release and never reverses; nav clearance on every recorded frame |

### Proof the gate can fail

A gate that cannot fail is not evidence. Four mutations were applied to the
product and the suite re-run:

| Mutation | Result |
| --- | --- |
| grab from the detent height instead of the live box | c-7b fails — "takeover must not seam" |
| 1.3x drag gain | c-7a fails — "sheet must track the finger within 6px"; fast-upward release also fails |
| remove the sheet's `height` transition (snap on release) | every c-7c case fails — "the release must hand off to a height transition" |
| remove `touch-action: none` from the grabber | **not caught** — see below |

The fourth is the honest one. `touch-action` is not load-bearing in today's
layout: the planner owns the viewport and there is no scrollable ancestor to
steal the gesture, so removing it changes nothing observable. Rather than
invent an assertion that pretends otherwise, c-7a asserts the declaration is
present and says why — the day the sheet lives inside something scrollable,
losing it silently hands every drag to the scroller, and no mouse test would
notice.

### Running it

```
./scripts/oracle/run.sh --only gesture      # against the production build
pnpm --filter @roam/web e2e:touch           # headless, cadence not measured
pnpm --filter @roam/web e2e:touch:60fps     # headed on a real display; cadence measured
```

The headed run is the one that produces the 60fps evidence. Recorded on this
machine: median frame gap 16.7ms over 22 settle frames for each of the four
release cases. Stability before this was called done: 10 consecutive clean
headless runs and 8 consecutive clean headed runs, after three separate
sources of flake were tracked down rather than retried away.

The `gesture` gate also runs in CI. Unlike the visual gate it is
platform-independent — it measures geometry and event ordering, not pixels —
so ubuntu-latest is as good a witness as macOS.

### What is still not covered

A physical handset. This closes the input-class gap (mouse → touch) and the
sampling gap (bounding boxes → frames). It does not reproduce digitiser noise,
iOS Safari's own gesture arbitration, or thermal frame drops. That residue is
real but it is a device-characterisation question, not an open question about
this implementation: every behaviour c-7 names is now asserted, and the
assertions demonstrably fail when the behaviour is broken.
