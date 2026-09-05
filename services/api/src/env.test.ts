/**
 * `deploymentSha()` exists because of a concrete production failure: the
 * 2026-09 storefront outage was diagnosed against a Railway deployment whose
 * `/healthz` reported `sha: null`, so nobody could tell which build was live.
 * The documented remedy — setting `GIT_SHA=${{RAILWAY_GIT_COMMIT_SHA}}` on the
 * service — was applied and made it *worse*: Railway renders deployment-scoped
 * git variables to an empty string inside a variable reference, so the
 * deployment then reported `sha: ""`. The container does carry the real
 * `RAILWAY_GIT_COMMIT_SHA`, so reading it directly is the fix.
 */

import { describe, expect, test } from "vitest";

import { deploymentSha } from "./env.js";

const SHA = "2c46c487d4b6aa30fa0b728a8c846cbece89cad3";

describe("deploymentSha", () => {
  test("prefers an explicitly configured GIT_SHA", () => {
    expect(
      deploymentSha({ GIT_SHA: SHA, RAILWAY_GIT_COMMIT_SHA: "other" }),
    ).toBe(SHA);
  });

  test("falls back to Railway's deploy-time commit when GIT_SHA is unset", () => {
    expect(deploymentSha({ RAILWAY_GIT_COMMIT_SHA: SHA })).toBe(SHA);
  });

  test("treats an unresolved variable reference (empty GIT_SHA) as unset", () => {
    // This is the exact production shape: GIT_SHA="" shadowing a good value.
    expect(deploymentSha({ GIT_SHA: "", RAILWAY_GIT_COMMIT_SHA: SHA })).toBe(
      SHA,
    );
  });

  test("treats whitespace as unset rather than reporting a blank sha", () => {
    expect(deploymentSha({ GIT_SHA: "   ", RAILWAY_GIT_COMMIT_SHA: "  " })).toBe(
      null,
    );
  });

  test("returns null — never an empty string — when nothing is available", () => {
    expect(deploymentSha({})).toBe(null);
  });
});
