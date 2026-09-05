#!/usr/bin/env bash
# Gesture gate — drive the R-301 sheet with real touch input against the built app.
#
# This gate exists because two UAT rounds could not close c-7. Not because the
# gesture was broken, but because nothing anyone could run said anything about it:
# the acceptance suite drove a desktop mouse, which never produces a `touch`
# pointer type and never exercises the path a phone takes. So "does the sheet
# follow the finger" was, in practice, unanswerable — and an unanswerable gate
# gets deferred to a human who does not have the hardware either.
#
# What runs here is answerable. `Input.dispatchTouchEvent` over CDP on a 390px
# `hasTouch` profile, with the press jump and the takeover measured inside the
# page's own pointerdown listener so no CDP round trip can hide a seam.
#
# Unlike the visual gate this is platform-independent — no screenshots, no font
# rasterisation — so it runs on ubuntu-latest exactly as it does on macOS. The
# per-frame 60fps assertions inside the spec self-gate on a live cadence probe
# and report themselves as not-run on a headless runner, which cannot serve
# 60fps; everything else is asserted everywhere. For the frame-cadence run on a
# real display: pnpm --filter @roam/web e2e:touch:60fps
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
# shellcheck source=env.build
. "$ROOT/scripts/oracle/env.build"
# shellcheck source=serve.sh
. "$ROOT/scripts/oracle/serve.sh"

run_playwright() {
  (cd "$ROOT/apps/web" && ROAM_WEB_URL="$WEB_URL" \
    pnpm exec playwright test --project=mobile-touch)
}

with_apps run_playwright
