#!/usr/bin/env bash
# Boot the production builds, run a command against them, always tear them down.
#
# Both the route smoke and the visual gate need the built apps running, and both would
# otherwise grow their own copy of the start/stop logic. They had exactly one bug worth
# preventing twice: `pnpm start` spawns a next-server child that survives killing the
# pnpm pid, keeps the port, and makes the NEXT run measure a stale build and pass. Own
# the port, not the pid — in one place.
#
#   with_apps <command...>     LANDING_URL / WEB_URL are exported to the command
LANDING_PORT="${LANDING_PORT:-3100}"
WEB_PORT="${WEB_PORT:-3101}"

_free_port() {
  local port="$1" pids
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null) || true
  [ -n "$pids" ] || return 0
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null) || true
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
  sleep 1
}

# Sets BOOT_PID rather than echoing it. Command substitution waits for stdout to
# close, and a backgrounded subshell inherits that pipe and never closes it — so
# `pid=$(_boot ...)` hangs forever no matter where the inner redirects point.
BOOT_PID=""
_boot() {
  local app="$1" port="$2" dir="$ROOT/apps/$1"
  BOOT_PID=""
  [ -d "$dir" ] || return 0
  _free_port "$port"
  if lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  [$app] port $port is held by something we could not stop" >&2; return 1
  fi
  (cd "$dir" && PORT="$port" pnpm start) >"/tmp/oracle-$app.log" 2>&1 </dev/null &
  local pid=$! i
  for i in $(seq 1 45); do
    curl -fsS -m 2 -o /dev/null "http://localhost:$port/" 2>/dev/null && { BOOT_PID="$pid"; return 0; }
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  echo "  [$app] failed to boot:" >&2; tail -20 "/tmp/oracle-$app.log" | sed 's/^/      /' >&2
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; _free_port "$port"
  return 1
}

with_apps() {
  local lpid wpid rc=0
  _boot landing "$LANDING_PORT" || return 1; lpid="$BOOT_PID"
  _boot web     "$WEB_PORT"     || { kill "$lpid" 2>/dev/null; _free_port "$LANDING_PORT"; return 1; }
  wpid="$BOOT_PID"

  export LANDING_URL="http://localhost:$LANDING_PORT" WEB_URL="http://localhost:$WEB_PORT"
  "$@" || rc=$?

  kill "$wpid" "$lpid" 2>/dev/null; wait "$wpid" "$lpid" 2>/dev/null
  _free_port "$WEB_PORT"; _free_port "$LANDING_PORT"
  return "$rc"
}
