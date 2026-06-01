import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  Bell,
  CalendarDays,
  Compass,
  Map as MapIcon,
  Plus,
  Search,
  Sparkles,
  Wifi,
} from "lucide-react";

import { createSupabaseServerClient } from "@roam/shared";

import {
  ListCard,
  SectionHeader,
  TripRow,
  TripTodoCard,
  UserHeader,
} from "@/components/storefront/home-sections";
import {
  HomeSearchPill,
  HomeSearchProvider,
  HomeTrendingCarousel,
  type HomeSearchEvent,
} from "@/components/storefront/home/home-search-discovery";
import { ExploreWorldButton } from "@/components/storefront/home/explore-world-button";
import { PopularDestinationsRail } from "@/components/storefront/home/popular-destinations-rail";
import { PublicJourneyHeader } from "@/components/storefront/public-journey-header";
import { serverApiBase } from "@/lib/server-api-base";
import { loadRegionStats } from "@/lib/storefront-region-stats";
import { formatTemplate } from "@/lib/text-template";
import { apiToTrip } from "@/lib/trip-mapping";
import { tripCoverUrl } from "@/lib/trip-cover";
import { listChecklists, listTrips, TripApiError } from "@/lib/trips-api";
import type { ApiChecklistItem } from "@/lib/trips-api";

import { getDictionary, hasLocale } from "../dictionaries";

// "Near-term" window for the home-screen todo list. Items due within
// this many days from today are surfaced; everything else (no due
// date, or due far in the future) is hidden from the home preview but
// still visible on the trip detail page.
const TODO_HORIZON_DAYS = 14;

export const dynamic = "force-dynamic";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.home;
  const shopLabels = dict.storefront.shop;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    t.default_name;

  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";

  if (!isSignedIn) {
    return <PublicJourneyHero labels={t.landing} lang={lang} />;
  }

  const [trips, regionStats, searchEvents] = await Promise.all([
    loadRealTrips(),
    loadRegionStats(),
    loadSearchEvents(),
  ]);
  const now = new Date();
  const today = isoDate(now);
  const horizonISO = isoDate(
    new Date(now.getTime() + TODO_HORIZON_DAYS * 86_400_000),
  );
  const activeTrip =
    trips.find((trip) => trip.start <= today && today <= trip.end) ??
    trips.find((trip) => trip.status === "active") ??
    null;
  const upcoming =
    trips
      .filter((trip) => trip.start > today || trip.status === "upcoming")
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  // Trips with **near-term** incomplete tasks (due within TODO_HORIZON_DAYS).
  // Items without a due date are intentionally excluded from the home
  // preview — they remain visible on the trip detail page. Trips with no
  // qualifying items drop out entirely.
  const tripsWithTodos = trips
    .map((trip) => ({
      ...trip,
      checklist: trip.checklist.filter(
        (item) => !item.done && item.due && item.due <= horizonISO,
      ),
    }))
    .filter((trip) => trip.checklist.length > 0)
    .sort((a, b) => {
      const aActive = activeTrip?.id === a.id ? 0 : 1;
      const bActive = activeTrip?.id === b.id ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.start.localeCompare(b.start);
    });
  return (
    <div className="min-h-full">
      {isSignedIn && (
        <UserHeader
          name={displayName}
          level={1}
          levelTitle={t.level_title}
          xp={120}
          xpToNext={500}
          right={
            <button
              type="button"
              aria-label={t.notifications_aria}
              className="relative ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-surface-hover"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 0 3px var(--bg)",
                }}
              />
            </button>
          }
        />
      )}

      <HomeSearchProvider>
      <div className="flex flex-col gap-5 px-5 pt-5 pb-6">
        {(activeTrip || upcoming) && (
          <div className="flex flex-col gap-3">
            <SectionHeader title={t.continue_planning} />
            <ListCard>
              {activeTrip && (
                <TripRow
                  href={`/${lang}/trips/${activeTrip.id}`}
                  imageSrc={tripCoverUrl({
                    title: activeTrip.title,
                    cities: activeTrip.days.map((d) => d.city),
                  })}
                  title={activeTrip.title}
                  subtitle={formatTemplate(t.current_trip_meta, {
                    date: `${activeTrip.start.slice(5)} – ${activeTrip.end.slice(5)}`,
                    tasks: String(
                      activeTrip.checklist.filter((item) => !item.done).length,
                    ),
                  })}
                />
              )}
              {upcoming && (
                <TripRow
                  href={`/${lang}/trips/${upcoming.id}`}
                  imageSrc={tripCoverUrl({
                    title: upcoming.title,
                    cities: upcoming.days.map((d) => d.city),
                  })}
                  title={upcoming.title}
                  subtitle={`${upcoming.start.slice(5)} – ${upcoming.end.slice(5)} · ${formatTemplate(
                    t.next_trip.label_with_countdown,
                    { days: String(daysUntil(upcoming.start, today)) },
                  )}`}
                />
              )}
            </ListCard>
          </div>
        )}

        {tripsWithTodos.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeader title={t.upcoming_tasks} />
            <div className="flex flex-col gap-3">
              {tripsWithTodos.map((trip) => {
                const incomplete = trip.checklist.filter((item) => !item.done);
                return (
                  <TripTodoCard
                    key={trip.id}
                    trip={trip}
                    lang={lang}
                    href={`/${lang}/trips/${trip.id}`}
                    coverSrc={tripCoverUrl({
                      title: trip.title,
                      cities: trip.days.map((d) => d.city),
                    })}
                    countLabel={formatTemplate(t.task_count, {
                      count: String(incomplete.length),
                    })}
                    viewAllLabel={formatTemplate(t.view_all_tasks, {
                      count: String(incomplete.length),
                    })}
                  />
                );
              })}
            </div>
          </div>
        )}

        <HomeSearchPill
          lang={lang}
          localeKey={localeKey}
          stats={regionStats}
          events={searchEvents}
          labels={shopLabels}
          placeholder={t.search_placeholder}
        />

        <HomeTrendingCarousel
          lang={lang}
          localeKey={localeKey}
          labels={shopLabels}
        />

        <PopularDestinationsRail
          lang={lang}
          localeKey={localeKey}
          stats={regionStats}
        />

        {isSignedIn && trips.length === 0 && !activeTrip && !upcoming && (
          <div
            className="flex flex-col items-center rounded-2xl bg-surface px-5 pt-4 pb-6 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Image
              src="/illustrations/trip-empty.png"
              alt=""
              width={180}
              height={180}
              className="h-[180px] w-[180px]"
              priority
            />
            <div className="mt-2 text-[16px] font-semibold text-fg">
              {t.empty_primary}
            </div>
            <div className="mt-1 max-w-[260px] text-[13px] text-fg-secondary">
              {t.empty_secondary}
            </div>
            <Link
              href={`/${lang}/trips`}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(15,184,181,0.9)] transition-transform active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              {t.quick_actions.new_trip}
            </Link>
          </div>
        )}
      </div>
      </HomeSearchProvider>
    </div>
  );
}

function PublicJourneyHero({
  labels,
  lang,
}: {
  labels: {
    brand: string;
    nav: {
      explore: string;
      destinations: string;
      calendar: string;
      planner: string;
      esim: string;
    };
    title_lines: string[];
    subtitle: string;
    search_placeholder: string;
    search_aria: string;
    search_button_aria: string;
    favorites_aria: string;
    account_aria: string;
    menu_aria: string;
    explore_cta: string;
    cards: {
      iceland: { title: string; months: string };
      turkey: { title: string; months: string };
      switzerland: { title: string; months: string };
      japan: { title: string; months: string };
      greece: { title: string; months: string };
      bali: { title: string; months: string };
    };
    dock: {
      inspiration: string;
      calendar: string;
      ai_planner: string;
      guide: string;
      esim: string;
    };
  };
  lang: string;
}) {
  const prefix = `/${lang}`;
  const featureItems = [
    { icon: Compass, label: labels.dock.inspiration, href: `${prefix}/explore` },
    { icon: CalendarDays, label: labels.dock.calendar, href: `${prefix}/shop` },
    {
      icon: Sparkles,
      label: labels.dock.ai_planner,
      href: `${prefix}/login?next=${prefix}/trips`,
    },
    { icon: MapIcon, label: labels.dock.guide, href: `${prefix}/shop` },
    { icon: Wifi, label: labels.dock.esim, href: `${prefix}/shop` },
  ];
  const cards = [
    {
      key: "iceland",
      image: "/illustrations/timeline/seasons/winter.png",
      label: labels.cards.iceland,
      className: "left-[60%] top-[12%] min-[1180px]:left-[35%]",
      transform: "rotateX(-7deg) rotateY(20deg) rotateZ(4deg) translateZ(24px)",
      floatDelay: "-0.8s",
      href: `${prefix}/shop/iceland`,
    },
    {
      key: "turkey",
      image: "/illustrations/cities/istanbul.jpg",
      label: labels.cards.turkey,
      className: "right-[4%] top-[15%] min-[1180px]:right-[15%]",
      transform: "rotateX(-7deg) rotateY(-22deg) rotateZ(6deg) translateZ(26px)",
      floatDelay: "-2.4s",
      href: `${prefix}/shop/turkey`,
    },
    {
      key: "switzerland",
      image: "/illustrations/cities/prague.jpg",
      label: labels.cards.switzerland,
      className: "left-[55%] top-[51%] max-[1099px]:hidden min-[1180px]:left-[39%]",
      transform: "rotateX(-1deg) rotateY(16deg) rotateZ(-3deg) translateZ(18px)",
      floatDelay: "-1.7s",
      href: `${prefix}/shop/switzerland`,
    },
    {
      key: "japan",
      image: "/illustrations/events/jp-sakura-2026.png",
      label: labels.cards.japan,
      className: "right-[3%] top-[38%]",
      transform: "rotateX(1deg) rotateY(-20deg) rotateZ(8deg) translateZ(22px)",
      floatDelay: "-3.1s",
      href: `${prefix}/shop/japan`,
    },
    {
      key: "bali",
      image: "/illustrations/cities/rio.jpg",
      label: labels.cards.bali,
      className: "left-[53%] bottom-[11%] max-[1099px]:hidden",
      transform: "rotateX(11deg) rotateY(9deg) rotateZ(3deg) translateZ(18px)",
      floatDelay: "-0.2s",
      href: `${prefix}/shop/indonesia`,
    },
  ];

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#0b2b3a] text-white">
      <Image
        src="/illustrations/home-journey-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover brightness-[1.12] saturate-[1.45] contrast-[1.1]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(7,35,52,0.58) 0%, rgba(7,35,52,0.36) 34%, rgba(7,35,52,0.06) 62%, rgba(7,35,52,0.08) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 82% 11%, rgba(255,218,167,0.32) 0%, rgba(255,218,167,0.12) 24%, rgba(255,218,167,0) 48%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,35,52,0) 0%, rgba(5,22,24,0.52) 100%)",
        }}
      />

      <PublicJourneyHeader lang={lang} labels={labels} tone="onDark" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1440px] items-center px-5 pb-32 pt-24 sm:px-8 lg:pb-24">
        <div className="max-w-[620px]">
          <h1 className="text-balance text-[44px] font-semibold leading-[1.14] tracking-[-0.035em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.24)] sm:text-[56px] lg:text-[64px]">
            {labels.title_lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-[560px] text-[18px] font-medium leading-8 text-white/88 sm:text-[20px]">
            {labels.subtitle}
          </p>

          <form
            action={`${prefix}/shop`}
            className="mt-9 flex h-16 max-w-[430px] overflow-hidden rounded-[12px] bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] sm:max-w-[470px]"
          >
            <input
              name="q"
              aria-label={labels.search_aria}
              placeholder={labels.search_placeholder}
              className="min-w-0 flex-1 bg-white px-6 text-[15px] font-medium text-[#122026] outline-none placeholder:text-[#8b9497]"
            />
            <button
              type="submit"
              aria-label={labels.search_button_aria}
              className="grid w-16 shrink-0 place-items-center bg-[#4b9466] text-white transition-colors hover:bg-[#3f8459]"
            >
              <Search className="h-7 w-7" strokeWidth={2.4} />
            </button>
          </form>

          <ExploreWorldButton
            href={`${prefix}/explore`}
            label={labels.explore_cta}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0 hidden min-[840px]:block"
          style={{ perspective: "880px", perspectiveOrigin: "50% 50%" }}
        >
          {cards.map((card) => (
            <HeroDestinationCard
              key={card.key}
              image={card.image}
              title={card.label.title}
              months={card.label.months}
              className={card.className}
              transform={card.transform}
              floatDelay={card.floatDelay}
              href={card.href}
            />
          ))}
        </div>

        <nav className="absolute inset-x-5 bottom-4 z-20 rounded-[18px] border border-white/10 bg-black/18 px-3 py-3 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:inset-x-8 lg:left-1/2 lg:w-[980px] lg:-translate-x-1/2">
          <div className="grid grid-cols-5 gap-1">
            {featureItems.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center text-[11px] font-semibold text-white/86 transition-colors hover:bg-white/10 hover:text-white sm:flex-row sm:gap-3 sm:text-[15px]"
              >
                <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={1.9} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </section>
  );
}

function HeroDestinationCard({
  image,
  title,
  months,
  className,
  transform,
  floatDelay,
  href,
}: {
  image: string;
  title: string;
  months: string;
  className: string;
  transform: string;
  floatDelay: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={title}
      className={`hero-destination-float group pointer-events-auto absolute h-[132px] w-[132px] min-[1100px]:h-[150px] min-[1100px]:w-[150px] lg:h-[178px] lg:w-[178px] ${className}`}
      style={{ animationDelay: floatDelay }}
    >
      <div
        className="hero-destination-card relative h-full w-full overflow-hidden rounded-[14px] border border-white/50 bg-white/10 shadow-[0_30px_48px_-18px_rgba(0,0,0,0.72)] backdrop-blur-sm"
        style={{
          "--hero-card-transform": transform,
          transformStyle: "preserve-3d",
        } as CSSProperties}
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="180px"
          className="object-cover brightness-[1.03] saturate-[1.32] contrast-[1.1] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.72) 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[14px] shadow-[inset_12px_0_22px_rgba(255,255,255,0.12),inset_-16px_0_24px_rgba(0,0,0,0.18)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 34% 18%, rgba(255,255,255,0.34), rgba(255,255,255,0) 36%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="text-[15px] font-semibold leading-snug drop-shadow lg:text-[16px]">
            {title}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-white/90">
            {months}
          </div>
        </div>
      </div>
    </Link>
  );
}

async function loadSearchEvents(): Promise<HomeSearchEvent[]> {
  const base = serverApiBase();
  const url = new URL("/storefront/events", base);
  url.searchParams.set("upcoming", "1");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: HomeSearchEvent[] };
    return (data.events ?? []).slice(0, 60);
  } catch {
    return [];
  }
}

async function loadRealTrips() {
  try {
    const [summaries, checklistItems] = await Promise.all([
      listTrips(),
      listChecklists().catch((err) => {
        // If only the new endpoint fails (e.g. older API), still render
        // summaries — we just lose task text on the home screen.
        if (err instanceof TripApiError && err.status === 404) return [];
        throw err;
      }),
    ]);
    const itemsByTrip = new Map<string, ApiChecklistItem[]>();
    for (const item of checklistItems) {
      const arr = itemsByTrip.get(item.trip_id);
      if (arr) arr.push(item);
      else itemsByTrip.set(item.trip_id, [item]);
    }
    return summaries.map((summary) =>
      apiToTrip(summary, [], itemsByTrip.get(summary.id) ?? []),
    );
  } catch (err) {
    if (err instanceof TripApiError && (err.status === 401 || err.status === 503)) {
      return [];
    }
    throw err;
  }
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysUntil(dateISO: string, fromISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${dateISO}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
