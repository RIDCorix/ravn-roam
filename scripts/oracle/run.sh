#!/usr/bin/env bash
# Roam oracle — one command, one verdict.
#
#   ./scripts/oracle/run.sh              every gate; exit 0 means shippable
#   ./scripts/oracle/run.sh --fast       verify only (inner loop)
#   ./scripts/oracle/run.sh --only smoke a single gate
#   ./scripts/oracle/run.sh --json       machine-readable verdict on stdout
#
# `pnpm verify:ci` already covers clean/typecheck/lint/test/agent-audit and this does
# NOT reimplement any of it — it calls it. What it adds is the two layers nothing in
# the repo had: proving the thing BUILDS from clean, and proving the built app actually
# boots and serves its routes. A typecheck says the code is well-formed. Neither it nor
# a unit test says the page renders.
#
# Exit 0 = shippable. Anything else names the gate and why. Nothing here asks a human
# to look at something.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"
# shellcheck source=env.build
. "$ROOT/scripts/oracle/env.build"

FAST=0; ONLY=""; JSON=0
while [ $# -gt 0 ]; do
  case "$1" in
    --fast) FAST=1 ;;
    --json) JSON=1 ;;
    --only) ONLY="${2:-}"; shift ;;
    -h|--help) sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 64 ;;
  esac
  shift
done

RESULTS=(); FAILED=0
LOGDIR="${ORACLE_LOGDIR:-$(mktemp -d)}"; mkdir -p "$LOGDIR"
say() { [ "$JSON" = 1 ] || printf '%s\n' "$*"; }

run_gate() {
  local name="$1" desc="$2"; shift 2
  if [ -n "$ONLY" ] && [ "$ONLY" != "$name" ]; then return 0; fi
  local log="$LOGDIR/$name.log" start=$SECONDS
  say "── $name: $desc"
  if "$@" >"$log" 2>&1; then
    local d=$((SECONDS-start))
    say "   PASS (${d}s)"
    RESULTS+=("{\"gate\":\"$name\",\"status\":\"pass\",\"seconds\":$d}")
  else
    local code=$? d=$((SECONDS-start))
    FAILED=1
    say "   FAIL (${d}s)  — full log: $log"
    [ "$JSON" = 1 ] || tail -25 "$log" | sed 's/^/     /'
    local ev; ev=$(tail -25 "$log" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')
    RESULTS+=("{\"gate\":\"$name\",\"status\":\"fail\",\"seconds\":$d,\"exit\":$code,\"log\":\"$log\",\"evidence\":$ev}")
  fi
}

gate_install() { pnpm install --frozen-lockfile; }
gate_verify()  { pnpm verify:ci; }
gate_build()   { pnpm -r --if-present build; }
gate_smoke()   { bash "$ROOT/scripts/oracle/smoke.sh"; }
gate_visual()  { bash "$ROOT/scripts/oracle/visual.sh"; }

run_gate install "dependencies match the lockfile"      gate_install
run_gate verify  "pnpm verify:ci (typecheck/lint/test/audit)" gate_verify
if [ "$FAST" = 0 ]; then
  run_gate build "every package builds from clean"      gate_build
  run_gate smoke  "the built app boots and serves its routes" gate_smoke
  run_gate visual "every route matches its committed baseline"  gate_visual
fi

VERDICT=$([ "$FAILED" = 0 ] && echo shippable || echo blocked)
if [ "$JSON" = 1 ]; then
  printf '{"verdict":"%s","gates":[%s]}\n' "$VERDICT" "$(IFS=,; echo "${RESULTS[*]}")"
else
  say ""
  say "VERDICT: $VERDICT"
fi
[ "$FAILED" = 0 ]
