import {
  Crown,
  Infinity as InfinityIcon,
  Signal,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

import type { ShopProduct } from "@/lib/storefront-api";
import type { ShopRegionLabels } from "./shop-region-types";

export type PlanTier =
  | "titanium"
  | "high-speed"
  | "unlimited"
  | "large"
  | "standard";

export function pickTier(product: ShopProduct): PlanTier {
  const tagSet = new Set(product.tags ?? []);
  if (tagSet.has("tier:titanium-unlimited")) return "titanium";
  if (tagSet.has("tier:high-speed-unlimited")) return "high-speed";
  if (product.data_amount_mb < 0) return "unlimited";
  if (product.data_amount_mb >= 3 * 1024) return "large";
  return "standard";
}

interface TierStyle {
  strip: string;
  iconBg: string;
  iconColor: string;
  Icon: ComponentType<{ className?: string }>;
  ribbon?: { text: string; bg: string };
}

export const TIER_STYLES: Record<PlanTier, TierStyle> = {
  titanium: {
    strip: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    Icon: Crown,
    ribbon: { text: "鈦金", bg: "bg-amber-500 text-white" },
  },
  "high-speed": {
    strip: "linear-gradient(180deg, #6366f1 0%, #4338ca 100%)",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
    Icon: Zap,
    ribbon: { text: "高速", bg: "bg-indigo-500 text-white" },
  },
  unlimited: {
    strip: "linear-gradient(180deg, var(--accent-light) 0%, var(--accent) 100%)",
    iconBg: "bg-accent-softer",
    iconColor: "text-accent",
    Icon: InfinityIcon,
  },
  large: {
    strip: "var(--accent)",
    iconBg: "bg-accent-softer",
    iconColor: "text-accent",
    Icon: Signal,
  },
  standard: {
    strip: "transparent",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    Icon: Signal,
  },
};

export function formatDataSplit(
  amountMb: number,
  perDay: boolean,
  labels: ShopRegionLabels,
): { primary: string; suffix: string } {
  if (amountMb < 0) {
    return {
      primary: "∞",
      suffix: labels.unlimited,
    };
  }
  const perDaySuffix = perDay ? labels.per_day : "";
  if (amountMb >= 1024) {
    const gb = amountMb / 1024;
    return {
      primary: gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1),
      suffix: `GB${perDaySuffix ? " " + perDaySuffix : ""}`,
    };
  }
  return {
    primary: String(amountMb),
    suffix: `MB${perDaySuffix ? " " + perDaySuffix : ""}`,
  };
}

export function formatDataInline(amountMb: number): string {
  if (amountMb < 0) return "Unlimited";
  if (amountMb >= 1024) {
    const gb = amountMb / 1024;
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)}GB`;
  }
  return `${amountMb}MB`;
}

export function dataAmountAsc(a: ShopProduct, b: ShopProduct): number {
  const av = a.data_amount_mb < 0 ? Infinity : a.data_amount_mb;
  const bv = b.data_amount_mb < 0 ? Infinity : b.data_amount_mb;
  return av - bv;
}
