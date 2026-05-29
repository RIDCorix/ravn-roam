/**
 * Fastmove quote-item → `RawPlan` mapping.
 *
 * Source field reference: ROA-86 ("Key fields → 我們 domain model 的對應").
 * Field-name guesses for unannotated columns (destinations, data, validity)
 * are best-effort against the v2.0.3 PDF appendix and are gated through
 * {@link readNumber} / {@link readDestinations} so that a Phase-4 sample
 * response can correct the assumption with a one-line edit + new test case.
 *
 * Pure function. No I/O, no env reads, no clock.
 */

import type { QuoteMgQuoteItem } from "../../clients/fastmove/types.js";
import type { ActivationPolicy, DeliveryModel, RawPlan } from "../adapter.js";

/** Sentinel for unlimited data — per `supplier_plan.data_amount_mb` schema. */
const UNLIMITED_MB = -1;

/**
 * Fields the spec PDF labels with hard names. Anything beyond this is read
 * defensively via `extra` and may evolve as we see real samples.
 */
const NAME_FIELDS = ["productName", "productNameZh", "name"] as const;
const DATA_FIELDS = ["flowMb", "dataMb", "flow", "data"] as const;
const VALIDITY_FIELDS = ["validDay", "validDays", "days", "valid"] as const;
const DESTINATION_FIELDS = ["countryList", "countries", "areaList"] as const;
// `productRegion` is the v2.0.3 production response field — free-form
// region label ("Japan", "China, Hong Kong & Macao", "非洲", "任何"), NOT
// an ISO-2 code. Carrying it here as a fallback gives the supplier-plans
// admin table something readable to display; admins translate it to real
// ISO codes when promoting the plan into a product.
const SINGLE_DESTINATION_FIELDS = [
  "countryCode",
  "country",
  "iso2",
  "productRegion",
] as const;
const INVENTORY_FIELDS = ["inventory", "stock", "remain"] as const;
const AVAILABLE_FIELDS = ["available", "onSale", "enabled"] as const;

export function mapFastmoveQuoteToRawPlan(item: QuoteMgQuoteItem): RawPlan {
  const name = readString(item, NAME_FIELDS) ?? item.wmproductId;
  const destinations = readDestinations(item);
  // Fastmove v2 payloads do not expose flowMb / validDay as dedicated
  // fields — those are encoded inline in productName. Read the dedicated
  // fields first (future-proof if they ever appear), fall back to a
  // productName parser otherwise.
  const fromName = parseProductName(name);
  const dataFromField = readDataAmount(item);
  const dataAmountMb =
    dataFromField !== 0
      ? dataFromField
      : fromName.dataAmountMb ?? 0;
  const validityDays =
    readNumber(item, VALIDITY_FIELDS) ??
    fromName.validityDays ??
    // productType=2 are uniformly 1-day plans (no day token in name); if
    // we extracted a data spec but no day count, assume 1.
    (fromName.dataAmountMb !== null ? 1 : 0);
  const available = readBoolean(item, AVAILABLE_FIELDS) ?? true;
  const inventoryHint = readNumber(item, INVENTORY_FIELDS) ?? null;

  return {
    externalId: item.wmproductId,
    name,
    destinations,
    networkOperators: pickRecord(item, "networkOperators") ?? {},
    dataAmountMb,
    validityDays,
    activationPolicy: deriveActivationPolicy(item),
    deliveryModel: deriveDeliveryModel(item),
    // Fastmove quotes TWD as integer; serialise without precision games.
    costAmount: String(item.productPrice),
    costCurrency: "TWD",
    available,
    inventoryHint,
    rawPayload: { ...item },
  };
}

// --- Field derivations -----------------------------------------------------

/**
 * Fastmove's `leSIM` flag distinguishes 世界移動-issued eSIMs (true → flow
 * via redemption code, see ROA-86 §3.1) from local-supplier physical SIMs
 * (false → on-the-spot card). The schema only has 4 delivery models; map:
 *
 *   leSIM=true  → redemption_required  (world-mobile redemption code path)
 *   leSIM=false → physical             (成品卡)
 *   unset       → redemption_required  (Phase 2 catalogue is eSIM-only —
 *                                       Fastmove physical SIM is OOS per
 *                                       ROA-86 §4, but we keep the mapping
 *                                       lenient instead of throwing).
 */
function deriveDeliveryModel(item: QuoteMgQuoteItem): DeliveryModel {
  if (item.leSIM === false) return "physical";
  return "redemption_required";
}

/**
 * Fastmove activation policy is implicit in the spec: `useSDate`/`useEDate`
 * are written when the user installs / first uses the eSIM (§2.7 callback).
 * Default to `on_first_use`; once Phase 4 unwraps the per-plan policy field
 * (if any) this is the place to special-case it.
 */
function deriveActivationPolicy(_item: QuoteMgQuoteItem): ActivationPolicy {
  return "on_first_use";
}

/**
 * Destinations live under several possible field names per the v2.0.3
 * appendix. Prefer a list (regional plans), fall back to a single ISO code,
 * and as last resort return `[]` rather than throwing — the sync job will
 * surface the empty list as a validation problem with the upstream sample
 * row in hand.
 */
function readDestinations(item: QuoteMgQuoteItem): string[] {
  for (const key of DESTINATION_FIELDS) {
    const value = item[key];
    if (Array.isArray(value)) {
      const codes = value.filter((v): v is string => typeof v === "string");
      if (codes.length > 0) return codes.map(normaliseIso2);
    }
  }
  for (const key of SINGLE_DESTINATION_FIELDS) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) {
      return [normaliseIso2(value)];
    }
  }
  return [];
}

/**
 * Parse data + validity out of a Fastmove `productName` like
 *   "歐洲C, 27天, 3GB/天, 128kbps"   → days=27, mb=3072
 *   "土耳其, 500MB/天, 128kbps"       → days=null (inferred =1 by caller), mb=500
 *   "美國, 7天, 20GB"                 → days=7, mb=20480
 *   "菲律賓, 21天, 鈦金吃到飽/天"      → days=21, mb=-1 (unlimited)
 *   "黑卡(空卡)"                      → days=null, mb=null
 *
 * Treats the name as a list of comma-separated tokens (handles ASCII
 * and full-width comma) and matches each token against day / data /
 * unlimited patterns. Returns null fields for "no signal found"; the
 * caller decides how to default.
 */
function parseProductName(name: string): {
  dataAmountMb: number | null;
  validityDays: number | null;
} {
  if (!name) return { dataAmountMb: null, validityDays: null };
  const chunks = name.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  let validityDays: number | null = null;
  let dataAmountMb: number | null = null;
  for (const chunk of chunks) {
    if (validityDays === null) {
      const m = chunk.match(/^(\d+)\s*天$/);
      if (m) {
        validityDays = Number(m[1]);
        continue;
      }
    }
    if (dataAmountMb === null && /吃到飽/.test(chunk)) {
      dataAmountMb = UNLIMITED_MB;
      continue;
    }
    if (dataAmountMb === null) {
      const m = chunk.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i);
      if (m?.[1] && m[2]) {
        const n = Number(m[1]);
        const unit = m[2].toUpperCase();
        const factor = unit === "MB" ? 1 : unit === "GB" ? 1024 : 1024 * 1024;
        dataAmountMb = Math.round(n * factor);
      }
    }
  }
  return { dataAmountMb, validityDays };
}

function readDataAmount(item: QuoteMgQuoteItem): number {
  const raw = readNumber(item, DATA_FIELDS);
  if (raw === null) return 0;
  // Fastmove (and several upstream eSIM APIs) signal "unlimited" with `-1`.
  // Treat any non-positive value as the unlimited sentinel to be tolerant.
  if (raw < 0) return UNLIMITED_MB;
  return raw;
}

// --- Generic field readers -------------------------------------------------

function readString(
  item: QuoteMgQuoteItem,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function readNumber(
  item: QuoteMgQuoteItem,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(
  item: QuoteMgQuoteItem,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function pickRecord(
  item: QuoteMgQuoteItem,
  key: string,
): Record<string, unknown> | null {
  const value = item[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** ISO codes should be 2-char upper-case; trim then upper-case defensively. */
function normaliseIso2(code: string): string {
  return code.trim().toUpperCase();
}
