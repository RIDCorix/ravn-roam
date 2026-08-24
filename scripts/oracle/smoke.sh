#!/usr/bin/env bash
# Behavioural gate — boot what was actually built and drive its routes.
#
# typecheck and unit tests say the code is well-formed. Neither says the page
# renders. This does: it starts the production build and asserts every route in
# routes.json returns 200 with real content and no Next.js error shell.
#
# Routes marked "needs_api" are skipped unless ROAM_API_URL is reachable, and the
# skip is reported — a silent skip reads like a pass.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
# shellcheck source=env.build
. "$ROOT/scripts/oracle/env.build"
ROUTES="$ROOT/scripts/oracle/routes.json"
FAILED=0

# `pnpm start` spawns next-server as a child; killing the pnpm pid orphans it and it
# keeps holding the port. The next run then measures a STALE BUILD and passes — the
# exact silent-pass this gate exists to prevent. Own the port, not the pid.
free_port() {
  local port="$1" pids
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null) || true
  [ -n "$pids" ] || return 0
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null) || true
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
  sleep 1
}

api_up() {
  [ -n "${ROAM_API_URL:-}" ] || return 1
  curl -fsS -m 3 -o /dev/null "${ROAM_API_URL}/health" 2>/dev/null
}
API_UP=1; api_up || API_UP=0

check_app() {
  local app="$1" port="$2"
  local dir="$ROOT/apps/$app"
  [ -d "$dir" ] || return 0

  free_port "$port"
  if lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  [$app] port $port is still held by something we could not stop"; FAILED=1; return 0
  fi

  echo "  [$app] starting on :$port"
  (cd "$dir" && PORT="$port" pnpm start >/tmp/smoke-$app.log 2>&1) &
  local pid=$!

  local up=0
  for _ in $(seq 1 45); do
    if curl -fsS -m 2 -o /dev/null "http://localhost:$port/" 2>/dev/null; then up=1; break; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if [ "$up" = 0 ]; then
    echo "  [$app] FAILED TO BOOT"; tail -20 /tmp/smoke-$app.log | sed 's/^/      /'
    kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; free_port "$port"; FAILED=1; return 0
  fi

  while IFS=$'\t' read -r path needs_api; do
    [ -n "$path" ] || continue
    if [ "$needs_api" = "true" ] && [ "$API_UP" = 0 ]; then
      echo "  [$app] SKIP $path (needs API; set ROAM_API_URL to include it)"
      continue
    fi
    local body code
    body=$(curl -sS -m 20 -w '\n%{http_code}' "http://localhost:$port$path" 2>/dev/null)
    code="${body##*$'\n'}"; body="${body%$'\n'*}"
    if [ "$code" != "200" ]; then
      echo "  [$app] FAIL $path -> HTTP $code"; FAILED=1; continue
    fi
    # A 200 that is really an error shell, or a page with no content, is a failure.
    if printf '%s' "$body" | grep -qiE 'application error: a (server|client)-side exception|__next_error__|Internal Server Error'; then
      echo "  [$app] FAIL $path -> 200 but rendered an error shell"; FAILED=1; continue
    fi
    if [ "${#body}" -lt 1000 ]; then
      echo "  [$app] FAIL $path -> 200 but only ${#body} bytes (empty shell)"; FAILED=1; continue
    fi
    echo "  [$app] ok   $path (${#body} bytes)"
  done < <(python3 -c "
import json,sys
for r in json.load(open('$ROUTES'))['$app']:
    print(r['path'] + '\t' + str(r.get('needs_api', False)).lower())
")

  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  free_port "$port"
}

[ "$API_UP" = 1 ] && echo "  API reachable at ${ROAM_API_URL} — API-backed routes included" \
                  || echo "  API not reachable — API-backed routes will be skipped and reported"

check_app landing 3100
check_app web     3101

exit "$FAILED"
