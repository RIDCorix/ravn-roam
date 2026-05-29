"use client";

// Region detail: day slider + plans list.
// Loads the region's products once from /api/storefront/products, then
// derives the day axis + per-day plan list client-side. Slider snaps to
// days that actually have products (no dead positions).

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crown,
  Headphones,
  Infinity as InfinityIcon,
  Loader2,
  Signal,
  Smartphone,
  Wifi,
  Zap,
  type LucideIcon,
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

interface ShopRegionLabels {
  no_plans: string;
  trip_length: string;
  options: string;
  day_unit: string;
  day_aria: string;
  all: string;
  plans_for_days: string;
  no_plan_duration: string;
  tier_titanium: string;
  tier_high_speed: string;
  unlimited: string;
  per_day: string;
  throttled: string;
  coverage_full_title: string;
  coverage_partial_title: string;
  readiness_title: string;
  readiness_phone: string;
  readiness_install: string;
  readiness_roaming: string;
  readiness_support: string;
  buyer_note_title: string;
  buyer_note_data_only: string;
  buyer_note_activation: string;
  buyer_note_coverage: string;
  buy: string;
  checkout_title: string;
  checkout_body: string;
  checkout_email: string;
  checkout_email_placeholder: string;
  checkout_name: string;
  checkout_name_placeholder: string;
  checkout_quantity: string;
  checkout_total: string;
  checkout_submit: string;
  checkout_submitting: string;
  checkout_success: string;
  checkout_pending: string;
  checkout_fulfilled: string;
  checkout_error: string;
  checkout_refresh: string;
  checkout_refreshing: string;
  checkout_where_to_find: string;
  checkout_select_trip: string;
  checkout_trip_placeholder: string;
  checkout_share_to_companions: string;
  checkout_sharing: string;
  checkout_shared: string;
  order_number: string;
}

interface CheckoutProfile {
  email: string;
  name: string;
}

interface CheckoutTripContext {
  tripId: string;
  checklistItemId?: string;
}

interface CheckoutTripOption {
  id: string;
  title: string;
}

export function ShopRegionClient({
  lang,
  region,
  labels,
  initialDays,
  initialGb,
  initialCoverageSlugs,
  initialQuantity,
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
  checkoutTripContext?: CheckoutTripContext | null;
  checkoutProfile?: CheckoutProfile | null;
}) {
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
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
      try {
        const qs = new URLSearchParams({
          destinations: destinationList,
        });
        const res = await fetch(`/api/storefront/products?${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setProducts([]);
          return;
        }
        const data = (await res.json()) as ShopProductListResponse;
        if (cancelled) return;
        setProducts(data.products ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [destinationList]);

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
    <div className="space-y-5 px-5 pb-24">
      {loading ? (
        <div className="flex items-center justify-center py-12 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div
          className="rounded-2xl bg-surface px-5 py-8 text-center"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="text-[15px] font-medium text-fg">
            {labels.no_plans}
          </div>
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
              layout
              {...fadeUp}
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
          <motion.section layout className="space-y-2">
            <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              {format(labels.plans_for_days, {
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
              <AnimatePresence mode="popLayout">
                {plansForDay.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    {...fadeUp}
                    transition={appSpring}
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
              </AnimatePresence>
            )}
          </motion.section>

          <BuyerNotes labels={labels} />
          <CheckoutSheet
            product={checkoutProduct}
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

function ReadinessPanel({ labels }: { labels: ShopRegionLabels }) {
  const items: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Smartphone, text: labels.readiness_phone },
    { icon: CheckCircle2, text: labels.readiness_install },
    { icon: Wifi, text: labels.readiness_roaming },
    { icon: Headphones, text: labels.readiness_support },
  ];

  return (
    <section
      className="rounded-2xl bg-surface p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-softer text-accent">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.3} />
        </span>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
          {labels.readiness_title}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex min-h-[58px] items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2.5"
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="text-[11.5px] font-medium leading-snug text-fg-secondary">
              {text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BuyerNotes({ labels }: { labels: ShopRegionLabels }) {
  const items = [
    labels.buyer_note_data_only,
    labels.buyer_note_activation,
    labels.buyer_note_coverage,
  ];

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
          {labels.buyer_note_title}
        </h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[12px] leading-relaxed text-fg-secondary"
          >
            <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-amber-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Tier-based visual identity. Drives the left-edge color strip, icon
// background and badge so titanium / high-speed / standard plans don't
// blur together in a long list.
type PlanTier = "titanium" | "high-speed" | "unlimited" | "large" | "standard";
function pickTier(product: ShopProduct): PlanTier {
  const tagSet = new Set(product.tags ?? []);
  if (tagSet.has("tier:titanium-unlimited")) return "titanium";
  if (tagSet.has("tier:high-speed-unlimited")) return "high-speed";
  if (product.data_amount_mb < 0) return "unlimited";
  if (product.data_amount_mb >= 3 * 1024) return "large";
  return "standard";
}

interface TierStyle {
  strip: string; // CSS background for the left vertical accent
  iconBg: string; // tailwind class for the icon halo
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  ribbon?: { text: string; bg: string };
}

const TIER_STYLES: Record<PlanTier, TierStyle> = {
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

function PlanRow({
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
      {/* Tier strip — vertical color bar on the left edge */}
      <div
        aria-hidden
        className="w-1 shrink-0"
        style={{ background: tierStyle.strip }}
      />

      {/* Content column */}
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
          {/* Headline: big data amount + small unit + tier ribbon */}
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

          {/* Meta row: coverage + tags */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <CoverageBadge coverage={coverage} labels={labels} />
            {isUnlimited && !tierStyle.ribbon ? <Tag accent>{labels.unlimited}</Tag> : null}
            {isThrottled ? <Tag>{labels.throttled}</Tag> : null}
          </div>
        </div>
      </div>

      {/* Price + CTA */}
      <div className="flex shrink-0 items-center gap-2 pr-3 pl-1">
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

function CheckoutSheet({
  product,
  localeKey,
  labels,
  checkoutProfile,
  initialQuantity,
  tripContext,
  onOpenChange,
}: {
  product: ShopProduct | null;
  localeKey: "zh-TW" | "en";
  labels: ShopRegionLabels;
  checkoutProfile?: CheckoutProfile | null;
  initialQuantity?: number;
  tripContext?: CheckoutTripContext | null;
  onOpenChange: (open: boolean) => void;
}) {
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
    if (!product) {
      setResult(null);
      setError(null);
      setSubmitting(false);
      setQuantity(initialQuantity ?? 1);
      setEmail(checkoutProfile?.email ?? "");
      setName(checkoutProfile?.name ?? "");
      setSharing(false);
      setRefreshing(false);
      setShared(false);
      setTripOptions([]);
      setSelectedTripId(tripContext?.tripId ?? "");
    }
  }, [
    product,
    checkoutProfile?.email,
    checkoutProfile?.name,
    initialQuantity,
    tripContext?.tripId,
  ]);

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

  if (!product) return null;

  const productName =
    product.display_name_i18n[localeKey] ??
    product.display_name_i18n["zh-TW"] ??
    product.slug;
  const unitPrice = Number(product.pricing?.retail ?? 0);
  const currency = product.pricing?.currency ?? "TWD";
  const total = unitPrice * quantity;

  async function submit() {
    const currentProduct = product;
    if (!currentProduct) return;
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
    <Sheet open={Boolean(product)} onOpenChange={onOpenChange}>
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

/** Split the formatted data into a big primary number + small suffix. */
function formatDataSplit(
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

function formatDataInline(amountMb: number): string {
  if (amountMb < 0) return "Unlimited";
  if (amountMb >= 1024) {
    const gb = amountMb / 1024;
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)}GB`;
  }
  return `${amountMb}MB`;
}

function CoverageChip({
  label,
  count,
  active,
  full,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  full?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      whileHover={{ y: -1, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={appSpring}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? full
            ? "bg-success text-white"
            : "bg-accent text-white"
          : "bg-surface text-fg-secondary hover:bg-surface-hover",
      )}
      style={!active ? { boxShadow: "var(--shadow-card)" } : undefined}
    >
      {full && active ? <span className="text-[10px]">✓</span> : null}
      {label}
      {count != null ? (
        <span
          className={cn(
            "text-[10px] tabular-nums",
            active ? "opacity-80" : "text-fg-muted",
          )}
        >
          {count}
        </span>
      ) : null}
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

function dataAmountAsc(a: ShopProduct, b: ShopProduct): number {
  // Unlimited (-1) sorts last; otherwise ascending by MB.
  const av = a.data_amount_mb < 0 ? Infinity : a.data_amount_mb;
  const bv = b.data_amount_mb < 0 ? Infinity : b.data_amount_mb;
  return av - bv;
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
