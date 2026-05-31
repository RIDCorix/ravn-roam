import { serverApiBase } from "@/lib/server-api-base";
import { SHOP_REGIONS } from "@/lib/storefront-regions";

export interface RegionStat {
  plan_count: number;
  min_retail: number | null;
}

export async function loadRegionStats(): Promise<Record<string, RegionStat>> {
  try {
    const res = await fetch(`${serverApiBase()}/storefront/region-stats`, {
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
