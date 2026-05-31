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
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";

import { MotionButton, popIn } from "@/components/storefront/motion";
import {
  RegionResultRow,
  findMatchingRegions,
  useSearchPopover,
  type RegionStat,
} from "@/components/storefront/search/search-popover";
import { formatTemplate } from "@/lib/text-template";

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
  const {
    q,
    setQ,
    setOpen,
    focusedIdx,
    setFocusedIdx,
    inputRef,
    popoverRef,
    results: matches,
    showPopover,
    commit,
    onKeyDown,
  } = useSearchPopover({
    getResults: findMatchingRegions,
    onCommit: (region) => router.push(`/${lang}/shop/${region.slug}`),
  });

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
                setFocusedIdx(0);
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
                  setFocusedIdx(0);
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
                      {formatTemplate(labels.regions_count, {
                        count: String(matches.length),
                      })}
                    </div>
                    {matches.map((r, i) => {
                      const stat = stats[r.slug];
                      const focused = i === focusedIdx;
                      return (
                        <RegionResultRow
                          key={r.slug}
                          region={r}
                          localeKey={localeKey}
                          stat={stat}
                          labels={labels}
                          focused={focused}
                          onFocus={() => setFocusedIdx(i)}
                          onSelect={() => commit(r)}
                        />
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
