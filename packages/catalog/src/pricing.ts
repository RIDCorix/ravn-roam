// Pricing computation from the regulation doc §5.
//
// markup_mode values:
//   - `fixed_amount`   — retail = cost_in_retail_currency + markup_value
//   - `percentage`     — retail = cost_in_retail_currency * (1 + markup_value/100)
//   - `target_margin`  — retail = cost_in_retail_currency / (1 - markup_value/100)
//   - `manual`         — retail comes from admin input, markup_value ignored
//
// `cost_in_retail_currency = cost_snapshot.cost * cost_snapshot.fx_rate`.
// Mode != manual ⇒ admin UI shows the computed value and the admin confirms;
// regardless of mode, the final `retail` is what gets persisted.

import type { MarkupMode, ProductPricing } from "./types";

export interface ComputeRetailInput {
  costAmount: number;
  fxRate: number;
  markupMode: MarkupMode;
  markupValue: number;
  manualRetail?: number;
}

export function computeRetail(input: ComputeRetailInput): number {
  const { costAmount, fxRate, markupMode, markupValue, manualRetail } = input;
  const costInRetail = costAmount * fxRate;

  switch (markupMode) {
    case "fixed_amount":
      return round2(costInRetail + markupValue);
    case "percentage":
      return round2(costInRetail * (1 + markupValue / 100));
    case "target_margin": {
      const denom = 1 - markupValue / 100;
      if (denom <= 0) {
        throw new Error(
          "target_margin must be < 100 — a 100% target margin is unreachable",
        );
      }
      return round2(costInRetail / denom);
    }
    case "manual":
      return round2(manualRetail ?? 0);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Compute the effective margin for a given retail / cost pair. Used by the
// admin UI to show "you are selling at X% margin" once the admin manually
// edits retail.
export function computeMargin(
  retail: number,
  costInRetailCurrency: number,
): number | null {
  if (retail <= 0) return null;
  return ((retail - costInRetailCurrency) / retail) * 100;
}

// Build the `pricing` jsonb blob the API persists. Anything optional that
// the admin didn't fill is dropped — keeping the column lean so we can grep
// historical rows for "products with no msrp" later.
export interface BuildPricingInput {
  currency: string;
  markupMode: MarkupMode;
  markupValue: number;
  manualRetail?: number;
  msrp?: number;
  costSnapshot?: ProductPricing["cost_snapshot"];
  fxPolicy?: ProductPricing["fx_policy"];
}

export function buildPricing(input: BuildPricingInput): ProductPricing {
  const fxRate = input.costSnapshot?.fx_rate ?? 1;
  const costAmount = input.costSnapshot?.cost ?? 0;
  const retail = computeRetail({
    costAmount,
    fxRate,
    markupMode: input.markupMode,
    markupValue: input.markupValue,
    manualRetail: input.manualRetail,
  });
  return {
    currency: input.currency,
    retail,
    markup_mode: input.markupMode,
    markup_value: input.markupValue,
    msrp: input.msrp,
    cost_snapshot: input.costSnapshot,
    fx_policy: input.fxPolicy ?? "snapshot_at_publish",
  };
}
