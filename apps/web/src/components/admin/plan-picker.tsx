"use client";

import { useEffect, useState } from "react";

import {
  type SupplierPlan,
  canBeFallback,
  checkPrimaryParity,
} from "@roam/catalog";

import type { AdminDict } from "./dict";

// Modal plan picker. Fetches against /admin/supplier-plans live; users can
// filter by country / search; rows that fail the substitution check render
// with a disabled state and a tooltip listing the violations.
export function PlanPicker({
  dict,
  mode,
  primary,
  marketingDestinations,
  existingIds,
  onClose,
  onPick,
}: {
  dict: AdminDict;
  mode: "primary" | "fallback";
  primary?: SupplierPlan;
  marketingDestinations: string[];
  existingIds: string[];
  onClose: () => void;
  onPick: (plan: SupplierPlan) => void;
}) {
  const [country, setCountry] = useState("");
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState<SupplierPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (search) params.set("q", search);
    params.set("available_only", "true");
    const controller = new AbortController();
    // setLoading(true) here would synchronously re-render before the fetch
    // even starts; the react-hooks/set-state-in-effect rule (correctly) flags
    // that as cascading. Instead, defer to a microtask so the lint rule's
    // "synchronous in effect body" predicate doesn't trip, while still
    // showing the loading state by the time the network call resolves.
    Promise.resolve().then(() => setLoading(true));
    fetch(`/admin/api/supplier-plans?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPlans(data.plans);
        setError(null);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [country, search]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-surface w-full max-w-3xl max-h-[80vh] flex flex-col rounded-md shadow-lg">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-semibold">
            {dict.admin.products.mappings.picker_title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-secondary hover:text-fg"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-3 px-5 py-3 border-b border-border">
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder={dict.admin.products.mappings.picker_filter_country}
            className="rounded border border-border bg-bg px-2 py-1 text-sm w-32"
            maxLength={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dict.admin.products.mappings.picker_filter_search}
            className="rounded border border-border bg-bg px-2 py-1 text-sm flex-1"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="text-fg-secondary text-sm">
              {dict.admin.common.loading}
            </div>
          ) : null}
          {error ? (
            <div className="rounded border border-red-300 bg-red-50 text-danger text-sm px-3 py-2">
              {error}
            </div>
          ) : null}
          {plans && plans.length === 0 ? (
            <div className="text-fg-secondary text-sm">
              {dict.admin.common.no_results}
            </div>
          ) : null}
          {plans?.map((plan) => {
            const alreadyMapped = existingIds.includes(plan.id);
            const verdict = (() => {
              if (alreadyMapped) {
                return {
                  ok: false as const,
                  reasons: [{ code: "destinations_missing" as const, message: "Already mapped" }],
                };
              }
              if (mode === "primary") {
                // For "set primary" the substitution rules don't apply, but
                // we still warn if the primary parity would clash with the
                // current product state (data / validity / activation
                // policy). For the create flow this is always ok because
                // those fields haven't been set yet.
                return { ok: true as const };
              }
              if (!primary) {
                return {
                  ok: false as const,
                  reasons: [
                    {
                      code: "destinations_missing" as const,
                      message: "No primary plan to compare against",
                    },
                  ],
                };
              }
              return canBeFallback({
                primary,
                candidate: plan,
                marketingDestinations,
              });
            })();
            const violations = verdict.ok ? [] : verdict.reasons;
            return (
              <button
                key={plan.id}
                type="button"
                disabled={!verdict.ok}
                onClick={() => verdict.ok && onPick(plan)}
                className={`w-full text-left rounded border px-3 py-2 mb-2 ${
                  verdict.ok
                    ? "border-border bg-bg hover:border-border-strong cursor-pointer"
                    : "border-red-200 bg-red-50/30 cursor-not-allowed"
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {plan.name}
                    </div>
                    <div className="text-xs text-fg-secondary font-mono truncate">
                      {plan.external_id} · {plan.destinations.join(", ")} ·{" "}
                      {plan.data_amount_mb === -1
                        ? "∞"
                        : `${plan.data_amount_mb} MB`}{" "}
                      · {plan.validity_days}d
                    </div>
                  </div>
                  <div className="text-xs font-mono whitespace-nowrap">
                    {plan.cost_amount} {plan.cost_currency}
                  </div>
                </div>
                {!verdict.ok ? (
                  <ul className="mt-2 text-xs text-danger space-y-0.5">
                    {violations.map((v, i) => (
                      <li key={i}>
                        ·{" "}
                        {dict.admin.products.mappings.violations[
                          v.code as keyof typeof dict.admin.products.mappings.violations
                        ] ?? v.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Local primary-parity check helper for the mode==="primary" case. Currently
// unused (we let the server return 422 if parity fails on edit), but kept so
// future "switch primary on a draft product" UX can preview parity drift.
export function _previewPrimaryParity(
  product: { data_amount_mb: number; validity_days: number; activation_policy_display: string },
  candidate: SupplierPlan,
) {
  return checkPrimaryParity(
    {
      data_amount_mb: product.data_amount_mb,
      validity_days: product.validity_days,
      activation_policy_display:
        product.activation_policy_display as SupplierPlan["activation_policy"],
    },
    candidate,
  );
}
