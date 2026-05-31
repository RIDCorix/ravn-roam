import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, MapPin, Route, Wifi } from "lucide-react";

import type { ShopRegion } from "@/lib/storefront-regions";
import { formatTemplate } from "@/lib/text-template";

import type { LocaleKey } from "./date";

export function RegionHero({
  region,
  lang,
  localeKey,
  labels,
  plansHref,
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
    view_plans_cta: string;
  };
  plansHref: string;
  planTripHref: string;
}) {
  return (
    <header className="relative min-h-[360px] overflow-hidden">
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
          href={`/${lang}/shop`}
          aria-label={labels.back}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-surface-hover"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">
          <MapPin className="h-3.5 w-3.5" />
          {formatTemplate(labels.destination_count, {
            count: String(region.destinations.length),
          })}
        </div>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] drop-shadow-sm">
          {region.name[localeKey]}
        </h1>
        <p className="mt-1 max-w-[560px] text-[14px] leading-relaxed text-white/88">
          {formatTemplate(labels.hero_body, { region: region.name[localeKey] })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={planTripHref}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,0,0,0.8)] transition-transform active:scale-[0.98]"
          >
            <Route className="h-4 w-4" />
            {labels.plan_trip_cta}
          </Link>
          <Link
            href={plansHref}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-[13px] font-semibold text-fg shadow-[0_12px_24px_-14px_rgba(0,0,0,0.8)] backdrop-blur transition-transform active:scale-[0.98]"
          >
            <Wifi className="h-4 w-4 text-accent" />
            {labels.view_plans_cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
