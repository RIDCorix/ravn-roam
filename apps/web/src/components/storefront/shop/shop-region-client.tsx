"use client";

// Region detail: day slider + plans list.
// Loads the region's products once from /api/storefront/products, then
// derives the day axis + per-day plan list client-side. Slider snaps to
// days that actually have products (no dead positions).

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
} from "lucide-react";

import { appSpring, fadeUp } from "@/components/storefront/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ShopProduct,
  ShopProductListResponse,
  StorefrontCheckoutResponse,
} from "@/lib/storefront-api";
import {
  findRegionBySlug,
  getCoverageInfo,
  type ShopRegion,
} from "@/lib/storefront-regions";
import { cn } from "@/lib/utils";
import { formatTemplate } from "@/lib/text-template";

import { CoverageChip } from "./shop-coverage-chip";
import { BuyerNotes, ReadinessPanel } from "./shop-info-panels";
import { ConnectivityReadinessScene } from "./connectivity-readiness-scene";
import { PlanRow } from "./shop-plan-row";
import { dataAmountAsc, formatDataInline } from "./shop-plan-utils";
import type {
  CheckoutProfile,
  CheckoutTripContext,
  CheckoutTripOption,
  ShopRegionLabels,
} from "./shop-region-types";

export function ShopRegionClient({
  lang,
  region,
  labels,
  initialDays,
  initialGb,
  initialCoverageSlugs,
  initialQuantity,
  initialSelectedPlanId,
  checkoutTripContext,
  checkoutProfile,
}: {
  lang: string;
  region: ShopRegion;
  labels: ShopRegionLabels;
  // Pre-fill from URL params — eSIM checklist items, Lumi suggestions
  // and search-bar deep-links all enter through these.
  initialDays?: number;
  initialGb?: number;
  initialCoverageSlugs?: string[];
  initialQuantity?: number;
  initialSelectedPlanId?: string;
  checkoutTripContext?: CheckoutTripContext | null;
  checkoutProfile?: CheckoutProfile | null;
}) {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [days, setDays] = React.useState<number>(initialDays ?? 7);
  // Empty = show plans from all sub-regions; otherwise show any selected
  // coverage bucket. URL deep-links can preselect more than one bucket,
  // e.g. full Europe + Central/Eastern Europe.
  const [filterSlugs, setFilterSlugs] = React.useState<string[]>(
    initialCoverageSlugs ?? [],
  );
  const [checkoutProduct, setCheckoutProduct] =
    React.useState<ShopProduct | null>(null);
  // Once the user touches the slider, the auto-highlight (and its
  // scrollIntoView side-effect) bows out — otherwise every drag would
  // re-trigger the scroll and yank the slider out of view.
  const [userInteracted, setUserInteracted] = React.useState(false);
  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";
  const destinationList = region.destinations.join(",");

  // Initial fetch — all products for this region, sorted by validity_days.
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const qs = new URLSearchParams({
          destinations: destinationList,
        });
        const res = await fetch(`/api/storefront/products?${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("products unavailable");
        const data = (await res.json()) as ShopProductListResponse;
        if (cancelled) return;
        const nextProducts = data.products ?? [];
        setProducts(nextProducts);
        const selectedPlanId = initialSelectedPlanId ?? searchParams.get("plan");
        const selected = selectedPlanId
          ? nextProducts.find((product) => product.id === selectedPlanId)
          : undefined;
        if (selected) setCheckoutProduct(selected);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [destinationList, initialSelectedPlanId, loadAttempt, searchParams]);

  // Available days available in this region's catalog
  const availableDays = React.useMemo(() => {
    const set = new Set<number>();
    for (const p of products) {
      if (p.validity_days > 0) set.add(p.validity_days);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [products]);

  // Snap initial slider position on first products load. If a `days`
  // query param was passed in (deep-link from a checklist or Lumi
  // suggestion), snap to the closest available day; otherwise pick the
  // median so the slider doesn't sit on a dead position.
  const didSnap = React.useRef(false);
  React.useEffect(() => {
    if (didSnap.current || availableDays.length === 0) return;
    didSnap.current = true;
    let nextDays: number;
    if (initialDays != null) {
      let best = availableDays[0]!;
      let bestDelta = Math.abs(best - initialDays);
      for (const d of availableDays) {
        const delta = Math.abs(d - initialDays);
        if (delta < bestDelta) {
          best = d;
          bestDelta = delta;
        }
      }
      nextDays = best;
    } else {
      nextDays = availableDays[Math.floor(availableDays.length / 2)]!;
    }
    const timer = window.setTimeout(() => setDays(nextDays), 0);
    return () => window.clearTimeout(timer);
  }, [availableDays, initialDays]);

  const minDay = availableDays[0] ?? 1;
  const maxDay = availableDays[availableDays.length - 1] ?? 30;

  // Snap to closest available day when slider moves to a position with no
  // products (catches gaps like "no 11D plans, only 10D and 12D").
  function handleDaysChange(raw: number) {
    setUserInteracted(true);
    if (availableDays.length === 0) {
      setDays(raw);
      return;
    }
    let best = availableDays[0]!;
    let bestDelta = Math.abs(best - raw);
    for (const d of availableDays) {
      const delta = Math.abs(d - raw);
      if (delta < bestDelta) {
        best = d;
        bestDelta = delta;
      }
    }
    setDays(best);
  }

  // Sub-regions actually present in this region's catalog. For Japan
  // this is usually empty (all plans cover JP). For Europe we typically
  // see: full-coverage / western-northern-europe / central-eastern-…/
  // spain-camino. We render chips for these so the user can narrow.
  const subRegions = React.useMemo(() => {
    type SR = { slug: string; label: string; count: number };
    const tally = new Map<string, SR>();
    for (const p of products) {
      const ci = getCoverageInfo(
        p.marketing_destinations,
        region,
        localeKey,
      );
      // Use the parent region slug as the bucket for full-coverage plans
      // so they have a chip too.
      const slug = ci.isFullCoverage ? region.slug : ci.matchedSlug;
      if (!slug) continue;
      const existing = tally.get(slug);
      if (existing) existing.count += 1;
      else tally.set(slug, { slug, label: ci.label, count: 1 });
    }
    // Sort: parent region (full coverage) first, then by destination
    // breadth descending so 西歐 (14) lands before 西班牙 (1).
    return Array.from(tally.values()).sort((a, b) => {
      if (a.slug === region.slug) return -1;
      if (b.slug === region.slug) return 1;
      const ar = findRegionBySlug(a.slug);
      const br = findRegionBySlug(b.slug);
      return (br?.destinations.length ?? 0) - (ar?.destinations.length ?? 0);
    });
  }, [products, region, localeKey]);

  const plansForDay = React.useMemo(
    () =>
      products
        .filter((p) => p.validity_days === days)
        .filter((p) => {
          if (filterSlugs.length === 0) return true;
          const ci = getCoverageInfo(p.marketing_destinations, region);
          const slug = ci.isFullCoverage ? region.slug : ci.matchedSlug;
          return Boolean(slug && filterSlugs.includes(slug));
        })
        // Order: full-coverage first, then by descending coverage breadth,
        // then by ascending data amount within the same coverage tier.
        // This avoids burying the "actually covers all of Europe" plan
        // below a bunch of single-country / sub-region options.
        .sort((a, b) => {
          const ai = getCoverageInfo(a.marketing_destinations, region);
          const bi = getCoverageInfo(b.marketing_destinations, region);
          if (ai.isFullCoverage !== bi.isFullCoverage) {
            return ai.isFullCoverage ? -1 : 1;
          }
          const ad = a.marketing_destinations.length;
          const bd = b.marketing_destinations.length;
          if (ad !== bd) return bd - ad;
          return dataAmountAsc(a, b);
        }),
    [products, days, region, filterSlugs],
  );

  function toggleCoverage(slug: string) {
    setFilterSlugs((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    );
  }

  // Highlight the plan that most closely matches `initialGb` so a deep-
  // link from Lumi/checklist drops the user right onto the right tier.
  // Disabled the moment the user moves the slider — see userInteracted.
  const highlightedPlanId = React.useMemo(() => {
    if (userInteracted) return null;
    if (initialGb == null || plansForDay.length === 0) return null;
    const targetMb = initialGb * 1024;
    let bestId: string | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const p of plansForDay) {
      const mb = p.data_amount_mb < 0 ? targetMb * 100 : p.data_amount_mb;
      const delta = Math.abs(mb - targetMb);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestId = p.id;
      }
    }
    return bestId;
  }, [plansForDay, initialGb, userInteracted]);

  return (
    <div className="mx-auto w-full max-w-[780px] space-y-5 px-5 pb-24">
      {loading ? (
        // Native translation may wrap this first-load text node. Keep the
        // disposable loader outside its rewrite pass so React can remove it
        // safely when the catalog resolves; the resulting content remains
        // translatable after it mounts.
        <div
          className="flex items-center justify-center gap-2 py-12 text-[13px] text-fg-muted"
          role="status"
          translate="no"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          {labels.loading_plans}
        </div>
      ) : loadError ? (
        <div className="space-y-4">
          <ConnectivityReadinessScene
            state="error"
            title={labels.plans_load_error}
            description={labels.plans_load_error_body}
          />
          <Button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="h-11 w-full rounded-full bg-accent text-white hover:bg-accent/90">
            {labels.try_again}
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="space-y-4">
          <ConnectivityReadinessScene state="no-coverage" title={labels.no_coverage_title} description={labels.no_coverage_body} />
          <Button type="button" variant="secondary" onClick={() => window.location.assign(`/${lang}/shop`)} className="h-11 w-full rounded-full">
            {labels.browse_destinations}
          </Button>
        </div>
      ) : (
        <>
          <ReadinessPanel labels={labels} />

          {/* Day slider */}
          <section
            className="rounded-2xl bg-surface p-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                {labels.trip_length}
              </div>
              <div className="text-[12px] tabular-nums text-fg-muted">
                {availableDays.length} {labels.options}
              </div>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[42px] font-semibold leading-none tracking-[-0.02em] text-fg tabular-nums">
                {days}
              </span>
              <span className="pb-1 text-[14px] text-fg-muted">
                {labels.day_unit}
              </span>
            </div>
            <div className="relative mt-3">
              <input
                type="range"
                min={minDay}
                max={maxDay}
                step={1}
                value={days}
                onChange={(e) => handleDaysChange(Number(e.target.value))}
                aria-label={labels.day_aria}
                className="shop-days-slider relative z-10 w-full"
              />
              {/* Tick marks for days that actually have plans — gives
                  the user a quick read on where catalog density is. */}
              {availableDays.length > 1 && maxDay > minDay ? (
                <div
                  className="pointer-events-none absolute inset-x-[11px] top-1/2 -z-0 h-1.5 -translate-y-1/2"
                  aria-hidden
                >
                  {availableDays.map((d) => {
                    const pct = ((d - minDay) / (maxDay - minDay)) * 100;
                    const isSelected = d === days;
                    return (
                      <span
                        key={d}
                        className={cn(
                          "absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
                          isSelected ? "bg-accent" : "bg-accent/30",
                        )}
                        style={{ left: `${pct}%` }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-fg-muted tabular-nums">
              <span>{minDay} {labels.day_unit}</span>
              <span>{maxDay} {labels.day_unit}</span>
            </div>
          </section>

          {/* Coverage filter chips — only shown when 2+ sub-regions
              exist in this region's catalog (so Japan / Korea pages
              don't show a pointless 1-chip bar). */}
          {subRegions.length >= 2 ? (
            <motion.section
              {...fadeUp}
              transition={reducedMotion ? { duration: 0 } : appSpring}
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            >
              <CoverageChip
                label={labels.all}
                active={filterSlugs.length === 0}
                onClick={() => setFilterSlugs([])}
              />
              {subRegions.map((sr) => (
                <CoverageChip
                  key={sr.slug}
                  label={sr.label}
                  count={sr.count}
                  active={filterSlugs.includes(sr.slug)}
                  full={sr.slug === region.slug}
                  onClick={() => toggleCoverage(sr.slug)}
                />
              ))}
            </motion.section>
          ) : null}

          {/* Plans list */}
          <section className="space-y-2">
            <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              {formatTemplate(labels.plans_for_days, {
                days: String(days),
                count: String(plansForDay.length),
              })}
            </div>
            {plansForDay.length === 0 ? (
              <div
                className="rounded-xl bg-surface px-4 py-6 text-center text-[13px] text-fg-muted"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                {labels.no_plan_duration}
              </div>
            ) : (
              <>
                {plansForDay.map((p) => (
                <motion.div
                  key={p.id}
                  {...fadeUp}
                  transition={reducedMotion ? { duration: 0 } : appSpring}
                >
                  <PlanRow
                    product={p}
                    localeKey={localeKey}
                    labels={labels}
                    highlighted={p.id === highlightedPlanId}
                    region={region}
                    onSelect={() => setCheckoutProduct(p)}
                  />
                </motion.div>
                ))}
              </>
            )}
          </section>

          <BuyerNotes labels={labels} />
          <CheckoutSheet
            product={checkoutProduct}
            lang={lang}
            localeKey={localeKey}
            labels={labels}
            checkoutProfile={checkoutProfile}
            initialQuantity={initialQuantity}
            tripContext={checkoutTripContext}
            onOpenChange={(open) => {
              if (!open) setCheckoutProduct(null);
            }}
          />
        </>
      )}
    </div>
  );
}

type CheckoutSheetProps = {
  product: ShopProduct | null;
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: ShopRegionLabels;
  checkoutProfile?: CheckoutProfile | null;
  initialQuantity?: number;
  tripContext?: CheckoutTripContext | null;
  onOpenChange: (open: boolean) => void;
};

type CheckoutSheetContentProps = Omit<CheckoutSheetProps, "product"> & {
  product: ShopProduct;
};

function CheckoutSheet(props: CheckoutSheetProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!props.product) return null;
  if (!props.checkoutProfile) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("plan", props.product.id);
    const returnTo = `${pathname}${params.size ? `?${params}` : ""}`;
    return (
      <Sheet open onOpenChange={props.onOpenChange}>
        <SheetContent side="bottom" className="mx-auto max-w-[430px] rounded-t-[28px] border-x bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <SheetHeader className="px-0"><SheetTitle className="text-[20px] tracking-[-0.02em] text-fg">{props.labels.sign_in_to_continue}</SheetTitle><SheetDescription className="text-[13px] leading-relaxed text-fg-muted">{props.labels.sign_in_body}</SheetDescription></SheetHeader>
          <SheetFooter className="px-0 pt-5"><Button asChild className="h-12 w-full rounded-full bg-accent text-white hover:bg-accent/90"><Link href={`/${props.lang}/login?next=${encodeURIComponent(returnTo)}`}>{props.labels.sign_in_to_buy}</Link></Button></SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <CheckoutSheetContent
      key={props.product.id}
      {...props}
      product={props.product}
    />
  );
}

function CheckoutSheetContent({
  product,
  localeKey,
  labels,
  checkoutProfile,
  initialQuantity,
  tripContext,
  onOpenChange,
}: CheckoutSheetContentProps) {
  const [email, setEmail] = React.useState(checkoutProfile?.email ?? "");
  const [name, setName] = React.useState(checkoutProfile?.name ?? "");
  const [quantity, setQuantity] = React.useState(initialQuantity ?? 1);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] =
    React.useState<StorefrontCheckoutResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sharing, setSharing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [tripOptions, setTripOptions] = React.useState<CheckoutTripOption[]>([]);
  const [selectedTripId, setSelectedTripId] = React.useState(
    tripContext?.tripId ?? "",
  );

  React.useEffect(() => {
    if (!result || tripContext?.tripId) return;
    let cancelled = false;
    async function loadTrips() {
      const res = await fetch("/api/storefront/trips", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as {
        trips?: Array<{ id: string; title: string }>;
      };
      if (cancelled) return;
      const trips = data.trips ?? [];
      setTripOptions(trips.map((trip) => ({ id: trip.id, title: trip.title })));
      if (!selectedTripId && trips[0]) setSelectedTripId(trips[0].id);
    }
    void loadTrips();
    return () => {
      cancelled = true;
    };
  }, [result, selectedTripId, tripContext?.tripId]);

  const productName =
    product.display_name_i18n[localeKey] ??
    product.display_name_i18n["zh-TW"] ??
    product.slug;
  const unitPrice = Number(product.pricing?.retail ?? 0);
  const currency = product.pricing?.currency ?? "TWD";
  const total = unitPrice * quantity;

  async function submit() {
    const currentProduct = product;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: currentProduct.id,
          quantity,
          customer_email: email,
          customer_name: name.trim() || null,
          trip_id: tripContext?.tripId ?? null,
          checklist_item_id: tripContext?.checklistItemId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.details === "string"
            ? data.details
            : typeof data?.error === "string"
              ? data.error
              : labels.checkout_error,
        );
      }
      setResult(data as StorefrontCheckoutResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.checkout_error);
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshOrder() {
    if (!result) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/storefront/orders/${result.order.id}/refresh`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : labels.checkout_error,
        );
      }
      setResult(data as StorefrontCheckoutResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.checkout_error);
    } finally {
      setRefreshing(false);
    }
  }

  async function shareToCompanions() {
    const targetTripId = tripContext?.tripId ?? selectedTripId;
    if (!result || !targetTripId) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/storefront/orders/${result.order.id}/share-esims`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip_id: targetTripId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : labels.checkout_error,
        );
      }
      setShared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.checkout_error);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[88vh] max-w-[430px] overflow-y-auto rounded-t-[28px] border-x bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2"
      >
        <SheetHeader className="px-0 pb-1 pt-4">
          <SheetTitle className="text-[20px] tracking-[-0.02em] text-fg">
            {labels.checkout_title}
          </SheetTitle>
          <SheetDescription className="text-[12px] leading-relaxed text-fg-muted">
            {labels.checkout_body}
          </SheetDescription>
        </SheetHeader>

        <div className="rounded-2xl bg-surface-sunken p-4">
          <div className="text-[15px] font-semibold text-fg">{productName}</div>
          <div className="mt-1 text-[12px] text-fg-muted">
            {product.validity_days} {labels.day_unit} ·{" "}
            {formatDataInline(product.data_amount_mb)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-fg-muted">{labels.checkout_total}</span>
            <span className="text-[22px] font-bold tabular-nums text-fg">
              {currency} {Math.round(total).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="checkout-email" className="text-fg-secondary">
              {labels.checkout_email}
            </Label>
            <Input
              id="checkout-email"
              type="email"
              value={email}
              placeholder={labels.checkout_email_placeholder}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl bg-white text-[16px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-name" className="text-fg-secondary">
              {labels.checkout_name}
            </Label>
            <Input
              id="checkout-name"
              value={name}
              placeholder={labels.checkout_name_placeholder}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl bg-white text-[16px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-quantity" className="text-fg-secondary">
              {labels.checkout_quantity}
            </Label>
            <Input
              id="checkout-quantity"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                )
              }
              className="h-11 rounded-xl bg-white text-[16px]"
            />
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-accent/20 bg-accent-softer p-4 text-[13px] text-fg-secondary">
            <div className="font-semibold text-accent">
              {labels.checkout_success}
            </div>
            <div className="mt-1">
              {labels.order_number}: {result.order.order_number}
            </div>
            <div className="mt-1">
              {result.order.status === "fulfilled"
                ? labels.checkout_fulfilled
                : labels.checkout_pending}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-fg-muted">
              {labels.checkout_where_to_find}
            </div>
            {result.order.status !== "fulfilled" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={refreshOrder}
                disabled={refreshing}
                className="mt-3 h-9 rounded-full bg-white text-accent hover:bg-white/80"
              >
                {refreshing ? labels.checkout_refreshing : labels.checkout_refresh}
              </Button>
            ) : null}
            {!tripContext && tripOptions.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <Label className="text-[12px] text-fg-secondary">
                  {labels.checkout_select_trip}
                </Label>
                <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                  <SelectTrigger className="h-10 w-full rounded-xl bg-white">
                    <SelectValue placeholder={labels.checkout_trip_placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {tripOptions.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {trip.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {(tripContext || selectedTripId) && result.order.status === "fulfilled" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={shareToCompanions}
                disabled={sharing || shared || !(tripContext?.tripId ?? selectedTripId)}
                className="mt-3 h-9 rounded-full bg-white text-accent hover:bg-white/80"
              >
                {sharing
                  ? labels.checkout_sharing
                  : shared
                    ? labels.checkout_shared
                    : labels.checkout_share_to_companions}
              </Button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] leading-relaxed text-red-700">
            {labels.checkout_error}
            <div className="mt-1 break-words opacity-80">{error}</div>
          </div>
        ) : null}

        {!result ? (
          <SheetFooter className="px-0 pb-0 pt-1">
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || !email.trim()}
              className="h-12 rounded-full bg-accent text-[15px] font-semibold text-white hover:bg-accent/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {labels.checkout_submitting}
                </>
              ) : (
                labels.checkout_submit
              )}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
