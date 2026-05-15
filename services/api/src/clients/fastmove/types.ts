/**
 * Fastmove supplier — typed request / response shapes for the 12 endpoints
 * in API spec v2.0.3_20260224 (ROA-86 attachment).
 *
 * Coverage tier:
 *   - Field NAMES and OPTIONALITY follow the spec table in ROA-86 plus the
 *     callback / response columns of the v2.0.3 PDF.
 *   - Deep enum domains, batch limits, error-code mappings, and the full
 *     `quoteList` shape are intentionally deferred to Phase 4 (real impl).
 *   - Per agent-rules, no business logic lives here — these are pure shape.
 *
 * Auth envelope (carried in EVERY request, not modelled per-endpoint):
 *   merchantId, deptId, encStr   — encStr = SHA-1(field-concat + Token)
 *
 * Async callback contract (ROA-86 §"非同步全靠 callback + idempotent retry"):
 *   Supplier retries every 5s up to 3-4 times. Our handler MUST be idempotent
 *   and MUST return the literal string "1" to stop the retry loop.
 */

// ---------------------------------------------------------------------------
// Shared envelope
// ---------------------------------------------------------------------------

export interface FastmoveAuthEnvelope {
  merchantId: string;
  deptId: string;
  encStr: string;
}

export interface FastmoveBaseResponse {
  /** Supplier-side status code; mapping to internal taxonomy is Phase 4 work. */
  resultCode: string;
  resultMessage?: string;
}

/**
 * v2.0.3 envelope used by myQueryAll (and possibly others — Phase 4 to
 * confirm per-endpoint). The Phase 1 stub assumed every endpoint shared
 * `FastmoveBaseResponse`; production traffic shows myQueryAll uses this
 * `code` / `msg` shape instead.
 */
export interface FastmoveCodeMsgResponse {
  code: number;
  msg: string | null;
}

// ---------------------------------------------------------------------------
// 1. POST /Api/QuoteMg/myQueryAll  —  我的報價查詢 (sync, weekly cadence)
//
// NOTE: per spec v2.0.3 §1, this endpoint's body is *only* { merchantId,
// encStr } — no deptId. encStr = SHA-1(merchantId + Token). It does NOT
// follow the generic FastmoveAuthEnvelope shape; deptId at this endpoint
// gets the request rejected with a 500.
// ---------------------------------------------------------------------------

export interface QuoteMgMyQueryAllRequest {
  merchantId: string;
  encStr: string;
}

export interface QuoteMgQuoteItem {
  wmproductId: string;
  productId?: string;
  productName?: string;
  productNamelang?: string | null;
  /** Free-form region label, e.g. "Japan", "China, Hong Kong & Macao", "非洲". */
  productRegion?: string;
  /** 0: 虛擬卡(eSIM) / 1: SIM 卡 / 2: 充值 SIM 卡 — see spec §1 table. */
  productType?: number;
  productPrice: number;
  productcPrice?: number;
  csight?: number | boolean;
  leSIM?: boolean;
  // ...full shape per PDF appendix; left open for Phase 4 alignment.
  [extra: string]: unknown;
}

/**
 * Per spec §1: response is `{code, msg, prodList}` — NOT
 * `{resultCode, quoteList}`. Phase 1 stub used the wrong field name; that
 * mismatch surfaced as `Fastmove response missing 'quoteList'` once auth
 * finally went through against the production endpoint.
 */
export interface QuoteMgMyQueryAllResponse extends FastmoveCodeMsgResponse {
  prodList: QuoteMgQuoteItem[];
}

// ---------------------------------------------------------------------------
// 2.1 POST /Api/SOrder/mybuyesim  —  eSIM 下單 (async, ≤500/batch)
// ---------------------------------------------------------------------------

export interface SOrderMyBuyEsimItem {
  wmproductId: string;
  qty: number;
}

export interface SOrderMyBuyEsimRequest extends FastmoveAuthEnvelope {
  orderId: string;
  items: SOrderMyBuyEsimItem[];
}

export interface SOrderMyBuyEsimResponse extends FastmoveBaseResponse {
  orderId: string;
}

// 2.2 callback — supplier → us
export interface SOrderMyBuyEsimCallback {
  orderId: string;
  results: Array<{
    iccid: string;
    redemptionCode: string;
    wmproductId: string;
    productPrice: number;
  }>;
}

// 2.3 POST /Api/SOrder/querybuyesim  —  sync recovery query for 2.2 misses
export interface SOrderQueryBuyEsimRequest extends FastmoveAuthEnvelope {
  orderId: string;
}
export interface SOrderQueryBuyEsimResponse extends FastmoveBaseResponse {
  orderId: string;
  results: SOrderMyBuyEsimCallback["results"];
}

// ---------------------------------------------------------------------------
// 2.4 POST /Api/SOrder/mybuyesimRedemption  —  eSIM 下單並兌換 (async, ≤20/batch)
// ---------------------------------------------------------------------------

export interface SOrderMyBuyEsimRedemptionRequest extends FastmoveAuthEnvelope {
  orderId: string;
  items: SOrderMyBuyEsimItem[];
}
export interface SOrderMyBuyEsimRedemptionResponse extends FastmoveBaseResponse {
  orderId: string;
}

// 2.5 callback — same shape as 2.2 but redemption-pre-applied
export interface SOrderMyBuyEsimRedemptionCallback {
  orderId: string;
  results: Array<{
    iccid: string;
    cid?: string;
    redemptionCode: string;
    wmproductId: string;
    productPrice: number;
    qrUrl?: string;
    lpa?: string;
    pin?: string;
    puk?: string;
  }>;
}

// 2.6 sync recovery for 2.5
export interface SOrderQueryBuyEsimRedemptionRequest extends FastmoveAuthEnvelope {
  orderId: string;
}
export interface SOrderQueryBuyEsimRedemptionResponse extends FastmoveBaseResponse {
  orderId: string;
  results: SOrderMyBuyEsimRedemptionCallback["results"];
}

// 2.7 eSIM activation notification — supplier push, attaches use[S|E]Date
export interface SOrderEsimActivationCallback {
  iccid: string;
  cid?: string;
  useSDate: string;
  useEDate: string;
}

// ---------------------------------------------------------------------------
// 3.1 POST /Api/OrderRedemption/redemption  —  兌換兌換碼 (async)
// ---------------------------------------------------------------------------

export interface OrderRedemptionRequest extends FastmoveAuthEnvelope {
  orderId: string;
  redemptionCode: string;
}
export interface OrderRedemptionResponse extends FastmoveBaseResponse {
  orderId: string;
}

// 3.2 callback — QR / LPA / PIN / PUK delivery
export interface OrderRedemptionCallback {
  orderId: string;
  iccid: string;
  cid?: string;
  qrUrl?: string;
  lpa?: string;
  pin?: string;
  puk?: string;
}

// ---------------------------------------------------------------------------
// 4. POST /Api/SOrder/mybuysim  —  SIM 卡下單 (sync, physical, Phase-1 OOS)
// ---------------------------------------------------------------------------

export interface SOrderMyBuySimRequest extends FastmoveAuthEnvelope {
  orderId: string;
  items: SOrderMyBuyEsimItem[];
  shippingAddress?: string;
}
export interface SOrderMyBuySimResponse extends FastmoveBaseResponse {
  orderId: string;
}

// ---------------------------------------------------------------------------
// 5.x  充值 / 遠程激活 / 流量重置  —  async, callback-driven (Phase 4 detail)
// Grouped under one shape pair; concrete endpoint paths land in Phase 4.
// ---------------------------------------------------------------------------

export interface SOrderTopUpRequest extends FastmoveAuthEnvelope {
  iccid: string;
  wmproductId: string;
}
export interface SOrderTopUpResponse extends FastmoveBaseResponse {
  orderId: string;
}

// ---------------------------------------------------------------------------
// 6.1 POST /Api/UseageDetail/queryUseage  —  流量與狀態 (sync)
// ---------------------------------------------------------------------------

export interface UsageDetailQueryUseageRequest extends FastmoveAuthEnvelope {
  iccid: string;
}
export interface UsageDetailQueryUseageResponse extends FastmoveBaseResponse {
  iccid: string;
  status?: string;
  usedBytes?: number;
  remainBytes?: number;
}

// ---------------------------------------------------------------------------
// 6.2 POST /Api/UseageDetail/queryBasicInfo  —  eSIM 基本資訊 (sync)
// ---------------------------------------------------------------------------

export interface UsageDetailQueryBasicInfoRequest extends FastmoveAuthEnvelope {
  iccid: string;
}
export interface UsageDetailQueryBasicInfoResponse extends FastmoveBaseResponse {
  iccid: string;
  cid?: string;
  wmproductId?: string;
  useSDate?: string;
  useEDate?: string;
}

// ---------------------------------------------------------------------------
// 6.3 POST /Api/UseageDetail/queryEsimProgresses  —  安裝事件 (sync, ≤3 months)
// ---------------------------------------------------------------------------

export interface UsageDetailQueryEsimProgressesRequest extends FastmoveAuthEnvelope {
  iccid: string;
}
export interface UsageDetailEsimProgressEvent {
  eventCode: string;
  occurredAt: string;
  detail?: string;
}
export interface UsageDetailQueryEsimProgressesResponse extends FastmoveBaseResponse {
  iccid: string;
  events: UsageDetailEsimProgressEvent[];
}

// ---------------------------------------------------------------------------
// 6.4 檢核卡號正確性  —  validate iccid (sync) — endpoint path tbd in PDF
// ---------------------------------------------------------------------------

export interface ValidateIccidRequest extends FastmoveAuthEnvelope {
  iccid: string;
}
export interface ValidateIccidResponse extends FastmoveBaseResponse {
  iccid: string;
  valid: boolean;
}
