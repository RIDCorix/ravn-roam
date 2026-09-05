// Central error reporting for the HTTP surface.
//
// Before this existed, an unhandled route error reached Hono's default
// handler: the client got a bare `Internal Server Error` string and the
// runtime log got an unlabelled stack trace with no method, no path, and
// no Postgres error code. On Railway that made a total data-layer outage
// indistinguishable from an application bug — see docs/RUNBOOK-storefront.md.
//
// Everything here is deliberately dependency-free so it can be unit-tested
// without a server or a database.

import { randomUUID } from "node:crypto";

import type { Context, ErrorHandler } from "hono";

/** Postgres / driver failure codes we can turn into an actionable sentence. */
const ERROR_HINTS: Record<string, string> = {
  // Postgres SQLSTATEs
  "42P01": "relation does not exist — the roam_poc migrations are probably not applied to this database",
  "3F000": "schema does not exist — the roam_poc schema was never provisioned on this database",
  "42501": "permission denied — the connection role cannot read this relation",
  "28P01": "password authentication failed — DATABASE_URL credentials are stale",
  "28000": "invalid authorization — DATABASE_URL credentials or role are wrong",
  "3D000": "database does not exist — DATABASE_URL points at the wrong database",
  "53300": "too many connections — the database refused a new connection",
  // Node socket errors
  ECONNREFUSED: "connection refused — the database host is unreachable from this service",
  ENOTFOUND: "DNS lookup failed — the DATABASE_URL host is wrong or not resolvable",
  ETIMEDOUT: "connection timed out — check network egress to the database",
  CONNECT_TIMEOUT: "connection timed out — check network egress to the database",
}

/**
 * Some failures cannot be told apart by code alone. Supabase's Supavisor
 * pooler rejects an unknown project with the generic SQLSTATE `XX000`, so
 * the message is the only thing that identifies it — and it was the actual
 * signature of the 2026-09-05 outage.
 */
const MESSAGE_HINTS: Array<[RegExp, string]> = [
  [
    /tenant(\s+or\s+user|\/user)?\s+.*not found/i,
    "the connection pooler does not recognise this tenant — the Supabase project in DATABASE_URL no longer exists (deleted or paused), or the project ref is wrong",
  ],
]

/** Shape a thrown value into the fields worth putting in a log line. */
export interface ErrorDescription {
  name: string;
  message: string;
  /** Postgres SQLSTATE or Node syscall code, when the driver supplied one. */
  code?: string;
  /** Plain-language reading of the failure, when we recognise it. */
  hint?: string;
}

export function describeError(err: unknown): ErrorDescription {
  if (!(err instanceof Error)) {
    return { name: "NonError", message: String(err) };
  }
  // `postgres` (postgres-js) puts the SQLSTATE on `.code`; Node socket
  // errors put the syscall code in the same place.
  const raw = (err as Error & { code?: unknown }).code;
  const code = typeof raw === "string" && raw !== "" ? raw : undefined;
  const hint =
    (code ? ERROR_HINTS[code] : undefined) ??
    MESSAGE_HINTS.find(([pattern]) => pattern.test(err.message))?.[1];
  return {
    name: err.name,
    message: err.message,
    ...(code ? { code } : {}),
    ...(hint ? { hint } : {}),
  };
}

/**
 * Build the Hono error handler.
 *
 * Logging is injectable so tests can assert on the emitted record instead
 * of scraping stderr.
 */
export function createErrorHandler(
  log: (line: string) => void = (line) => console.error(line),
): ErrorHandler {
  return (err: Error, c: Context) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const described = describeError(err);
    // One line, one JSON object — greppable in the Railway log viewer.
    log(
      JSON.stringify({
        level: "error",
        msg: "unhandled_request_error",
        request_id: requestId,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        ...described,
        stack: err.stack,
      }),
    );
    // The storefront routes are unauthenticated, so the response carries a
    // correlation id and nothing else — the diagnosis stays in the logs.
    return c.json(
      { error: { message: "Internal Server Error", request_id: requestId } },
      500,
    );
  };
}
