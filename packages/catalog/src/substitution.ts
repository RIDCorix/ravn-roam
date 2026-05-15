// Substitution rule check from the Phase 2 Catalog regulation doc §6.
//
// A "fallback" plan replaces the primary plan when the primary is unavailable
// at order time. To keep the customer's promise honest, every fallback plan
// must DOMINATE the primary on three axes:
//
//   1. data_amount_mb  >= primary.data_amount_mb        (-1 = unlimited wins)
//   2. validity_days   >= primary.validity_days
//   3. destinations    ⊇ product.marketing_destinations
//
// The admin UI calls this before persisting a new mapping; the API also calls
// it on PATCH /products/:id/mappings to defense-in-depth against direct API
// abuse. Returning an explicit `reasons` array (not a single message) is what
// makes the UI form usable — each violation maps to a specific input.

import type { Product, SupplierPlan } from "./types";

export type SubstitutionViolationCode =
  | "data_amount_mb_too_low"
  | "validity_days_too_short"
  | "destinations_missing";

export interface SubstitutionViolation {
  code: SubstitutionViolationCode;
  // Human-readable message keyed by code; locale-independent for now (admin
  // UI looks up the localized string from its dictionary by code).
  message: string;
  // Bag the violator's value and the required value so the UI can render a
  // useful diff inline ("plan offers 3 GB but primary needs at least 5 GB").
  detail?: Record<string, unknown>;
}

export interface SubstitutionCheckInput {
  primary: SupplierPlan;
  candidate: SupplierPlan;
  marketingDestinations: string[];
}

// data_amount_mb stores -1 for "unlimited". -1 beats every finite value, but
// a finite value never beats -1. Compare with care.
function dataAmountGte(candidate: number, primary: number): boolean {
  if (primary === -1) return candidate === -1;
  if (candidate === -1) return true;
  return candidate >= primary;
}

export function checkSubstitution(
  input: SubstitutionCheckInput,
): SubstitutionViolation[] {
  const { primary, candidate, marketingDestinations } = input;
  const violations: SubstitutionViolation[] = [];

  if (!dataAmountGte(candidate.data_amount_mb, primary.data_amount_mb)) {
    violations.push({
      code: "data_amount_mb_too_low",
      message: `Fallback plan offers ${formatData(candidate.data_amount_mb)} but primary requires at least ${formatData(primary.data_amount_mb)}`,
      detail: {
        primary: primary.data_amount_mb,
        candidate: candidate.data_amount_mb,
      },
    });
  }

  if (candidate.validity_days < primary.validity_days) {
    violations.push({
      code: "validity_days_too_short",
      message: `Fallback plan lasts ${candidate.validity_days} days but primary requires at least ${primary.validity_days} days`,
      detail: {
        primary: primary.validity_days,
        candidate: candidate.validity_days,
      },
    });
  }

  const candidateSet = new Set(candidate.destinations);
  const missing = marketingDestinations.filter((c) => !candidateSet.has(c));
  if (missing.length > 0) {
    violations.push({
      code: "destinations_missing",
      message: `Fallback plan is missing required destinations: ${missing.join(", ")}`,
      detail: { missing },
    });
  }

  return violations;
}

function formatData(mb: number): string {
  if (mb === -1) return "unlimited";
  if (mb % 1024 === 0) return `${mb / 1024} GB`;
  return `${mb} MB`;
}

// Convenience for the admin UI's add-fallback form — boolean answer plus the
// reasons so the disabled-state hover tooltip can explain itself.
export function canBeFallback(
  input: SubstitutionCheckInput,
): { ok: true } | { ok: false; reasons: SubstitutionViolation[] } {
  const reasons = checkSubstitution(input);
  if (reasons.length === 0) return { ok: true };
  return { ok: false, reasons };
}

// Marketing destinations must also be a subset of the PRIMARY plan's
// destinations (regulation doc §3 rule 1: marketing can be a strict subset
// but never a superset). The admin UI calls this when the user edits
// product.marketing_destinations while a primary mapping is already wired.
export function checkMarketingDestinations(
  marketingDestinations: string[],
  primary: Pick<SupplierPlan, "destinations">,
): SubstitutionViolation[] {
  const primarySet = new Set(primary.destinations);
  const extras = marketingDestinations.filter((c) => !primarySet.has(c));
  if (extras.length === 0) return [];
  return [
    {
      code: "destinations_missing",
      message: `Marketing destinations include countries not in the primary plan: ${extras.join(", ")}`,
      detail: { extras, primaryDestinations: primary.destinations },
    },
  ];
}

// "Primary plan parity" check from regulation doc §3 rules 2 + 3: when an
// admin sets / changes the primary mapping, product.data_amount_mb,
// validity_days, and activation_policy_display must equal the primary
// plan's values. The admin UI auto-fills these from the plan when wiring the
// primary, but this guards against tampering on PATCH.
export function checkPrimaryParity(
  product: Pick<
    Product,
    "data_amount_mb" | "validity_days" | "activation_policy_display"
  >,
  primary: SupplierPlan,
): SubstitutionViolation[] {
  const out: SubstitutionViolation[] = [];
  if (product.data_amount_mb !== primary.data_amount_mb) {
    out.push({
      code: "data_amount_mb_too_low",
      message: `Product data_amount_mb (${product.data_amount_mb}) must equal primary plan (${primary.data_amount_mb})`,
    });
  }
  if (product.validity_days !== primary.validity_days) {
    out.push({
      code: "validity_days_too_short",
      message: `Product validity_days (${product.validity_days}) must equal primary plan (${primary.validity_days})`,
    });
  }
  if (product.activation_policy_display !== primary.activation_policy) {
    out.push({
      code: "destinations_missing",
      message: `activation_policy_display must equal primary plan's activation_policy`,
    });
  }
  return out;
}
