import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  CalendarDays,
  Compass,
  Map as MapIcon,
  Search,
  Sparkles,
  Wifi,
} from "lucide-react";

import { ExploreWorldButton } from "@/components/storefront/home/explore-world-button";
import {
  OngoingTripHomeBanner,
  type OngoingTripHomeBannerLabels,
} from "@/components/storefront/home/ongoing-trip-home-banner";

import { getDictionary, hasLocale } from "../dictionaries";

export const dynamic = "force-dynamic";

type LandingLabels = {
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
  ongoing: OngoingTripHomeBannerLabels;
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

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return <PublicJourneyHero labels={dict.storefront.home.landing} lang={lang} />;
}

function PublicJourneyHero({
  labels,
  lang,
}: {
  labels: LandingLabels;
  lang: string;
}) {
  const prefix = `/${lang}`;
  const featureItems = [
    { icon: Compass, label: labels.dock.inspiration, href: `${prefix}/explore` },
    { icon: CalendarDays, label: labels.dock.calendar, href: `${prefix}/explore` },
    {
      icon: Sparkles,
      label: labels.dock.ai_planner,
      href: `${prefix}/explore`,
    },
    { icon: MapIcon, label: labels.dock.guide, href: `${prefix}/explore` },
    { icon: Wifi, label: labels.dock.esim, href: `${prefix}/explore` },
  ];
  const cards = [
    {
      key: "iceland",
      image: "/illustrations/timeline/seasons/winter.png",
      label: labels.cards.iceland,
      className: "left-[60%] top-[12%] min-[1180px]:left-[35%]",
      transform: "rotateX(-7deg) rotateY(20deg) rotateZ(4deg) translateZ(24px)",
      floatDelay: "-0.8s",
      href: `${prefix}/explore`,
    },
    {
      key: "turkey",
      image: "/illustrations/cities/istanbul.jpg",
      label: labels.cards.turkey,
      className: "right-[4%] top-[15%] min-[1180px]:right-[15%]",
      transform: "rotateX(-7deg) rotateY(-22deg) rotateZ(6deg) translateZ(26px)",
      floatDelay: "-2.4s",
      href: `${prefix}/explore`,
    },
    {
      key: "switzerland",
      image: "/illustrations/cities/prague.jpg",
      label: labels.cards.switzerland,
      className: "left-[55%] top-[51%] max-[1099px]:hidden min-[1180px]:left-[39%]",
      transform: "rotateX(-1deg) rotateY(16deg) rotateZ(-3deg) translateZ(18px)",
      floatDelay: "-1.7s",
      href: `${prefix}/explore`,
    },
    {
      key: "japan",
      image: "/illustrations/events/jp-sakura-2026.png",
      label: labels.cards.japan,
      className: "right-[3%] top-[38%]",
      transform: "rotateX(1deg) rotateY(-20deg) rotateZ(8deg) translateZ(22px)",
      floatDelay: "-3.1s",
      href: `${prefix}/explore`,
    },
    {
      key: "bali",
      image: "/illustrations/cities/rio.jpg",
      label: labels.cards.bali,
      className: "left-[53%] bottom-[11%] max-[1099px]:hidden",
      transform: "rotateX(11deg) rotateY(9deg) rotateZ(3deg) translateZ(18px)",
      floatDelay: "-0.2s",
      href: `${prefix}/explore`,
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

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1440px] items-center px-4 pb-28 pt-20 sm:px-8 sm:pb-32 sm:pt-24 lg:pb-24">
        <div className="max-w-[620px]">
          <h1 className="text-balance text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.24)] max-[380px]:text-[34px] sm:text-[56px] lg:text-[64px]">
            {labels.title_lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-[560px] text-[16px] font-medium leading-7 text-white/88 sm:mt-5 sm:text-[20px] sm:leading-8">
            {labels.subtitle}
          </p>

          <form
            action={`${prefix}/explore`}
            className="mt-7 flex h-14 max-w-[430px] overflow-hidden rounded-[12px] bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] sm:mt-9 sm:h-16 sm:max-w-[470px]"
          >
            <input
              name="q"
              aria-label={labels.search_aria}
              placeholder={labels.search_placeholder}
              className="min-w-0 flex-1 bg-white px-4 text-[15px] font-medium text-[#122026] outline-none placeholder:text-[#8b9497] sm:px-6"
            />
            <button
              type="submit"
              aria-label={labels.search_button_aria}
              className="grid w-14 shrink-0 place-items-center bg-[#4b9466] text-white transition-colors hover:bg-[#3f8459] sm:w-16"
            >
              <Search className="h-7 w-7" strokeWidth={2.4} />
            </button>
          </form>

          <ExploreWorldButton
            href={`${prefix}/explore`}
            label={labels.explore_cta}
          />
          <OngoingTripHomeBanner lang={lang} labels={labels.ongoing} />
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

        <nav className="absolute inset-x-3 bottom-3 z-20 rounded-[18px] border border-white/10 bg-black/22 px-2 py-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:inset-x-8 sm:bottom-4 sm:px-3 sm:py-3 lg:left-1/2 lg:w-[980px] lg:-translate-x-1/2">
          <div className="grid grid-cols-5 gap-1">
            {featureItems.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-center text-[10.5px] font-semibold text-white/86 transition-colors hover:bg-white/10 hover:text-white sm:flex-row sm:gap-3 sm:px-1.5 sm:text-[15px]"
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
