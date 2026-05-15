import { describe, expect, test, vi } from "vitest";

import type { QuoteMgMyQueryAllResponse } from "../../clients/fastmove/types.js";
import {
  FASTMOVE_CODE,
  FastmoveAdapter,
  FastmoveRateLimitError,
  FastmoveUpstreamError,
} from "./adapter.js";

const CONFIG = {
  baseUrl: "https://tfmshippingsys.fastmove.test/",
  merchantId: "M-TEST",
  deptId: "D-TEST",
  merchantKey: "K-TEST",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeOkResponse(): QuoteMgMyQueryAllResponse {
  return {
    resultCode: "0000",
    quoteList: [
      {
        wmproductId: "WM-JP-7D",
        productName: "Japan 7-day 3GB",
        productPrice: 390,
        flowMb: 3072,
        validDay: 7,
        countryCode: "jp",
        leSIM: true,
      },
      {
        wmproductId: "WM-ASIA-7D",
        productName: "Asia regional 7-day 5GB",
        productPrice: 590,
        flowMb: 5120,
        validDay: 7,
        countryList: ["jp", "kr", "tw"],
        leSIM: true,
      },
    ],
  };
}

describe("FastmoveAdapter", () => {
  test("exposes the registry code `fastmove`", () => {
    const adapter = new FastmoveAdapter({
      ...CONFIG,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(adapter.code).toBe(FASTMOVE_CODE);
    expect(adapter.code).toBe("fastmove");
  });

  test("listPlans yields mapped RawPlan rows on 200 OK", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () =>
      jsonResponse(fakeOkResponse()),
    );
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    const plans = [];
    for await (const plan of adapter.listPlans()) plans.push(plan);

    expect(plans).toHaveLength(2);
    expect(plans[0]?.externalId).toBe("WM-JP-7D");
    expect(plans[0]?.destinations).toEqual(["JP"]);
    expect(plans[1]?.destinations).toEqual(["JP", "KR", "TW"]);

    // Sanity: the call hits the expected endpoint with a signed envelope.
    const mock = vi.mocked(fetchImpl);
    expect(mock).toHaveBeenCalledTimes(1);
    const call = mock.mock.calls[0];
    expect(call).toBeDefined();
    const [calledUrl, init] = call!;
    expect(calledUrl).toBe(
      "https://tfmshippingsys.fastmove.test/Api/QuoteMg/myQueryAll",
    );
    const body = JSON.parse(String(init?.body));
    // Spec v2.0.3 §1: body is {merchantId, encStr}; deptId is NOT sent on
    // this endpoint (server returns 500 if it's present).
    expect(body).toEqual({
      merchantId: "M-TEST",
      encStr: expect.any(String),
    });
    expect(body.encStr).toHaveLength(40); // SHA-1 hex
  });

  test("getPlan returns the matching row, null when not found", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => jsonResponse(fakeOkResponse()));
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    const hit = await adapter.getPlan("WM-ASIA-7D");
    expect(hit?.externalId).toBe("WM-ASIA-7D");
    expect(hit?.destinations).toEqual(["JP", "KR", "TW"]);

    const miss = await adapter.getPlan("WM-DOES-NOT-EXIST");
    expect(miss).toBeNull();
  });

  test("HTTP 429 surfaces as FastmoveRateLimitError", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response("rate limit", { status: 429 }),
    );
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    await expect(async () => {
      for await (const _ of adapter.listPlans()) void _;
    }).rejects.toBeInstanceOf(FastmoveRateLimitError);
  });

  test("HTTP 5xx surfaces as FastmoveUpstreamError with status", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () => new Response("boom", { status: 503 }),
    );
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    try {
      for await (const _ of adapter.listPlans()) void _;
      throw new Error("expected listPlans to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FastmoveUpstreamError);
      expect((err as FastmoveUpstreamError).status).toBe(503);
    }
  });

  test("malformed body (no quoteList) surfaces as FastmoveUpstreamError", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () =>
      jsonResponse({ resultCode: "0000" }),
    );
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    await expect(async () => {
      for await (const _ of adapter.listPlans()) void _;
    }).rejects.toBeInstanceOf(FastmoveUpstreamError);
  });

  test("network failure surfaces as FastmoveUpstreamError(status=0)", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const adapter = new FastmoveAdapter({ ...CONFIG, fetchImpl });

    try {
      await adapter.getPlan("WM-X");
      throw new Error("expected getPlan to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FastmoveUpstreamError);
      expect((err as FastmoveUpstreamError).status).toBe(0);
    }
  });
});
