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

const NOT_IMPLEMENTED = "FastmoveClient method not implemented — Phase 4 work";

/**
 * Skeleton supplier client for 世界移動 (Fastmove). Phase 1 deliverable —
 * methods exist for type-coverage only; every call throws. Real HTTP wiring,
 * retry, callback handling, and error-code mapping land in Phase 4.
 */
export class FastmoveClient {
  constructor(private readonly config: FastmoveClientConfig) {}

  // 1.   報價查詢 (sync, weekly cadence — DO NOT call on demand)
  myQueryAllQuotes(
    _req: QuoteMgMyQueryAllRequest,
  ): Promise<QuoteMgMyQueryAllResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 2.1 eSIM 下單 (async, ≤500/batch)
  mybuyesim(_req: SOrderMyBuyEsimRequest): Promise<SOrderMyBuyEsimResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 2.3 eSIM 訂單查詢 (sync recovery)
  querybuyesim(
    _req: SOrderQueryBuyEsimRequest,
  ): Promise<SOrderQueryBuyEsimResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 2.4 eSIM 下單並兌換 (async, ≤20/batch)
  mybuyesimRedemption(
    _req: SOrderMyBuyEsimRedemptionRequest,
  ): Promise<SOrderMyBuyEsimRedemptionResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 2.6 sync recovery for 2.5
  querybuyesimRedemption(
    _req: SOrderQueryBuyEsimRedemptionRequest,
  ): Promise<SOrderQueryBuyEsimRedemptionResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 3.1 兌換兌換碼 (async)
  redemption(_req: OrderRedemptionRequest): Promise<OrderRedemptionResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // 4.   SIM 卡下單 (sync, physical — Phase 1 OOS)
  mybuysim(_req: SOrderMyBuySimRequest): Promise<SOrderMyBuySimResponse> {
    throw new Error(NOT_IMPLEMENTED);
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
