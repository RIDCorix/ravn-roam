import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, MapPin, Route } from "lucide-react";

import type { ShopRegion } from "@/lib/storefront-regions";
import { formatTemplate } from "@/lib/text-template";

import type { LocaleKey } from "./date";

export function RegionHero({
  region,
  lang,
  localeKey,
  labels,
  planTripHref,
}: {
  region: ShopRegion;
  lang: string;
  localeKey: LocaleKey;
  labels: {
    back: string;
    destination_count: string;
    hero_body: string;
    plan_trip_cta: string;
  };
  planTripHref: string;
}) {
  const heroBody =
    region.intro?.[localeKey] ??
    formatTemplate(labels.hero_body, { region: region.name[localeKey] });

  return (
    <header className="relative min-h-[220px] overflow-hidden sm:min-h-[250px] md:min-h-[300px]">
      <Image
        src={region.cover}
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.72) 100%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 flex items-start px-4 pt-3">
        <Link
          href={`/${lang}`}
          aria-label={labels.back}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-surface-hover sm:h-9 sm:w-9"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5 pb-3 text-white sm:pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">
          <MapPin className="h-3.5 w-3.5" />
          {formatTemplate(labels.destination_count, {
            count: String(region.destinations.length),
          })}
        </div>
        <h1 className="mt-1.5 text-[25px] font-semibold tracking-[-0.03em] drop-shadow-sm sm:mt-2 sm:text-[28px]">
          {region.name[localeKey]}
        </h1>
        <p className="mt-0.5 max-w-[520px] text-[13px] leading-snug text-white/88 sm:mt-1 sm:text-[14px] sm:leading-relaxed">
          {heroBody}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 sm:mt-3">
          <Link
            href={planTripHref}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,0,0,0.8)] transition-transform active:scale-[0.98] sm:h-11"
          >
            <Route className="h-4 w-4" />
            {labels.plan_trip_cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
