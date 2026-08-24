#!/usr/bin/env bash
# Behavioural gate — drive the routes of the build that was actually produced.
#
# typecheck and unit tests say the code is well-formed. Neither says the page comes up.
# Booting the production build and asking for each route does.
#
# Routes marked needs_api are skipped unless ROAM_API_URL answers, and the skip is
# PRINTED — a silent skip reads exactly like a pass.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
# shellcheck source=env.build
. "$ROOT/scripts/oracle/env.build"
# shellcheck source=serve.sh
. "$ROOT/scripts/oracle/serve.sh"

ROUTES="$ROOT/scripts/oracle/routes.json"
API_UP=0
if [ -n "${ROAM_API_URL:-}" ] && curl -fsS -m 3 -o /dev/null "${ROAM_API_URL}/health" 2>/dev/null; then API_UP=1; fi
[ "$API_UP" = 1 ] && echo "  API reachable at ${ROAM_API_URL} — API-backed routes included" \
                  || echo "  API not reachable — API-backed routes will be skipped and reported"

check_routes() {
  local failed=0
  for app in landing web; do
    local base; base=$([ "$app" = landing ] && echo "$LANDING_URL" || echo "$WEB_URL")
    while IFS=$'\t' read -r path needs_api; do
      [ -n "$path" ] || continue
      if [ "$needs_api" = "true" ] && [ "$API_UP" = 0 ]; then
        echo "  [$app] SKIP $path (needs API; set ROAM_API_URL to include it)"; continue
      fi
      local body code
      body=$(curl -sS -m 20 -w '\n%{http_code}' "$base$path" 2>/dev/null)
      code="${body##*$'\n'}"; body="${body%$'\n'*}"
      if [ "$code" != "200" ]; then
        echo "  [$app] FAIL $path -> HTTP $code"; failed=1; continue
      fi
      if printf '%s' "$body" | grep -qiE 'application error: a (server|client)-side exception|__next_error__|Internal Server Error'; then
        echo "  [$app] FAIL $path -> 200 but rendered an error shell"; failed=1; continue
      fi
      if [ "${#body}" -lt 1000 ]; then
        echo "  [$app] FAIL $path -> 200 but only ${#body} bytes (empty shell)"; failed=1; continue
      fi
      echo "  [$app] ok   $path (${#body} bytes)"
    done < <(python3 -c "
import json
for r in json.load(open('$ROUTES')).get('$app', []):
    print(r['path'] + '\t' + str(r.get('needs_api', False)).lower())
")
  done
  return "$failed"
}

with_apps check_routes
