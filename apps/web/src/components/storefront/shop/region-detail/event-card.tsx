import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  deriveBadge,
  eventDateLabel,
  type LocaleKey,
} from "./date";
import type { ApiEvent } from "./types";
import { eventVisual } from "./visuals";

export function RegionEventCard({
  event,
  regionCover,
  regionName,
  localeKey,
  labels,
  planTripHref,
}: {
  event: ApiEvent;
  regionCover: string;
  regionName: string;
  localeKey: LocaleKey;
  labels: {
    plan_with_event: string;
    event_types: Record<string, string>;
  };
  planTripHref: string;
}) {
  const title =
    event.title_i18n?.[localeKey] ?? event.title_i18n?.["zh-TW"] ?? event.slug;
  const subtitle =
    event.subtitle_i18n?.[localeKey] ?? event.subtitle_i18n?.["zh-TW"] ?? "";
  const location =
    event.location_i18n?.[localeKey] ??
    event.location_i18n?.["zh-TW"] ??
    regionName;
  const badge = event.badge_override ?? deriveBadge(event, localeKey);
  const typeLabel = labels.event_types[event.event_type] ?? event.event_type;
  const visual = eventVisual(event.event_type);
  const href = `${planTripHref}&event=${encodeURIComponent(title)}`;

  return (
    <article
      id={`event-${event.slug}`}
      className="w-[min(86vw,326px)] shrink-0 snap-start overflow-hidden rounded-[24px] bg-surface sm:w-[326px]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative aspect-[2.05/1] overflow-hidden">
        <Image
          src={event.cover_image || regionCover}
          alt=""
          fill
          sizes="(max-width: 768px) 86vw, 326px"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.02) 42%, rgba(0,0,0,0.18) 100%)",
          }}
        />
        <span
          className={cn(
            "absolute left-4 top-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold text-white shadow-sm backdrop-blur-md",
            visual.badge,
          )}
        >
          {typeLabel}
        </span>
        <button
          type="button"
          aria-label={localeKey === "en" ? "Save event" : "收藏活動"}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/18 text-white backdrop-blur-md transition-colors hover:bg-black/28"
        >
          <Heart className="h-7 w-7" strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <div className="relative min-h-[188px] p-5 pb-4">
        <h3 className="truncate text-[20px] font-bold tracking-[-0.02em] text-fg">
          {title}
        </h3>
        <div className={cn("mt-3 text-[18px] font-bold tabular-nums", visual.icon)}>
          {badge ?? eventDateLabel(event, localeKey)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} aria-hidden="true" />
          <span className="truncate">{location}</span>
        </div>
        <p className="mt-5 line-clamp-2 max-w-[230px] text-[14.5px] font-semibold leading-7 text-fg-secondary">
          {subtitle || labels.plan_with_event}
        </p>
        <Link
          href={href}
          aria-label={labels.plan_with_event}
          className={cn(
            "absolute bottom-4 right-5 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 transition-transform active:scale-[0.96]",
            visual.button,
            visual.icon,
          )}
        >
          <ArrowRight className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
