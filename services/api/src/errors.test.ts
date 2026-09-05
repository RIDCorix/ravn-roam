/**
 * The error handler is the only thing standing between a production 500 and
 * an un-diagnosable Railway log line, so both halves are pinned: what the
 * caller sees, and what the log record contains.
 */

import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { createErrorHandler, describeError } from "./errors.js";

function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("describeError", () => {
  test("keeps a plain Error intact and adds no code", () => {
    const described = describeError(new Error("boom"));
    expect(described).toEqual({ name: "Error", message: "boom" });
  });

  test("reads the driver SQLSTATE and explains it", () => {
    const described = describeError(
      pgError("42P01", 'relation "roam_poc.storefront_event" does not exist'),
    );
    expect(described.code).toBe("42P01");
    expect(described.hint).toContain("migrations");
  });

  test("explains socket-level failures too", () => {
    expect(describeError(pgError("ECONNREFUSED", "connect")).hint).toContain(
      "unreachable",
    );
  });

  /**
   * The real 2026-09-05 production signature. Supavisor answers with the
   * catch-all SQLSTATE XX000, so only the message identifies it.
   */
  test("recognises a Supabase pooler rejecting an unknown tenant", () => {
    const described = describeError(
      pgError("XX000", "(ENOTFOUND) tenant/user postgres.abcdefghijklmnop not found"),
    );
    expect(described.code).toBe("XX000");
    expect(described.hint).toContain("no longer exists");
  });

  test("also matches the 'tenant or user not found' phrasing", () => {
    expect(
      describeError(pgError("XX000", "Tenant or user not found")).hint,
    ).toContain("pooler");
  });

  test("passes an unrecognised code through without inventing a hint", () => {
    const described = describeError(pgError("XX999", "internal"));
    expect(described.code).toBe("XX999");
    expect(described.hint).toBeUndefined();
  });

  test("survives a thrown non-Error", () => {
    expect(describeError("nope")).toEqual({
      name: "NonError",
      message: "nope",
    });
  });
});

describe("createErrorHandler", () => {
  function appThatThrows(err: unknown) {
    const lines: string[] = [];
    const app = new Hono();
    app.onError(createErrorHandler((line) => lines.push(line)));
    app.get("/storefront/events", () => {
      throw err;
    });
    return { app, lines };
  }

  test("answers 500 with a correlation id instead of a bare string", async () => {
    const { app } = appThatThrows(new Error("boom"));
    const res = await app.request("/storefront/events");
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error: { message: string; request_id: string };
    };
    expect(body.error.message).toBe("Internal Server Error");
    expect(body.error.request_id).toMatch(/[0-9a-f-]{36}/);
  });

  test("never leaks the internal message to an unauthenticated caller", async () => {
    const { app } = appThatThrows(
      pgError("42P01", 'relation "roam_poc.product" does not exist'),
    );
    const res = await app.request("/storefront/events");
    expect(await res.text()).not.toContain("roam_poc");
  });

  test("logs one JSON line carrying method, path, SQLSTATE and hint", async () => {
    const { app, lines } = appThatThrows(
      pgError("42P01", 'relation "roam_poc.storefront_event" does not exist'),
    );
    await app.request("/storefront/events");
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(record.msg).toBe("unhandled_request_error");
    expect(record.method).toBe("GET");
    expect(record.path).toBe("/storefront/events");
    expect(record.code).toBe("42P01");
    expect(record.hint).toContain("migrations");
  });

  test("reuses an inbound x-request-id so the id spans the proxy hop", async () => {
    const { app, lines } = appThatThrows(new Error("boom"));
    const res = await app.request("/storefront/events", {
      headers: { "x-request-id": "trace-42" },
    });
    const body = (await res.json()) as { error: { request_id: string } };
    expect(body.error.request_id).toBe("trace-42");
    expect(JSON.parse(lines[0]!).request_id).toBe("trace-42");
  });
});
