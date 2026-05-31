// Horizontal scroll of popular shop destinations on the home page.
// Pure server component — links straight into /shop/[region]. Lives on
// home rather than /shop now so the storefront landing keeps its
// discovery feel while /shop stays focused on browsing/search.

import Image from "next/image";
import Link from "next/link";

import {
  REGION_GROUPS,
  findRegionBySlug,
  type ShopRegion,
} from "@/lib/storefront-regions";

interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

export function PopularDestinationsRail({
  lang,
  localeKey,
  stats,
}: {
  lang: string;
  localeKey: "zh-TW" | "en";
  stats: Record<string, RegionStat>;
}) {
  const popular = REGION_GROUPS.find((g) => g.id === "popular");
  const regions = (popular?.slugs ?? [])
    .map((s) => findRegionBySlug(s))
    .filter((r): r is ShopRegion => !!r);
  if (regions.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
          {localeKey === "en" ? "Popular destinations" : "熱門目的地"}
        </h2>
        <Link
          href={`/${lang}/shop`}
          className="text-[12px] font-medium text-fg-secondary hover:text-fg"
        >
          {localeKey === "en" ? "See all" : "看全部"}
        </Link>
      </div>

      <div className="-mx-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 pl-5 pr-5">
          {regions.map((r) => {
            const stat = stats[r.slug];
            return (
              <Link
                key={r.slug}
                href={`/${lang}/shop/${r.slug}`}
                className="group relative block h-36 w-44 shrink-0 snap-start overflow-hidden rounded-2xl"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <Image
                  src={r.cover}
                  alt=""
                  fill
                  sizes="176px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%)",
                  }}
                />
                {stat?.plan_count ? (
                  <span className="absolute right-2 top-2 inline-flex items-center rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-fg backdrop-blur-sm">
                    {stat.plan_count}
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <div className="truncate text-[14.5px] font-semibold drop-shadow-sm">
                    {r.name[localeKey]}
                  </div>
                </div>
              </Link>
            );
          })}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}
