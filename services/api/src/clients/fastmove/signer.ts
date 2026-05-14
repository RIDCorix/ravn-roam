import { createHash } from "node:crypto";

/**
 * Fastmove `encStr` signer.
 *
 * Per Fastmove API spec v2.0.3 (ROA-86):
 *   encStr = SHA-1(<concatenated request fields> + <merchant Token>)
 *
 * Note this is the "secret-suffix SHA-1" scheme, not standard HMAC-SHA1 —
 * ROA-91's description calls it "HMAC SHA-1 + merchant key", but the spec
 * itself is suffix-SHA-1. We implement what the spec says; Phase 4 should
 * confirm the field-concat ordering per endpoint when wiring real calls.
 *
 * Pure function. No I/O, no env reads. Caller owns concatenation order.
 */
export function signEncStr(plaintext: string, token: string): string {
  return createHash("sha1")
    .update(plaintext + token, "utf8")
    .digest("hex");
}
