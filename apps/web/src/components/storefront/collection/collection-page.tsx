"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  ChevronDown,
  Globe2,
  Heart,
  ListFilter,
  Loader2,
  LockKeyhole,
  MapPin,
  Share2,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  StorefrontTabs,
  StorefrontTabsList,
  StorefrontTabsTrigger,
} from "@/components/storefront/storefront-tabs";
import { Button } from "@/components/ui/button";
import {
  type CollectionDashboard,
  seedCollectionDashboard,
  fetchCollectionDashboard,
  sampleCollectionDashboard,
  type TravelerPlace,
} from "@/lib/collection-api";
import { cn } from "@/lib/utils";

export type CollectionLabels = {
  title: string;
  tabs: {
    visited: string;
    wishlist: string;
  };
  share: string;
  seed: string;
  seeding: string;
  sign_in_title: string;
  sign_in_body: string;
  sign_in_cta: string;
  empty_title: string;
  empty_body: string;
  stats: {
    countries: string;
    cities: string;
    places: string;
    world: string;
    photos: string;
    achievements: string;
  };
  achievements_title: string;
  achievements_all: string;
  visited_title: string;
  filter_type: string;
  filter_time: string;
  load_more: string;
  progress_title: string;
  progress_detail: string;
  level_name: string;
  xp_to_next: string;
  world_map_title: string;
  world_map_link: string;
  map_legend_unlocked: string;
  map_legend_visited: string;
  map_legend_locked: string;
  continent_title: string;
  recent_title: string;
  recent_all: string;
  kind: Record<string, string>;
  continents: Record<string, string>;
};

export function CollectionPage({
  lang,
  labels,
}: {
  lang: string;
  labels: CollectionLabels;
}) {
  const [dashboard, setDashboard] = useState<CollectionDashboard | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [busySeed, setBusySeed] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCollectionDashboard()
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
        setIsPreview(false);
        setStatus("ready");
      })
      .catch((error: Error & { status?: number }) => {
        if (cancelled) return;
        if (error.status === 401) {
          setDashboard(sampleCollectionDashboard());
          setIsPreview(true);
          setStatus("ready");
          return;
        }
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function seed() {
    if (busySeed) return;
    setBusySeed(true);
    try {
      const data = await seedCollectionDashboard();
      setDashboard(data);
      setIsPreview(false);
      setStatus("ready");
    } finally {
      setBusySeed(false);
    }
  }

  if (status === "loading") {
    return (
      <CollectionFrame>
        <div className="grid min-h-[620px] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      </CollectionFrame>
    );
  }

  if (status === "unauthorized") {
    return (
      <CollectionFrame>
        <div className="mx-auto grid min-h-[620px] max-w-[560px] place-items-center text-center">
          <div className="rounded-[28px] border border-white/70 bg-white/86 p-8 shadow-[0_24px_70px_-48px_rgba(32,41,46,0.55)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <LockKeyhole className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-[30px] font-semibold tracking-[-0.02em]">
              {labels.sign_in_title}
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-fg-muted">
              {labels.sign_in_body}
            </p>
            <Button asChild className="mt-6 rounded-xl bg-fg text-white">
              <Link href={`/${lang}/login?next=/${lang}/me`}>
                {labels.sign_in_cta}
              </Link>
            </Button>
          </div>
        </div>
      </CollectionFrame>
    );
  }

  if (!dashboard || status === "error") {
    return (
      <CollectionFrame>
        <div className="grid min-h-[620px] place-items-center text-[14px] text-fg-muted">
          {labels.empty_body}
        </div>
      </CollectionFrame>
    );
  }

  const hasData = dashboard.places.length > 0;

  return (
    <CollectionFrame>
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
        <main className="min-w-0">
          <header className="flex flex-col gap-5 border-b border-divider pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-fg sm:text-[42px]">
                {labels.title}
              </h1>
              <StorefrontTabs defaultValue="visited" className="mt-5">
                <StorefrontTabsList className="gap-9">
                  <StorefrontTabsTrigger value="visited" className="text-[16px] text-rose-600 data-[state=active]:text-rose-600 after:bg-rose-500">
                    {labels.tabs.visited}
                  </StorefrontTabsTrigger>
                  <StorefrontTabsTrigger value="wishlist" className="text-[16px]">
                    {labels.tabs.wishlist}
                  </StorefrontTabsTrigger>
                </StorefrontTabsList>
              </StorefrontTabs>
            </div>
            <div className="flex gap-3">
              {!hasData ? (
                <Button
                  type="button"
                  onClick={() => void seed()}
                  disabled={busySeed}
                  className="h-12 rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700"
                >
                  {busySeed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busySeed ? labels.seeding : labels.seed}
                </Button>
              ) : null}
              <Button variant="outline" className="h-12 rounded-xl bg-white">
                <Share2 className="h-4 w-4" />
                {labels.share}
              </Button>
            </div>
          </header>

          {!hasData ? (
            <EmptyState labels={labels} onSeed={seed} busy={busySeed} />
          ) : (
            <>
              {isPreview ? <PreviewNotice labels={labels} lang={lang} /> : null}
              <StatsStrip dashboard={dashboard} labels={labels} />
              <AchievementsStrip dashboard={dashboard} labels={labels} lang={lang} />
              <PlacesSection dashboard={dashboard} labels={labels} lang={lang} />
            </>
          )}
        </main>

        <aside className="min-w-0 space-y-5">
          <LevelCard dashboard={dashboard} labels={labels} />
          <WorldUnlockCard dashboard={dashboard} labels={labels} />
          <ContinentCard dashboard={dashboard} labels={labels} />
          <RecentFootprints dashboard={dashboard} labels={labels} lang={lang} />
        </aside>
      </div>
    </CollectionFrame>
  );
}

function PreviewNotice({
  labels,
  lang,
}: {
  labels: CollectionLabels;
  lang: string;
}) {
  return (
    <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/78 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-[680px] text-[14px] leading-6 text-fg-muted">
        {labels.sign_in_body}
      </p>
      <Button asChild className="h-10 shrink-0 rounded-xl bg-fg px-4 text-white">
        <Link href={`/${lang}/login?next=/${lang}/me`}>
          {labels.sign_in_cta}
        </Link>
      </Button>
    </section>
  );
}

function CollectionFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,#fbfaf7_0%,#f5f2ec_100%)] px-5 pb-10 pt-28 text-fg sm:px-8">
      {children}
    </div>
  );
}

function EmptyState({
  labels,
  onSeed,
  busy,
}: {
  labels: CollectionLabels;
  onSeed: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="mt-8 rounded-[28px] border border-white/72 bg-white/82 p-8 text-center shadow-[0_24px_70px_-50px_rgba(32,41,46,0.55)]">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
        {labels.empty_title}
      </h2>
      <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-fg-muted">
        {labels.empty_body}
      </p>
      <Button
        type="button"
        onClick={() => void onSeed()}
        disabled={busy}
        className="mt-6 rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? labels.seeding : labels.seed}
      </Button>
    </section>
  );
}

function StatsStrip({
  dashboard,
  labels,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
}) {
  const stats = [
    { icon: Globe2, label: labels.stats.countries, value: `${dashboard.stats.visited_countries} / 195` },
    { icon: MapPin, label: labels.stats.cities, value: String(dashboard.stats.visited_cities) },
    { icon: Camera, label: labels.stats.places, value: String(dashboard.stats.visited_places) },
  ];
  return (
    <section className="mt-7 rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-50px_rgba(32,41,46,0.55)]">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_220px]">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 border-divider md:border-r md:last:border-r-0">
            <stat.icon className="h-8 w-8 text-fg-muted" />
            <div>
              <p className="text-[13px] font-semibold text-fg-muted">{stat.label}</p>
              <p className="text-[28px] font-semibold tracking-[-0.03em]">{stat.value}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-4">
          <Ring value={dashboard.stats.world_progress_percent} />
          <div>
            <p className="text-[13px] font-semibold text-fg-muted">{labels.stats.world}</p>
            <p className="text-[28px] font-semibold tracking-[-0.03em]">
              {dashboard.stats.world_progress_percent}%
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-rose-600"
          style={{ width: `${Math.min(100, dashboard.stats.world_progress_percent)}%` }}
        />
      </div>
    </section>
  );
}

function AchievementsStrip({
  dashboard,
  labels,
  lang,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
  lang: string;
}) {
  return (
    <section className="mt-5 rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-50px_rgba(32,41,46,0.55)]">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-[17px] font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <Trophy className="h-4 w-4" />
          </span>
          {labels.achievements_title}
        </h2>
        <button type="button" className="text-[13px] font-semibold text-rose-600">
          {labels.achievements_all}
        </button>
      </div>
      <div className="mt-5 flex gap-8 overflow-x-auto pb-2">
        {dashboard.achievements.slice(0, 6).map((achievement) => (
          <article key={achievement.id} className="min-w-[118px] text-center">
            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-rose-200 bg-rose-50 shadow-sm">
              {achievement.badge_image ? (
                <Image src={achievement.badge_image} alt="" fill sizes="64px" className="object-cover" unoptimized />
              ) : null}
            </div>
            <p className="mt-2 line-clamp-1 text-[13px] font-semibold">
              {achievement.title}
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              {formatDate(achievement.unlocked_at, lang)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlacesSection({
  dashboard,
  labels,
  lang,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
  lang: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
          {labels.visited_title}
        </h2>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 rounded-xl bg-white">
            {labels.filter_type}
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-11 rounded-xl bg-white">
            {labels.filter_time}
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-lg" className="h-11 w-11 rounded-xl bg-white">
            <ListFilter className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.visited_places.slice(0, 8).map((place) => (
          <PlaceCard key={place.id} place={place} labels={labels} lang={lang} />
        ))}
      </div>
      <div className="mt-7 flex justify-center">
        <Button variant="outline" className="h-12 min-w-[190px] rounded-xl bg-white">
          {labels.load_more}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function PlaceCard({
  place,
  labels,
  lang,
}: {
  place: TravelerPlace;
  labels: CollectionLabels;
  lang: string;
}) {
  const name = localizedPlaceName(place, lang);
  return (
    <article className="group relative min-h-[270px] overflow-hidden rounded-[18px] bg-fg text-white shadow-[0_22px_52px_-34px_rgba(32,41,46,0.75)]">
      {place.cover_image ? (
        <Image src={place.cover_image} alt="" fill sizes="320px" className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.74))]" />
      <span className="absolute left-4 top-4 rounded-lg bg-white/78 px-3 py-1 text-[12px] font-semibold text-fg backdrop-blur">
        {labels.kind[place.kind] ?? labels.kind.city}
      </span>
      <button
        type="button"
        aria-label="Favorite"
        className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
      >
        <Heart className={cn("h-5 w-5", place.favorite && "fill-rose-500 text-rose-500")} />
      </button>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">
          {name}
        </h3>
        <p className="mt-1 text-[13px] font-semibold text-white/84">
          {place.country} · {labels.continents[place.continent] ?? place.continent}
        </p>
        <p className="mt-2 text-[13px] text-white/78">
          {formatDate(place.visited_at, lang)}
        </p>
      </div>
    </article>
  );
}

function LevelCard({
  dashboard,
  labels,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
}) {
  const profile = dashboard.profile;
  const percent = Math.round((profile.xp_into_level / profile.xp_to_next) * 100);
  const stats: Array<[LucideIcon, number, string]> = [
    [Globe2, dashboard.stats.visited_countries, labels.stats.countries],
    [MapPin, dashboard.stats.visited_cities, labels.stats.cities],
    [Camera, dashboard.stats.photos, labels.stats.photos],
    [Trophy, dashboard.stats.achievements, labels.stats.achievements],
  ];
  return (
    <section className="rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">{labels.progress_title}</h2>
        <button type="button" className="text-[13px] font-semibold text-fg-muted">
          {labels.progress_detail}
        </button>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <div className="grid h-24 w-24 place-items-center bg-rose-600 text-center text-white [clip-path:polygon(50%_0%,92%_24%,92%_76%,50%_100%,8%_76%,8%_24%)]">
          <span className="text-[24px] font-semibold">Lv. {profile.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-semibold">{labels.level_name}</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            {labels.xp_to_next.replace("{xp}", String(profile.xp_to_next - profile.xp_into_level))}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-rose-100">
            <div className="h-full rounded-full bg-rose-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-right text-[12px] font-semibold text-fg-muted">
            {profile.xp_into_level.toLocaleString()} / {profile.xp_to_next.toLocaleString()} XP
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {stats.map(([Icon, value, label]) => (
          <div key={String(label)} className="rounded-xl border border-divider bg-white p-3 text-center">
            <Icon className="mx-auto h-5 w-5 text-fg-muted" />
            <p className="mt-2 text-[18px] font-semibold">{String(value)}</p>
            <p className="mt-1 text-[11px] font-semibold text-fg-muted">{String(label)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorldUnlockCard({
  dashboard,
  labels,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
}) {
  const points = dashboard.visited_places.slice(0, 10);
  return (
    <section className="rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">{labels.world_map_title}</h2>
        <button type="button" className="text-[13px] font-semibold text-fg-muted">
          {labels.world_map_link}
        </button>
      </div>
      <div className="relative mt-5 h-[190px] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f8e1e7,#eef4f5)]">
        <div className="absolute inset-4 opacity-70 [background-image:radial-gradient(ellipse_at_24%_44%,#d96b85_0_12%,transparent_13%),radial-gradient(ellipse_at_47%_38%,#ef9aac_0_18%,transparent_19%),radial-gradient(ellipse_at_72%_46%,#e97d98_0_22%,transparent_23%),radial-gradient(ellipse_at_82%_66%,#c8d7df_0_10%,transparent_11%)]" />
        {points.map((place, index) => (
          <span
            key={place.id}
            className="absolute h-2.5 w-2.5 rounded-full bg-rose-600 shadow-[0_0_0_5px_rgba(225,29,72,0.16)]"
            style={{
              left: `${Math.min(90, Math.max(8, ((place.lng ?? 0) + 180) / 3.6))}%`,
              top: `${Math.min(82, Math.max(15, (90 - (place.lat ?? 0)) / 1.8))}%`,
              opacity: index < 7 ? 1 : 0.65,
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[12px] font-semibold text-fg-muted">
        <Legend color="bg-rose-300" label={labels.map_legend_unlocked} />
        <Legend color="bg-rose-600" label={labels.map_legend_visited} />
        <Legend color="bg-slate-300" label={labels.map_legend_locked} />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-sm", color)} />
      {label}
    </span>
  );
}

function ContinentCard({
  dashboard,
  labels,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
}) {
  return (
    <section className="rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)]">
      <h2 className="text-[18px] font-semibold">{labels.continent_title}</h2>
      <div className="mt-4 space-y-4">
        {dashboard.continent_progress.map((item) => (
          <div key={item.continent} className="grid grid-cols-[110px_1fr_82px] items-center gap-3 text-[13px]">
            <span className="font-semibold text-fg-secondary">
              {labels.continents[item.continent] ?? item.continent}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-rose-100">
              <div className="h-full rounded-full bg-rose-600" style={{ width: `${Math.min(100, item.percent)}%` }} />
            </div>
            <span className="text-right font-semibold text-fg-muted">
              {item.percent}% <span className="text-[11px]">{item.count}/{item.target}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentFootprints({
  dashboard,
  labels,
  lang,
}: {
  dashboard: CollectionDashboard;
  labels: CollectionLabels;
  lang: string;
}) {
  return (
    <section className="rounded-[24px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">{labels.recent_title}</h2>
        <button type="button" className="text-[13px] font-semibold text-fg-muted">
          {labels.recent_all}
        </button>
      </div>
      <div className="mt-4 divide-y divide-divider">
        {dashboard.recent_footprints.map((place) => (
          <div key={place.id} className="flex items-center gap-3 py-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-rose-50">
              {place.cover_image ? (
                <Image src={place.cover_image} alt="" fill sizes="36px" className="object-cover" unoptimized />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">
                {localizedPlaceName(place, lang)} · {place.country}
              </p>
            </div>
            <span className="text-[13px] text-fg-muted">{formatDate(place.visited_at, lang)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ring({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className="grid h-16 w-16 place-items-center rounded-full"
      style={{ background: `conic-gradient(#be3455 ${pct}%, #f2d7de 0)` }}
    >
      <div className="h-10 w-10 rounded-full bg-white" />
    </div>
  );
}

function localizedPlaceName(place: TravelerPlace, lang: string): string {
  return place.name_i18n[lang] ?? place.name;
}

function formatDate(value: string | null, lang: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(lang, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}
