import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { appSpring } from "@/components/storefront/motion";
import type { ShopProduct } from "@/lib/storefront-api";
import {
  getCoverageInfo,
  type ShopRegion,
} from "@/lib/storefront-regions";
import { cn } from "@/lib/utils";

import {
  TIER_STYLES,
  formatDataSplit,
  pickTier,
} from "./shop-plan-utils";
import type { ShopRegionLabels } from "./shop-region-types";

export function PlanRow({
  product,
  localeKey,
  labels,
  highlighted,
  region,
  onSelect,
}: {
  product: ShopProduct;
  localeKey: "zh-TW" | "en";
  labels: ShopRegionLabels;
  highlighted?: boolean;
  region: ShopRegion;
  onSelect: () => void;
}) {
  const coverage = getCoverageInfo(
    product.marketing_destinations,
    region,
    localeKey,
  );
  const rowRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  const retail = Number(product.pricing?.retail ?? 0);
  const isUnlimited = product.data_amount_mb < 0;
  const isPerDay = (product.tags ?? []).includes("per-day");
  const isThrottled = (product.tags ?? []).includes("throttled");

  const tier = pickTier(product);
  const tierStyle = TIER_STYLES[tier];
  const TierIcon = tierStyle.Icon;
  const { primary, suffix } = formatDataSplit(
    product.data_amount_mb,
    isPerDay,
    labels,
  );

  return (
    <motion.button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={appSpring}
      className={cn(
        "group relative flex w-full items-stretch overflow-hidden rounded-xl text-left transition-colors duration-150",
        highlighted
          ? "bg-accent-softer ring-2 ring-accent/40"
          : "bg-surface",
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        aria-hidden
        className="w-1 shrink-0"
        style={{ background: tierStyle.strip }}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
            tierStyle.iconBg,
            tierStyle.iconColor,
          )}
        >
          <TierIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-[22px] font-bold tracking-[-0.02em] tabular-nums text-fg",
                tier === "standard" && "text-[18px]",
              )}
            >
              {primary}
            </span>
            {suffix ? (
              <span className="text-[12px] text-fg-muted">{suffix}</span>
            ) : null}
            {tierStyle.ribbon ? (
              <span
                className={cn(
                  "ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  tierStyle.ribbon.bg,
                )}
              >
                {tier === "titanium"
                  ? labels.tier_titanium
                  : labels.tier_high_speed}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <CoverageBadge coverage={coverage} labels={labels} />
            {isUnlimited && !tierStyle.ribbon ? (
              <Tag accent>{labels.unlimited}</Tag>
            ) : null}
            {isThrottled ? <Tag>{labels.throttled}</Tag> : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-1 pr-3">
        <div className="text-right leading-none">
          <div className="text-[9.5px] uppercase tracking-wide text-fg-muted">
            NT$
          </div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-fg">
            {Math.round(retail).toLocaleString()}
          </div>
        </div>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-transform group-hover:translate-x-0.5"
          aria-label={labels.buy}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </motion.button>
  );
}

function CoverageBadge({
  coverage,
  labels,
}: {
  coverage: ReturnType<typeof getCoverageInfo>;
  labels: ShopRegionLabels;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        coverage.isFullCoverage
          ? "bg-success/15 text-success"
          : "bg-amber-500/15 text-amber-700",
      )}
      title={
        coverage.isFullCoverage
          ? labels.coverage_full_title
          : labels.coverage_partial_title
      }
    >
      {coverage.isFullCoverage ? "✓ " : "⚠ "}
      {coverage.label}
    </span>
  );
}

function Tag({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5",
        accent
          ? "bg-accent-soft text-accent"
          : "bg-surface-sunken text-fg-muted",
      )}
    >
      {children}
    </span>
  );
}
