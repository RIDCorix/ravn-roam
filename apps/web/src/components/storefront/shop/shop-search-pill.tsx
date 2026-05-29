"use client";

// cmdk-style search for the /shop landing. The input opens a popover
// dropdown of matching regions; the browse grid stays visible below.
// When a match is selected (or the top match is implied), we pass its
// slug down to ShopEventsCarousel so "Trending now" filters to that
// region too.
//
// The component owns shared search state and renders the carousel
// itself — the page passes only the sectioned grid as children.

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Search, Sparkles, X } from "lucide-react";

import { MotionButton, popIn } from "@/components/storefront/motion";
import {
  REGION_GROUPS,
  findRegionBySlug,
  type ShopRegion,
} from "@/lib/storefront-regions";
import { cn } from "@/lib/utils";

interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

export function ShopSearchPill({
  lang,
  localeKey,
  labels,
  stats,
  children,
}: {
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: {
    search_placeholder: string;
    clear_search: string;
    ask_lumi: string;
    no_region_matches: string;
    regions_count: string;
    plans: string;
    from: string;
  };
  stats: Record<string, RegionStat>;
  // The sectioned region grid (server component output).
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [focusedIdx, setFocusedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const trimmed = q.trim().toLowerCase();

  const matches: ShopRegion[] = React.useMemo(() => {
    if (!trimmed) return [];
    const all = REGION_GROUPS.flatMap((g) =>
      g.slugs.map((s) => findRegionBySlug(s)).filter((r): r is ShopRegion => !!r),
    );
    const seen = new Set<string>();
    return all.filter((r) => {
      if (seen.has(r.slug)) return false;
      seen.add(r.slug);
      const hay = [r.name["zh-TW"], r.name.en, r.slug, ...r.destinations]
        .join(" ")
        .toLowerCase();
      return hay.includes(trimmed);
    });
  }, [trimmed]);

  React.useEffect(() => {
    setFocusedIdx(0);
  }, [trimmed]);

  // Close the popover when clicking outside.
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

  function commit(region: ShopRegion) {
    router.push(`/${lang}/shop/${region.slug}`);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setFocusedIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const r = matches[focusedIdx];
      if (r) {
        e.preventDefault();
        commit(r);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showPopover = open && trimmed.length > 0;

  return (
    <>
      <div className="px-5">
        <div className="relative">
          <div
            className="flex items-center gap-3 rounded-full bg-surface px-4 py-3 transition-colors focus-within:bg-surface"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Search
              className="h-[18px] w-[18px] shrink-0 text-accent"
              strokeWidth={2.25}
            />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={labels.search_placeholder}
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] font-medium text-fg placeholder:text-fg-muted focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
            {q ? (
              <MotionButton
                type="button"
                aria-label={labels.clear_search}
                onClick={() => {
                  setQ("");
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <X className="h-4 w-4" />
              </MotionButton>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-[12px] font-medium text-fg">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                {labels.ask_lumi}
              </span>
            )}
          </div>

          {/* cmdk-style popover dropdown */}
          <AnimatePresence>
            {showPopover ? (
              <motion.div
                ref={popoverRef}
                {...popIn}
                className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[60vh] overflow-y-auto rounded-2xl bg-surface py-2"
                style={{ boxShadow: "var(--shadow-card-lg, var(--shadow-card))" }}
                role="listbox"
              >
                {matches.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13px] text-fg-muted">
                    {labels.no_region_matches}
                  </div>
                ) : (
                  <>
                    <div className="px-4 pb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-fg-muted">
                      {format(labels.regions_count, {
                        count: String(matches.length),
                      })}
                    </div>
                    {matches.map((r, i) => {
                      const stat = stats[r.slug];
                      const focused = i === focusedIdx;
                      return (
                        <MotionButton
                          key={r.slug}
                          type="button"
                          role="option"
                          aria-selected={focused}
                          onMouseEnter={() => setFocusedIdx(i)}
                          onClick={() => commit(r)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                            focused ? "bg-surface-hover" : "hover:bg-surface-hover",
                          )}
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={r.cover}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold text-fg">
                              {r.name[localeKey]}
                            </div>
                            <div className="truncate text-[11px] text-fg-muted">
                              {stat?.plan_count
                                ? `${stat.plan_count} ${labels.plans}`
                                : r.name[localeKey === "en" ? "zh-TW" : "en"]}
                              {stat?.min_retail
                                ? ` · ${labels.from} NT$${Math.round(stat.min_retail).toLocaleString()}`
                                : ""}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
                        </MotionButton>
                      );
                    })}
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {children}
    </>
  );
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
