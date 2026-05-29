"use client";

// Commission slider with a decorative black cost band on the left and
// a teal/amber track on the right. When a previewProduct is passed in,
// each segment shows actual TWD numbers under the percentages.
//
//   [▇ cost ▇] [══ 收益 ═══●═══ 讓利 ══]
//    250 TWD       310 TWD      298 TWD
//    20%           51%          49%
//    成本          收益         讓利

import * as React from "react";

import type { Product } from "@roam/catalog";
import { readProductCost } from "@/components/admin/commission-product-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COST_VISUAL_PCT = 20;

export interface CommissionSliderProps {
  name?: string;
  value: number | null;
  onChange: (next: number) => void;
  disabled?: boolean;
  previewProduct?: Product | null;
}

export function CommissionSlider({
  name,
  value,
  onChange,
  disabled,
  previewProduct,
}: CommissionSliderProps) {
  const commissionPct = Math.round((value ?? 0) * 100);
  const clamped = Math.max(0, Math.min(100, commissionPct));
  const giveBackPct = 100 - clamped;

  // Derived TWD numbers if a preview SKU is selected. We never block the
  // slider on this — when no product is picked, only percentages show.
  const retail = previewProduct
    ? Number(previewProduct.pricing?.retail ?? 0)
    : 0;
  const cost = previewProduct ? readProductCost(previewProduct) : 0;
  const margin = Math.max(0, retail - cost);
  const profitTwd = margin * (clamped / 100);
  const vendorTwd = margin * (giveBackPct / 100);

  return (
    <div className="space-y-1.5">
      {name ? (
        <input
          type="hidden"
          name={name}
          value={(clamped / 100).toFixed(4)}
        />
      ) : null}

      {/* Bar row — input sits directly in the flex row (no wrapping div)
          so items-center centers it together with the cost band. The row
          is h-5 to fit the thumb without clipping. */}
      <div className="flex h-5 items-center gap-1">
        <div
          className="h-2.5 shrink-0 rounded-full bg-foreground/85"
          style={{ width: `${COST_VISUAL_PCT}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={clamped}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="佣金率"
          className={cn(
            "commission-slider min-w-0 flex-1",
            disabled && "opacity-60",
          )}
          style={
            { "--cs-thumb-pct": `${clamped}%` } as React.CSSProperties
          }
        />
      </div>

      {/* Labels row — flex widths exactly mirror the bar so each block
          sits under its colored band. Labels are absolutely positioned
          within their segment so narrow segments never clip the
          numbers; the container reserves a fixed height + margin so it
          doesn't collide with the 佣金率 input below. */}
      <div className="relative mb-3 flex h-9 text-center text-[10px] leading-tight">
        <Segment
          width={COST_VISUAL_PCT}
          twd={previewProduct ? cost : null}
          pct={COST_VISUAL_PCT}
          label="成本"
          tone="cost"
        />
        <div className="relative flex flex-1">
          <Segment
            width={Math.max(clamped, 0)}
            twd={previewProduct ? profitTwd : null}
            pct={clamped}
            label="收益"
            tone="profit"
            scale="margin"
          />
          <Segment
            width={Math.max(giveBackPct, 0)}
            twd={previewProduct ? vendorTwd : null}
            pct={giveBackPct}
            label="讓利"
            tone="vendor"
            scale="margin"
          />
        </div>
      </div>

      {/* Compact numeric override for keyboard / precise entry. */}
      <div className="flex items-center gap-2 pt-1 text-xs">
        <span className="text-muted-foreground">佣金率</span>
        <Input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={clamped}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) {
              onChange(Math.max(0, Math.min(100, n)) / 100);
            }
          }}
          className="h-7 w-20"
        />
        <span className="text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function Segment({
  width,
  twd,
  pct,
  label,
  tone,
  scale,
}: {
  width: number;
  twd: number | null;
  pct: number;
  label: string;
  tone: "cost" | "profit" | "vendor";
  // Cost is a % of retail; profit/vendor are % of margin. We render the
  // same number either way so a "scale" tag isn't visually needed, but
  // we keep the prop so we can hint later in a tooltip.
  scale?: "retail" | "margin";
}) {
  void scale;
  const numberClass =
    tone === "cost"
      ? "text-foreground"
      : tone === "profit"
        ? "text-primary"
        : "text-amber-600";
  return (
    <div
      className="relative px-0.5"
      style={{ width: `${Math.max(width, 0.0001)}%` }}
    >
      {/* Label is absolutely positioned so the number is never clipped
          when the segment shrinks; instead it overflows into the
          neighbouring column. Aligns to the segment's center via 50%
          + translateX(-50%). */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap"
        style={{ minWidth: "max-content" }}
      >
        <div className={cn("font-semibold tabular-nums", numberClass)}>
          {twd != null ? (
            <>
              {Math.round(twd).toLocaleString()}
              <span className="ml-0.5 font-normal text-muted-foreground">
                ({pct}%)
              </span>
            </>
          ) : (
            `${pct}%`
          )}
        </div>
        <div className="text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
