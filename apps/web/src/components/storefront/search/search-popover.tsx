"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

import { MotionButton } from "@/components/storefront/motion";
import {
  REGION_GROUPS,
  findRegionBySlug,
  getRegionSearchText,
  type ShopRegion,
} from "@/lib/storefront-regions";
import { cn } from "@/lib/utils";

export interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

export function useSearchPopover<T>({
  getResults,
  onCommit,
}: {
  getResults: (trimmed: string) => readonly T[];
  onCommit: (result: T) => void;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [focusedIdx, setFocusedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const trimmed = q.trim().toLowerCase();
  const results = React.useMemo(
    () => getResults(trimmed),
    [getResults, trimmed],
  );

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (inputRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function commit(result: T) {
    onCommit(result);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setFocusedIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const result = results[focusedIdx];
      if (result) {
        e.preventDefault();
        commit(result);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return {
    q,
    setQ,
    open,
    setOpen,
    focusedIdx,
    setFocusedIdx,
    inputRef,
    popoverRef,
    trimmed,
    results,
    showPopover: open && trimmed.length > 0,
    commit,
    onKeyDown,
  };
}

export function findMatchingRegions(trimmed: string): ShopRegion[] {
  if (!trimmed) return [];
  const all = REGION_GROUPS.flatMap((g) =>
    g.slugs.map((s) => findRegionBySlug(s)).filter((r): r is ShopRegion => !!r),
  );
  const seen = new Set<string>();
  return all.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    const hay = getRegionSearchText(r).toLowerCase();
    return hay.includes(trimmed);
  });
}

export function SearchGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="px-4 pb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

export function RegionResultRow({
  region,
  localeKey,
  stat,
  labels,
  focused,
  onFocus,
  onSelect,
}: {
  region: ShopRegion;
  localeKey: "zh-TW" | "en";
  stat?: RegionStat;
  labels: {
    plans: string;
    from?: string;
  };
  focused: boolean;
  onFocus: () => void;
  onSelect: () => void;
}) {
  return (
    <MotionButton
      type="button"
      role="option"
      aria-selected={focused}
      onMouseEnter={onFocus}
      onClick={onSelect}
      className={resultClassName(focused)}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={region.cover}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-fg">
          {region.name[localeKey]}
        </div>
        <div className="truncate text-[11px] text-fg-muted">
          {stat?.plan_count
            ? `${stat.plan_count} ${labels.plans}`
            : region.name[localeKey === "en" ? "zh-TW" : "en"]}
          {stat?.min_retail && labels.from
            ? ` · ${labels.from} NT$${Math.round(stat.min_retail).toLocaleString()}`
            : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
    </MotionButton>
  );
}

export function resultClassName(focused: boolean): string {
  return cn(
    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
    focused ? "bg-surface-hover" : "hover:bg-surface-hover",
  );
}
