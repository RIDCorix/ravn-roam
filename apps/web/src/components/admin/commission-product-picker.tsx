"use client";

// Compact searchable product picker — used as the labelRight slot for
// the commission slider so picking a SKU drives the live TWD numbers
// shown under each slider segment.
//
// On mount: fetches `?q=<defaultSlug>` once, picks the first matching
// product, and surfaces it via onSelect — so the slider has a sensible
// preview SKU without the operator having to find one.

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { pickI18n, type Product } from "@roam/catalog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function CommissionProductPicker({
  selected,
  onSelect,
  defaultSlug,
}: {
  selected: Product | null;
  onSelect: (p: Product | null) => void;
  defaultSlug?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDefault = React.useRef(false);

  // Default selection — fire once on mount.
  React.useEffect(() => {
    if (didDefault.current || !defaultSlug || selected) return;
    didDefault.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/products?q=${encodeURIComponent(defaultSlug)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { products: Product[] };
        const exact = data.products?.find((p) => p.slug === defaultSlug);
        const fallback = exact ?? data.products?.[0];
        if (fallback) onSelect(fallback);
      } catch {
        /* swallow — preview is optional */
      }
    })();
  }, [defaultSlug, onSelect, selected]);

  // Debounced server-side search while the popover is open.
  React.useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}` : "";
        const res = await fetch(`/api/admin/products${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { products: Product[] };
        setResults((data.products ?? []).slice(0, 50));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const triggerLabel = selected ? labelOf(selected) : "選商品預覽…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 max-w-[220px] gap-1 text-[11px] font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
      >
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋商品名 / slug…"
            className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              載入中…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {query ? "沒有符合的商品" : "輸入關鍵字搜尋"}
            </div>
          ) : (
            results.map((p) => {
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                    isSelected && "bg-muted",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isSelected ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {labelOf(p)}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {fmt(Number(p.pricing?.retail ?? 0))}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function labelOf(p: Product): string {
  const name = pickI18n(p.display_name_i18n, "zh-TW") || p.slug;
  return `${name} · ${p.slug}`;
}

function fmt(n: number): string {
  return `${Math.round(n).toLocaleString()} TWD`;
}

export function readProductCost(p: Product): number {
  const snap = p.pricing?.cost_snapshot as
    | { cost?: number | string; amount?: number | string }
    | undefined;
  if (!snap) return 0;
  const raw = snap.cost ?? snap.amount;
  return raw == null ? 0 : Number(raw);
}
