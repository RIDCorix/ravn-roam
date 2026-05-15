/**
 * Fastmove (世界移動) SupplierAdapter — Phase 2 implementation.
 *
 * Wired endpoints:
 *   - POST /Api/QuoteMg/myQueryAll  (myQueryAllQuotes) for `listPlans`/`getPlan`
 *
 * Per ROA-86: the spec recommends a WEEKLY cadence on `myQueryAll`. Aggressive
 * polling can get the merchant's IP blocked. `getPlan` therefore reuses the
 * same single fetch (Fastmove has no per-plan endpoint) — callers that need
 * many lookups should cache the result, not call this back-to-back.
 *
 * Ordering surface (`createOrder` / `cancelOrder` / `getOrderStatus`) is
 * deliberately left undefined here — Phase 4 work, callback-driven, has its
 * own design constraints (idempotent handler, MUST reply "1", §2.2 callback).
 */

import { signEncStr } from "../../clients/fastmove/signer.js";
import type {
  QuoteMgMyQueryAllRequest,
  QuoteMgMyQueryAllResponse,
} from "../../clients/fastmove/types.js";
import type { RawPlan, SupplierAdapter } from "../adapter.js";
import { mapFastmoveQuoteToRawPlan } from "./mapping.js";

export const FASTMOVE_CODE = "fastmove";

export interface FastmoveAdapterConfig {
  baseUrl: string;
  merchantId: string;
  deptId: string;
  merchantKey: string;
  /** Injected for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Thrown on 429 — recoverable via backoff but the caller should slow down. */
export class FastmoveRateLimitError extends Error {
  override readonly name = "FastmoveRateLimitError";
  constructor(message = "Fastmove rate limit (HTTP 429)") {
    super(message);
  }
}

/** Thrown on any non-2xx / non-429 — caller decides retry vs. surface. */
export class FastmoveUpstreamError extends Error {
  override readonly name = "FastmoveUpstreamError";
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class FastmoveAdapter implements SupplierAdapter {
  readonly code = FASTMOVE_CODE;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: FastmoveAdapterConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async *listPlans(): AsyncIterable<RawPlan> {
    const response = await this.queryAll();
    for (const item of response.quoteList) {
      yield mapFastmoveQuoteToRawPlan(item);
    }
  }

  async getPlan(externalId: string): Promise<RawPlan | null> {
    const response = await this.queryAll();
    const hit = response.quoteList.find((q) => q.wmproductId === externalId);
    return hit ? mapFastmoveQuoteToRawPlan(hit) : null;
  }

  /**
   * Single-shot call to `myQueryAll`.
   *
   * Per spec v2.0.3 §1: body is {merchantId, encStr} — NOT the generic
   * three-field envelope. encStr signs only `merchantId + token`; including
   * deptId in either the body or the encStr plaintext makes the server
   * return a generic 500 (Fastmove uses 500, not 401, for auth failures).
   *
   * deptId is still pulled out of config because future endpoints need it;
   * the Phase 1 implementation incorrectly assumed every endpoint did.
   */
  private async queryAll(): Promise<QuoteMgMyQueryAllResponse> {
    const { baseUrl, merchantId, merchantKey } = this.config;
    const encStr = signEncStr(merchantId, merchantKey);
    const body: QuoteMgMyQueryAllRequest = { merchantId, encStr };
    const url = `${baseUrl.replace(/\/+$/, "")}/Api/QuoteMg/myQueryAll`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new FastmoveUpstreamError(
        `Fastmove network error: ${(err as Error).message}`,
        0,
      );
    }

    if (res.status === 429) {
      throw new FastmoveRateLimitError();
    }
    if (res.status >= 500) {
      throw new FastmoveUpstreamError(
        `Fastmove ${res.status} from ${url}`,
        res.status,
      );
    }
    if (!res.ok) {
      throw new FastmoveUpstreamError(
        `Fastmove non-OK ${res.status} from ${url}`,
        res.status,
      );
    }

    const json = (await res.json()) as QuoteMgMyQueryAllResponse;
    if (!Array.isArray(json.quoteList)) {
      throw new FastmoveUpstreamError(
        "Fastmove response missing `quoteList`",
        res.status,
      );
    }
    return json;
  }
}
