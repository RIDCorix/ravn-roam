import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  CreditCard,
  Headphones,
  ShieldCheck,
  Sparkles,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { getDictionary, hasLocale } from "../../dictionaries";
import {
  REGION_GROUPS,
  SHOP_REGIONS,
  findRegionBySlug,
  type ShopRegion,
} from "@/lib/storefront-regions";
import { ShopSearchPill } from "@/components/storefront/shop/shop-search-pill";

export const dynamic = "force-dynamic";

interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

async function loadRegionStats(): Promise<Record<string, RegionStat>> {
  const base = process.env.ROAM_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/storefront/region-stats`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      stats: Array<{ iso: string; plan_count: number; min_retail: number | null }>;
    };
    const byIso = new Map(data.stats.map((s) => [s.iso, s]));
    const out: Record<string, RegionStat> = {};
    for (const region of SHOP_REGIONS) {
      let count = 0;
      let min: number | null = null;
      for (const iso of region.destinations) {
        const s = byIso.get(iso);
        if (!s) continue;
        count = Math.max(count, s.plan_count);
        if (s.min_retail != null) {
          min = min == null ? s.min_retail : Math.min(min, s.min_retail);
        }
      }
      out[region.slug] = { plan_count: count, min_retail: min };
    }
    return out;
  } catch {
    return {};
  }
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.shop;
  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";
  const stats = await loadRegionStats();

  return (
    <div className="min-h-full space-y-5 pb-28">
      {/* Compact header — title smaller than the previous pass so the
          search pill below carries the primary visual weight. */}
      <header className="px-5 pt-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
          {t.title}
        </h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {t.subtitle}
        </p>
      </header>

      <AssuranceStrip labels={t.assurance} />

      <ShopSearchPill
        lang={lang}
        localeKey={localeKey}
        labels={t}
        stats={stats}
      >
        <div className="space-y-7 px-5">
          {REGION_GROUPS.map((group, gi) => {
            const regions = group.slugs
              .map((s) => findRegionBySlug(s))
              .filter((r): r is ShopRegion => !!r);
            if (regions.length === 0) return null;
            const [featured, ...rest] = regions;
            return (
              <section key={group.id} className="space-y-3">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
                    {group.name[localeKey]}
                  </h2>
                  <span className="text-[11px] text-fg-muted">
                    {regions.length}
                  </span>
                </div>

                {gi === 0 && featured ? (
                  <>
                    <FeaturedCard
                      region={featured}
                      lang={lang}
                      localeKey={localeKey}
                      labels={t}
                      stat={stats[featured.slug]}
                    />
                    {rest.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {rest.map((r) => (
                          <RegionCard
                            key={r.slug}
                            region={r}
                            lang={lang}
                            localeKey={localeKey}
                            labels={t}
                            stat={stats[r.slug]}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {regions.map((r) => (
                      <RegionCard
                        key={r.slug}
                        region={r}
                        lang={lang}
                        localeKey={localeKey}
                        labels={t}
                        stat={stats[r.slug]}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </ShopSearchPill>
    </div>
  );
}

function AssuranceStrip({
  labels,
}: {
  labels: {
    prepaid: string;
    install: string;
    topup: string;
    support: string;
  };
}) {
  const items: Array<{ icon: LucideIcon; label: string }> = [
    { icon: CreditCard, label: labels.prepaid },
    { icon: ShieldCheck, label: labels.install },
    { icon: Wifi, label: labels.topup },
    { icon: Headphones, label: labels.support },
  ];

  return (
    <section className="-mt-1 px-5" aria-label="eSIM assurance">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex min-h-[54px] items-center gap-2 rounded-2xl bg-surface px-3 py-2.5"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-softer text-accent">
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="text-[12px] font-semibold leading-snug text-fg">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedCard({
  region,
  lang,
  localeKey,
  labels,
  stat,
}: {
  region: ShopRegion;
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: { featured: string; plans: string; from: string };
  stat: RegionStat | undefined;
}) {
  return (
    <Link
      href={`/${lang}/shop/${region.slug}`}
      className="group relative block aspect-[16/9] overflow-hidden rounded-2xl"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={region.cover}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 700px"
        priority
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg backdrop-blur-sm">
        <Sparkles className="h-2.5 w-2.5 text-accent" />
        {labels.featured}
      </span>
      <div
        className="absolute inset-x-0 bottom-0 pt-12 pb-4 px-4 text-white"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)",
        }}
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[22px] font-bold tracking-[-0.01em] drop-shadow-sm">
              {region.name[localeKey]}
            </h3>
            <div className="mt-1 text-[12px] opacity-90">
              <RegionMeta stat={stat} labels={labels} />
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-90 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function RegionCard({
  region,
  lang,
  localeKey,
  labels,
  stat,
}: {
  region: ShopRegion;
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: { from: string };
  stat: RegionStat | undefined;
}) {
  return (
    <Link
      href={`/${lang}/shop/${region.slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-2xl"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={region.cover}
        alt=""
        fill
        sizes="(max-width: 768px) 50vw, 240px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {stat?.plan_count ? (
        <span className="absolute right-2 top-2 inline-flex items-center rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-fg backdrop-blur-sm">
          {stat.plan_count}
        </span>
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold drop-shadow-sm">
              {region.name[localeKey]}
            </div>
            {stat?.min_retail ? (
              <div className="mt-0.5 text-[10.5px] opacity-90 tabular-nums">
                {labels.from} NT$
                {Math.round(stat.min_retail).toLocaleString()}
              </div>
            ) : null}
          </div>
          <ChevronRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function RegionMeta({
  stat,
  labels,
}: {
  stat: RegionStat | undefined;
  labels: { plans: string; from: string };
}) {
  if (!stat || !stat.plan_count) return null;
  return (
    <span className="tabular-nums">
      {stat.plan_count} {labels.plans}
      {stat.min_retail != null
        ? ` · ${labels.from} NT$${Math.round(stat.min_retail).toLocaleString()}`
        : ""}
    </span>
  );
}
