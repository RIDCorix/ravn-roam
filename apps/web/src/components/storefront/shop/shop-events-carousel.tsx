"use client";

// Horizontal snap-scroll of seasonal events / promotions, fed from the
// `roam_poc.storefront_event` table via /api/storefront/events. The
// crawler (services/api/src/cli/crawl-shop-events.ts) populates the
// table; ops can also hand-author rows.
//
// Tabs above the rail let the user narrow by event type (festival,
// carnival, religious, music, food…). Clicking a tab refetches with a
// `?type=` filter — server-side filter so the rail always shows ≤30
// rows.

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { findRegionBySlug } from "@/lib/storefront-regions";
import { cn } from "@/lib/utils";

const TINT_GRADIENTS: Record<string, string> = {
  warm: "linear-gradient(180deg, rgba(251,113,133,0.0) 30%, rgba(190,18,60,0.65) 100%)",
  cool: "linear-gradient(180deg, rgba(56,189,248,0.0) 30%, rgba(2,132,199,0.65) 100%)",
  violet:
    "linear-gradient(180deg, rgba(167,139,250,0.0) 30%, rgba(88,28,135,0.65) 100%)",
  ember:
    "linear-gradient(180deg, rgba(251,146,60,0.0) 30%, rgba(154,52,18,0.65) 100%)",
  spring:
    "linear-gradient(180deg, rgba(244,114,182,0.0) 30%, rgba(157,23,77,0.55) 100%)",
};

// Tabs ordered by likely click-through. Empty tab key = no filter.
const TABS: Array<{ key: string; label: { "zh-TW": string; en: string } }> = [
  { key: "", label: { "zh-TW": "全部", en: "All" } },
  { key: "festival", label: { "zh-TW": "祭典", en: "Festivals" } },
  { key: "carnival", label: { "zh-TW": "狂歡季", en: "Carnival" } },
  { key: "seasonal", label: { "zh-TW": "季節", en: "Seasonal" } },
  { key: "religious", label: { "zh-TW": "宗教", en: "Religious" } },
  { key: "music", label: { "zh-TW": "音樂", en: "Music" } },
  { key: "sports", label: { "zh-TW": "運動", en: "Sports" } },
  { key: "food", label: { "zh-TW": "美食", en: "Food" } },
  { key: "cultural", label: { "zh-TW": "文化", en: "Cultural" } },
];

interface ApiEvent {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  subtitle_i18n: Record<string, string>;
  event_type: string;
  region_slug: string;
  suggested_days: number | null;
  suggested_gb: number | null;
  start_date: string | null;
  end_date: string | null;
  recurring_month_start: number | null;
  recurring_month_end: number | null;
  cover_image: string | null;
  tint: string | null;
  badge_override: string | null;
}

export function ShopEventsCarousel({
  lang,
  localeKey,
  labels,
  regionSlug,
}: {
  lang: string;
  localeKey: "zh-TW" | "en";
  labels: {
    trending_now: string;
    no_events_category: string;
  };
  regionSlug?: string;
}) {
  const [activeType, setActiveType] = React.useState<string>("");
  const [events, setEvents] = React.useState<ApiEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ upcoming: "1" });
        if (activeType) qs.set("type", activeType);
        if (regionSlug) qs.set("region", regionSlug);
        const res = await fetch(`/api/storefront/events?${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setEvents([]);
          return;
        }
        const data = (await res.json()) as { events: ApiEvent[] };
        if (cancelled) return;
        setEvents(data.events ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeType, regionSlug]);

  // Hide the whole section when there's nothing to show. Tabs include
  // event_type counts that come from the actual catalog, so an empty
  // tab is just hidden rather than showing a sad empty state.
  if (!loading && events.length === 0 && activeType === "") {
    return null;
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
          {labels.trending_now}
        </h2>
        {!loading ? (
          <span className="text-[11px] text-fg-muted">{events.length}</span>
        ) : null}
      </div>

      {/* Tab bar — horizontal scroll on mobile, sticky none */}
      <div className="-mx-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 pl-5 pr-5">
          {TABS.map((tab) => {
            const active = activeType === tab.key;
            return (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => setActiveType(tab.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-fg text-bg"
                    : "bg-surface text-fg-secondary hover:bg-surface-hover",
                )}
                style={!active ? { boxShadow: "var(--shadow-card)" } : undefined}
              >
                {tab.label[localeKey]}
              </button>
            );
          })}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
      </div>

      {/* Event rail */}
      <div className="-mx-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 pl-5 pr-5">
          {loading ? (
            // Skeleton placeholders — keep the rail height stable so
            // tab switches don't jiggle the page.
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-44 w-60 shrink-0 animate-pulse rounded-2xl bg-surface-sunken"
              />
            ))
          ) : events.length === 0 ? (
            <div
              className="flex h-44 w-60 shrink-0 items-center justify-center rounded-2xl bg-surface text-[12px] text-fg-muted"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              {labels.no_events_category}
            </div>
          ) : (
            events.map((evt) => (
              <EventCard
                key={evt.id}
                event={evt}
                lang={lang}
                localeKey={localeKey}
              />
            ))
          )}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function EventCard({
  event,
  lang,
  localeKey,
}: {
  event: ApiEvent;
  lang: string;
  localeKey: "zh-TW" | "en";
}) {
  const region = findRegionBySlug(event.region_slug);
  const params = new URLSearchParams();
  if (event.suggested_days) params.set("days", String(event.suggested_days));
  if (event.suggested_gb) params.set("gb", String(event.suggested_gb));
  const qs = params.toString();
  const href = `/${lang}/shop/${event.region_slug}${qs ? `?${qs}` : ""}`;

  const cover =
    event.cover_image || region?.cover || "/illustrations/cities/europe.jpg";
  const tintBg = event.tint ? TINT_GRADIENTS[event.tint] : undefined;
  const title =
    event.title_i18n?.[localeKey] ?? event.title_i18n?.["zh-TW"] ?? event.slug;
  const subtitle =
    event.subtitle_i18n?.[localeKey] ?? event.subtitle_i18n?.["zh-TW"] ?? "";
  const badge = event.badge_override ?? deriveBadge(event, localeKey);

  return (
    <Link
      href={href}
      className="group relative block h-44 w-60 shrink-0 snap-start overflow-hidden rounded-2xl"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={cover}
        alt=""
        fill
        sizes="240px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {tintBg ? (
        <div className="absolute inset-0" style={{ background: tintBg }} />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      )}
      {badge ? (
        <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg backdrop-blur-sm">
          {badge}
        </span>
      ) : null}
      {region ? (
        <span className="absolute right-2.5 top-2.5 inline-flex max-w-[60%] items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
          <MapPin className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.25} />
          <span className="truncate">{region.name[localeKey]}</span>
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <div className="text-[15px] font-bold leading-tight tracking-[-0.01em] drop-shadow-sm">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-[11px] opacity-90 drop-shadow-sm">
            {subtitle}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

/** Build a short badge from start/end or recurring months. */
function deriveBadge(
  event: ApiEvent,
  localeKey: "zh-TW" | "en",
): string | null {
  if (event.start_date) {
    const d = new Date(event.start_date);
    if (!Number.isNaN(d.getTime())) {
      const m = d.getMonth() + 1;
      return localeKey === "en" ? `${monthName(m, "en")}` : `${m} 月`;
    }
  }
  if (event.recurring_month_start && event.recurring_month_end) {
    if (event.recurring_month_start === event.recurring_month_end) {
      return localeKey === "en"
        ? monthName(event.recurring_month_start, "en")
        : `${event.recurring_month_start} 月`;
    }
    return localeKey === "en"
      ? `${monthName(event.recurring_month_start, "en")}–${monthName(event.recurring_month_end, "en")}`
      : `${event.recurring_month_start}-${event.recurring_month_end} 月`;
  }
  return null;
}

function monthName(m: number, locale: "zh-TW" | "en"): string {
  if (locale === "en") {
    return new Date(2000, m - 1, 1).toLocaleString("en", { month: "short" });
  }
  return `${m}月`;
}
