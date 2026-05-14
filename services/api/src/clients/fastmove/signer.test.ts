import { describe, expect, test } from "vitest";

import { signEncStr } from "./signer.js";

describe("signEncStr — Fastmove encStr (SHA-1 suffix)", () => {
  // Golden vector: NIST FIPS 180-2 sample.
  //   SHA-1("abc") = "a9993e364706816aba3e25717850c26c9cd0d89d"
  // Split "abc" as plaintext="ab", token="c" so the function under test is
  // exercised end-to-end (concat + sha1 + hex), not just the hash primitive.
  test("matches the NIST SHA-1('abc') golden vector when split ab + c", () => {
    expect(signEncStr("ab", "c")).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });

  test("matches the empty-string vector", () => {
    // SHA-1("") = "da39a3ee5e6b4b0d3255bfef95601890afd80709"
    expect(signEncStr("", "")).toBe(
      "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    );
  });

  test("is deterministic and order-sensitive", () => {
    const a = signEncStr("foo", "bar");
    const b = signEncStr("foo", "bar");
    const c = signEncStr("bar", "foo");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
