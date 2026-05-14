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
const SINGLE_DESTINATION_FIELDS = ["countryCode", "country", "iso2"] as const;
const INVENTORY_FIELDS = ["inventory", "stock", "remain"] as const;
const AVAILABLE_FIELDS = ["available", "onSale", "enabled"] as const;

export function mapFastmoveQuoteToRawPlan(item: QuoteMgQuoteItem): RawPlan {
  const name = readString(item, NAME_FIELDS) ?? item.wmproductId;
  const destinations = readDestinations(item);
  const dataAmountMb = readDataAmount(item);
  const validityDays = readNumber(item, VALIDITY_FIELDS) ?? 0;
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
