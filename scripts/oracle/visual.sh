#!/usr/bin/env bash
# Visual gate — boot the build and compare every route against a committed baseline.
#
#   visual.sh            fail on any diff
#   visual.sh --accept   re-record the baselines (do this in the commit that changes
#                        the design, so the diff is visible in review)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
# shellcheck source=env.build
. "$ROOT/scripts/oracle/env.build"
# shellcheck source=serve.sh
. "$ROOT/scripts/oracle/serve.sh"

PW_ARGS=()
# =all, not the default "changed": "changed" leaves any baseline whose diff fits under
# the tolerance exactly as it was, so a re-record after a copy change silently kept the
# desktop and wide frames showing the OLD sentence while mobile got the new one.
[ "${1:-}" = "--accept" ] && PW_ARGS+=(--update-snapshots=all)

run_playwright() {
  # Run from apps/web because that is where @playwright/test is installed; the config
  # and the baselines live with the rest of the oracle.
  (cd "$ROOT/apps/web" && pnpm exec playwright test \
      -c "$ROOT/scripts/oracle/visual.config.ts" "${PW_ARGS[@]+"${PW_ARGS[@]}"}")
}

with_apps run_playwright
