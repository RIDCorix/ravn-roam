"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  MapPin,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SpotlightMapEvent } from "./spotlight-flag-map";

const SpotlightFlagMap = dynamic(
  () => import("./spotlight-flag-map").then((mod) => mod.SpotlightFlagMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-[28px] bg-white/20" />
    ),
  },
);

const AUTO_ROTATE_MS = 5200;

const MAP_EDGE_FEATHER_STYLE = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
  maskImage:
    "linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
} as CSSProperties;

type SpotlightCopyEvent = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
};

export type ExploreSpotlightLabels = {
  spotlight_title_lines: string[];
  spotlight_subtitle: string;
  spotlight_more: string;
  spotlight_previous: string;
  spotlight_next: string;
  spotlight_events: SpotlightCopyEvent[];
};

const SPOTLIGHT_META = [
  {
    id: "venice-carnival",
    regionSlug: "italy",
    countryCode: "IT",
    image: "/illustrations/cities/rome.jpg",
    lat: 45.44,
    lng: 12.315,
    tone: "coral",
  },
  {
    id: "rio-carnival",
    regionSlug: "brazil",
    countryCode: "BR",
    image: "/illustrations/cities/rio.jpg",
    lat: -22.906,
    lng: -43.172,
    tone: "green",
  },
  {
    id: "tomorrowland",
    regionSlug: "belgium",
    countryCode: "BE",
    image: "/illustrations/cities/europe.jpg",
    lat: 51.09,
    lng: 4.37,
    tone: "violet",
  },
  {
    id: "iceland-lights",
    regionSlug: "iceland",
    countryCode: "IS",
    image: "/illustrations/timeline/seasons/winter.png",
    lat: 64.147,
    lng: -21.942,
    tone: "violet",
  },
  {
    id: "singapore-grand-prix",
    regionSlug: "singapore",
    countryCode: "SG",
    image: "/illustrations/cities/singapore.jpg",
    lat: 1.291,
    lng: 103.864,
    tone: "cyan",
  },
  {
    id: "taiwan-lantern",
    regionSlug: "taiwan",
    countryCode: "TW",
    image: "/illustrations/cities/taipei.jpg",
    lat: 23.697,
    lng: 120.96,
    tone: "gold",
  },
  {
    id: "taiwan-mazu",
    regionSlug: "taiwan",
    countryCode: "TW",
    image: "/illustrations/events/taiwan-dajia-mazu-pilgrimage.png",
    lat: 24.347,
    lng: 120.623,
    tone: "coral",
  },
  {
    id: "japan-gion",
    regionSlug: "japan",
    countryCode: "JP",
    image: "/illustrations/cities/kyoto.jpg",
    lat: 35.011,
    lng: 135.768,
    tone: "rose",
  },
  {
    id: "fuji-rock",
    regionSlug: "japan",
    countryCode: "JP",
    image: "/illustrations/events/japan-fuji-rock-2026.png",
    lat: 36.79,
    lng: 138.78,
    tone: "violet",
  },
  {
    id: "jp-sakura",
    regionSlug: "japan",
    countryCode: "JP",
    image: "/illustrations/events/jp-sakura-2026.png",
    lat: 35.011,
    lng: 135.768,
    tone: "rose",
  },
  {
    id: "korankei-autumn",
    regionSlug: "japan",
    countryCode: "JP",
    image: "/illustrations/events/japan-korankei-autumn-festival.png",
    lat: 35.133,
    lng: 137.316,
    tone: "gold",
  },
  {
    id: "korea-boryeong-mud",
    regionSlug: "korea",
    countryCode: "KR",
    image: "/illustrations/events/korea-boryeong-mud-festival-2026.png",
    lat: 36.305,
    lng: 126.517,
    tone: "coral",
  },
  {
    id: "korea-jinhae-cherry",
    regionSlug: "korea",
    countryCode: "KR",
    image: "/illustrations/events/korea-jinhae-gunhangje-cherry-blossom.png",
    lat: 35.15,
    lng: 128.66,
    tone: "rose",
  },
  {
    id: "hong-kong-sevens",
    regionSlug: "hong-kong",
    countryCode: "HK",
    image: "/illustrations/events/hong-kong-sevens-2026.png",
    lat: 22.278,
    lng: 114.182,
    tone: "cyan",
  },
  {
    id: "hong-kong-flower-show",
    regionSlug: "hong-kong",
    countryCode: "HK",
    image: "/illustrations/events/hong-kong-flower-show.png",
    lat: 22.281,
    lng: 114.188,
    tone: "rose",
  },
  {
    id: "rainforest-world-music",
    regionSlug: "malaysia",
    countryCode: "MY",
    image: "/illustrations/events/malaysia-rainforest-world-music-festival-2026.png",
    lat: 1.744,
    lng: 110.315,
    tone: "green",
  },
  {
    id: "singapore-durian",
    regionSlug: "singapore",
    countryCode: "SG",
    image: "/illustrations/events/singapore-malaysia-durian-season.png",
    lat: 1.352,
    lng: 103.819,
    tone: "green",
  },
  {
    id: "taipei-feast",
    regionSlug: "taiwan",
    countryCode: "TW",
    image: "/illustrations/events/taipei-taipei-feast-2026.png",
    lat: 25.033,
    lng: 121.565,
    tone: "coral",
  },
] as const;

export const SPOTLIGHT_EVENTS = SPOTLIGHT_META;

export function ExploreSpotlight({
  lang,
  labels,
  initialQuery,
}: {
  lang: string;
  labels: ExploreSpotlightLabels;
  initialQuery?: string;
}) {
  const copyById = useMemo(
    () => new Map(labels.spotlight_events.map((event) => [event.id, event])),
    [labels.spotlight_events],
  );
  const events = useMemo(
    () =>
      SPOTLIGHT_META.flatMap((event) => {
        const copy = copyById.get(event.id);
        return copy ? [{ ...event, ...copy }] : [];
      }),
    [copyById],
  );
  const initialIndex = useMemo(() => {
    const query = initialQuery?.trim().toLocaleLowerCase();
    if (!query) return 0;
    const match = events.findIndex((event) =>
      [event.title, event.location, event.countryCode, event.regionSlug]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
    return match >= 0 ? match : 0;
  }, [events, initialQuery]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const autoTimerRef = useRef<number | null>(null);
  const activeEvent = events[activeIndex] ?? events[0];
  const prefix = `/${lang}`;

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current === null) return;
    window.clearInterval(autoTimerRef.current);
    autoTimerRef.current = null;
  }, []);

  const startAutoTimer = useCallback(() => {
    clearAutoTimer();
    if (events.length <= 1) return;
    autoTimerRef.current = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % events.length);
    }, AUTO_ROTATE_MS);
  }, [clearAutoTimer, events.length]);

  useEffect(() => {
    startAutoTimer();
    return clearAutoTimer;
  }, [clearAutoTimer, startAutoTimer]);

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + events.length) % events.length);
    startAutoTimer();
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % events.length);
    startAutoTimer();
  }

  function showEvent(eventId: string) {
    const nextIndex = events.findIndex((event) => event.id === eventId);
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    startAutoTimer();
  }

  if (!activeEvent) return null;

  const mapEvents: SpotlightMapEvent[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    lat: event.lat,
    lng: event.lng,
    tone: event.tone,
  }));

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#f8f4ec] text-[#273a3f]">
      <div className="absolute inset-0">
        {events.map((event, index) => (
          <Image
            key={event.id}
            src={event.image}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className={cn(
              "object-cover object-center transition-all duration-700 ease-out",
              event.id === activeEvent.id
                ? "scale-100 opacity-100"
                : "scale-[1.03] opacity-0",
            )}
          />
        ))}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,244,236,0.98)_0%,rgba(248,244,236,0.86)_24%,rgba(248,244,236,0.2)_50%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.4)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.02)_45%,rgba(0,0,0,0.46)_100%)]" />
      <div className="absolute bottom-0 right-0 h-[54%] w-[58%] bg-[radial-gradient(circle_at_70%_58%,rgba(0,0,0,0.56)_0%,rgba(0,0,0,0.34)_34%,rgba(0,0,0,0)_72%)]" />

      <div className="relative z-10 min-h-[100svh] px-4 pb-6 pt-20 sm:px-6 md:px-12 md:pb-12 md:pt-24 lg:px-16">
        <div className="relative z-10 max-w-[560px] pt-4 sm:pt-8 md:absolute md:left-12 md:top-32 md:pt-0 lg:left-16 lg:top-40">
          <h1 className="text-[36px] font-semibold leading-[1.14] tracking-[-0.02em] text-[#273a3f] max-[380px]:text-[32px] md:text-[58px] md:leading-[1.18]">
            {labels.spotlight_title_lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
        </div>

        <div className="relative mt-7 min-h-[calc(100svh-190px)] md:static md:mt-0 md:min-h-0">
          <div
            className="relative h-[220px] w-full overflow-hidden opacity-95 sm:h-[250px] md:absolute md:bottom-14 md:left-12 md:h-[280px] md:w-[min(40vw,560px)] lg:left-16 lg:h-[300px] lg:w-[min(39vw,575px)]"
            style={MAP_EDGE_FEATHER_STYLE}
          >
            <div className="absolute inset-0 bg-[#f8f4ec]/22" />
            <div className="absolute inset-[8%]">
              <SpotlightFlagMap
                events={mapEvents}
                activeId={activeEvent.id}
                onActiveChange={showEvent}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 z-[410] bg-[radial-gradient(ellipse_at_46%_54%,rgba(248,244,236,0)_0%,rgba(248,244,236,0.08)_54%,rgba(248,244,236,0.34)_78%,rgba(248,244,236,0.64)_100%)]" />
          </div>

          <article className="relative mt-6 w-full max-w-[760px] text-white md:absolute md:bottom-12 md:right-12 md:mt-0 lg:right-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-[14px] font-semibold shadow-[0_18px_44px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/25 backdrop-blur">
              <Compass className="h-4 w-4" />
              {activeEvent.category}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={showPrevious}
                aria-label={labels.spotlight_previous}
                className="absolute -left-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#273a3f] shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)] transition hover:-translate-x-0.5 hover:bg-white md:grid"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="max-w-[760px] text-[36px] font-semibold leading-[1.02] tracking-[-0.03em] drop-shadow-[0_12px_34px_rgba(0,0,0,0.55)] max-[380px]:text-[32px] sm:text-[clamp(42px,8vw,56px)] md:whitespace-nowrap md:text-[clamp(48px,4.35vw,60px)]">
                {activeEvent.title}
              </h2>
              <button
                type="button"
                onClick={showNext}
                aria-label={labels.spotlight_next}
                className="absolute -right-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#273a3f] shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)] transition hover:translate-x-0.5 hover:bg-white md:grid"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
              <div className="mt-4 flex gap-3 md:hidden">
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label={labels.spotlight_previous}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/88 text-[#273a3f] shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label={labels.spotlight_next}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/88 text-[#273a3f] shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)]"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-[17px] font-semibold text-white/88">
              <MapPin className="h-5 w-5" />
              {activeEvent.location}
            </div>
            <div className="mt-5 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-5">
              <p className="max-h-28 max-w-[420px] overflow-hidden text-[15px] font-medium leading-7 text-white/88 sm:text-[16px] sm:leading-8 md:h-24">
                {activeEvent.description}
              </p>
              <Button
                asChild
                className="h-[52px] w-full rounded-[18px] bg-white px-6 text-[15px] font-semibold text-[#273a3f] shadow-[0_20px_48px_-24px_rgba(0,0,0,0.75)] hover:bg-white/92 sm:h-14 sm:w-auto sm:px-7 sm:text-[16px]"
              >
                <Link href={`${prefix}/shop/${activeEvent.regionSlug}`}>
                  {labels.spotlight_more}
                  <ArrowRight className="ml-3 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
