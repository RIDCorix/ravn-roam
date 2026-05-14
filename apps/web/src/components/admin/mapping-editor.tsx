"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  type ProductMappingWithPlan,
  type ProductPublicationState,
  type ProductWithMappings,
  type SupplierPlan,
  areMappingsLocked,
  canBeFallback,
} from "@roam/catalog";

import type { AdminDict } from "./dict";
import {
  addMappingAction,
  removeMappingAction,
  reorderMappingsAction,
} from "@/lib/actions";

import { PlanPicker } from "./plan-picker";

export function MappingEditor({
  lang,
  dict,
  product,
}: {
  lang: string;
  dict: AdminDict;
  product: ProductWithMappings;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"primary" | "fallback">(
    "fallback",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reordering, setReordering] = useState<string[] | null>(null);

  const locked = areMappingsLocked(product.publication_state);
  const primary = product.mappings.find((m) => m.priority === 0);
  const sortedMappings = [...product.mappings].sort(
    (a, b) => a.priority - b.priority,
  );

  async function addMapping(plan: SupplierPlan) {
    setError(null);
    // Client-side gate so the user sees the violation reasons without a
    // server round-trip. The server enforces the same predicate.
    if (primary && plan.id !== primary.plan.id) {
      const verdict = canBeFallback({
        primary: primary.plan,
        candidate: plan,
        marketingDestinations: product.marketing_destinations,
      });
      if (!verdict.ok) {
        setError(
          dict.admin.products.mappings.violations_header +
            " " +
            verdict.reasons
              .map(
                (r) =>
                  dict.admin.products.mappings.violations[r.code] ?? r.message,
              )
              .join(" · "),
        );
        return;
      }
    }
    const priority = pickerMode === "primary" ? 0 : product.mappings.length;
    startTransition(async () => {
      const result = await addMappingAction(lang, product.id, {
        supplier_plan_id: plan.id,
        priority,
        enabled: true,
      });
      if (!result.ok) {
        setError(formatError(result, dict));
        return;
      }
      setPickerOpen(false);
      router.refresh();
    });
  }

  function removeRow(plan: SupplierPlan) {
    if (!window.confirm(dict.admin.products.mappings.remove_confirm)) return;
    startTransition(async () => {
      const result = await removeMappingAction(lang, product.id, plan.id);
      if (!result.ok) {
        setError(formatError(result, dict));
        return;
      }
      router.refresh();
    });
  }

  function startReorder() {
    setReordering(sortedMappings.map((m) => m.plan.id));
  }

  function saveOrder() {
    if (!reordering) return;
    startTransition(async () => {
      const result = await reorderMappingsAction(lang, product.id, {
        order: reordering,
      });
      if (!result.ok) {
        setError(formatError(result, dict));
        return;
      }
      setReordering(null);
      router.refresh();
    });
  }

  function moveRow(planId: string, direction: -1 | 1) {
    if (!reordering) return;
    const idx = reordering.indexOf(planId);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= reordering.length) return;
    const next = [...reordering];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setReordering(next);
  }

  return (
    <section className="rounded border border-border bg-surface px-5 py-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">
          {dict.admin.products.mappings.title}
        </h2>
        <div className="flex gap-2">
          {!locked && product.mappings.length > 1 && !reordering ? (
            <button
              type="button"
              onClick={startReorder}
              className="rounded border border-border bg-bg px-3 py-1.5 text-xs hover:border-border-strong"
            >
              {dict.admin.products.mappings.reorder}
            </button>
          ) : null}
          {reordering ? (
            <>
              <button
                type="button"
                onClick={() => setReordering(null)}
                className="rounded border border-border bg-bg px-3 py-1.5 text-xs"
              >
                {dict.admin.products.mappings.cancel_reorder}
              </button>
              <button
                type="button"
                onClick={saveOrder}
                disabled={pending}
                className="rounded bg-fg text-bg px-3 py-1.5 text-xs"
              >
                {dict.admin.products.mappings.save_order}
              </button>
            </>
          ) : null}
          {!locked && !reordering ? (
            <>
              {!primary ? (
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode("primary");
                    setPickerOpen(true);
                  }}
                  className="rounded bg-fg text-bg px-3 py-1.5 text-xs hover:opacity-90"
                >
                  + {dict.admin.products.mappings.primary}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode("fallback");
                    setPickerOpen(true);
                  }}
                  className="rounded border border-border bg-bg px-3 py-1.5 text-xs hover:border-border-strong"
                >
                  + {dict.admin.products.mappings.add}
                </button>
              )}
            </>
          ) : null}
        </div>
      </header>

      {locked ? (
        <div className="text-xs text-fg-secondary mb-3">
          {dict.admin.common.locked_published}
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded border border-red-300 bg-red-50 text-danger text-xs px-3 py-2">
          {error}
        </div>
      ) : null}

      {sortedMappings.length === 0 ? (
        <div className="text-sm text-fg-secondary">
          {dict.admin.products.mappings.no_mappings}
        </div>
      ) : (
        <ol className="space-y-2">
          {(reordering
            ? reordering.map(
                (planId) =>
                  sortedMappings.find((m) => m.plan.id === planId)!,
              )
            : sortedMappings
          ).map((mapping, idx) => (
            <MappingRow
              key={mapping.id}
              dict={dict}
              mapping={mapping}
              index={idx}
              productPublicationState={product.publication_state}
              reordering={!!reordering}
              onMoveUp={() => moveRow(mapping.plan.id, -1)}
              onMoveDown={() => moveRow(mapping.plan.id, 1)}
              onRemove={() => removeRow(mapping.plan)}
            />
          ))}
        </ol>
      )}

      {pickerOpen ? (
        <PlanPicker
          dict={dict}
          mode={pickerMode}
          primary={primary?.plan}
          marketingDestinations={product.marketing_destinations}
          existingIds={product.mappings.map((m) => m.plan.id)}
          onClose={() => setPickerOpen(false)}
          onPick={(plan) => addMapping(plan)}
        />
      ) : null}
    </section>
  );
}

function MappingRow({
  dict,
  mapping,
  index,
  productPublicationState,
  reordering,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  dict: AdminDict;
  mapping: ProductMappingWithPlan;
  index: number;
  productPublicationState: ProductPublicationState;
  reordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const locked = areMappingsLocked(productPublicationState);
  const label =
    index === 0
      ? dict.admin.products.mappings.primary
      : dict.admin.products.mappings.fallback.replace("{n}", String(index));
  return (
    <li className="rounded border border-border bg-bg px-3 py-2 flex items-center gap-3">
      <span className="inline-block rounded bg-surface-muted text-fg-secondary text-xs px-2 py-0.5 font-medium min-w-[80px] text-center">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{mapping.plan.name}</div>
        <div className="text-xs text-fg-secondary font-mono truncate">
          {mapping.plan.external_id} · {mapping.plan.destinations.join(", ")} ·{" "}
          {mapping.plan.data_amount_mb === -1
            ? "∞"
            : `${mapping.plan.data_amount_mb} MB`}{" "}
          · {mapping.plan.validity_days}d
        </div>
      </div>
      {reordering ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            className="rounded border border-border bg-surface px-2 py-1 text-xs"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            className="rounded border border-border bg-surface px-2 py-1 text-xs"
          >
            ↓
          </button>
        </div>
      ) : null}
      {!locked && !reordering ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-danger hover:underline"
        >
          {dict.admin.common.delete}
        </button>
      ) : null}
    </li>
  );
}

function formatError(
  result: { error?: string; details?: unknown },
  dict: AdminDict,
): string {
  type ViolationDetail = {
    violations?: Array<{ code: keyof typeof dict.admin.products.mappings.violations; message: string }>;
  };
  const details = result.details as ViolationDetail | null;
  if (details?.violations) {
    return details.violations
      .map((v) => dict.admin.products.mappings.violations[v.code] ?? v.message)
      .join(" · ");
  }
  return result.error ?? "unknown_error";
}
