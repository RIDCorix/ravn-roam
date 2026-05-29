import type {
  OrderRedemptionRequest,
  OrderRedemptionResponse,
  QuoteMgMyQueryAllRequest,
  QuoteMgMyQueryAllResponse,
  SOrderMyBuyEsimRedemptionRequest,
  SOrderMyBuyEsimRedemptionResponse,
  SOrderMyBuyEsimRequest,
  SOrderMyBuyEsimResponse,
  SOrderMyBuySimRequest,
  SOrderMyBuySimResponse,
  SOrderQueryBuyEsimRedemptionRequest,
  SOrderQueryBuyEsimRedemptionResponse,
  SOrderQueryBuyEsimRequest,
  SOrderQueryBuyEsimResponse,
  SOrderTopUpRequest,
  SOrderTopUpResponse,
  UsageDetailQueryBasicInfoRequest,
  UsageDetailQueryBasicInfoResponse,
  UsageDetailQueryEsimProgressesRequest,
  UsageDetailQueryEsimProgressesResponse,
  UsageDetailQueryUseageRequest,
  UsageDetailQueryUseageResponse,
  ValidateIccidRequest,
  ValidateIccidResponse,
} from "./types.js";

export interface FastmoveClientConfig {
  baseUrl: string;
  merchantId: string;
  deptId: string;
  merchantKey: string;
}

class FastmoveHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "FastmoveHttpError";
  }
}

const NOT_IMPLEMENTED =
  "FastmoveClient method not implemented — endpoint path pending supplier confirmation";

/**
 * Skeleton supplier client for 世界移動 (Fastmove). Phase 1 deliverable —
 * methods exist for type-coverage only; every call throws. Real HTTP wiring,
 * retry, callback handling, and error-code mapping land in Phase 4.
 */
export class FastmoveClient {
  constructor(private readonly config: FastmoveClientConfig) {}

  private endpoint(path: string): string {
    return new URL(path, this.config.baseUrl).toString();
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.endpoint(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new FastmoveHttpError(
        `Fastmove ${path} failed with HTTP ${res.status}`,
        res.status,
        text,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FastmoveHttpError(
        `Fastmove ${path} returned non-JSON response`,
        res.status,
        text,
      );
    }
  }

  // 1.   報價查詢 (sync, weekly cadence — DO NOT call on demand)
  myQueryAllQuotes(
    req: QuoteMgMyQueryAllRequest,
  ): Promise<QuoteMgMyQueryAllResponse> {
    return this.postJson("/Api/QuoteMg/myQueryAll", req);
  }

  // 2.1 eSIM 下單 (async, ≤500/batch)
  mybuyesim(req: SOrderMyBuyEsimRequest): Promise<SOrderMyBuyEsimResponse> {
    return this.postJson("/Api/SOrder/mybuyesim", req);
  }

  // 2.3 eSIM 訂單查詢 (sync recovery)
  querybuyesim(
    req: SOrderQueryBuyEsimRequest,
  ): Promise<SOrderQueryBuyEsimResponse> {
    return this.postJson("/Api/SOrder/querybuyesim", req);
  }

  // 2.4 eSIM 下單並兌換 (async, ≤20/batch)
  mybuyesimRedemption(
    req: SOrderMyBuyEsimRedemptionRequest,
  ): Promise<SOrderMyBuyEsimRedemptionResponse> {
    return this.postJson("/Api/SOrder/mybuyesimRedemption", req);
  }

  // 2.6 sync recovery for 2.5
  querybuyesimRedemption(
    req: SOrderQueryBuyEsimRedemptionRequest,
  ): Promise<SOrderQueryBuyEsimRedemptionResponse> {
    return this.postJson("/Api/SOrder/querybuyesimRedemption", req);
  }

  // 3.1 兌換兌換碼 (async)
  redemption(req: OrderRedemptionRequest): Promise<OrderRedemptionResponse> {
    return this.postJson("/Api/OrderRedemption/redemption", req);
  }

  // 4.   SIM 卡下單 (sync, physical — Phase 1 OOS)
  mybuysim(req: SOrderMyBuySimRequest): Promise<SOrderMyBuySimResponse> {
    return this.postJson("/Api/SOrder/mybuysim", req);
  }

  // 5.x  充值 / 遠程激活 / 流量重置 (async)
  topUp(_req: SOrderTopUpRequest): Promise<SOrderTopUpResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 6.1 流量與狀態 (sync)
  queryUseage(
    _req: UsageDetailQueryUseageRequest,
  ): Promise<UsageDetailQueryUseageResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 6.2 eSIM 基本資訊 (sync)
  queryBasicInfo(
    _req: UsageDetailQueryBasicInfoRequest,
  ): Promise<UsageDetailQueryBasicInfoResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 6.3 eSIM 安裝事件 (sync, ≤3 months)
  queryEsimProgresses(
    _req: UsageDetailQueryEsimProgressesRequest,
  ): Promise<UsageDetailQueryEsimProgressesResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 6.4 檢核卡號正確性 (sync)
  validateIccid(_req: ValidateIccidRequest): Promise<ValidateIccidResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
