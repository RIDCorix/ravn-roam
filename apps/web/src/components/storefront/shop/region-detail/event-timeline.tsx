import Image from "next/image";
import Link from "next/link";

import {
  Timeline,
  TimelineItem,
} from "@/components/ui/timeline";
import { cn } from "@/lib/utils";

import {
  GANTT_HEADER_HEIGHT,
  GANTT_MONTH_HEADER_HEIGHT,
  GANTT_MONTH_WIDTH,
  GANTT_ROW_HEIGHT,
  GANTT_SEASON_HEADER_HEIGHT,
  type EventTimelineData,
} from "./timeline-data";
import {
  eventIconSrc,
  eventStickerRotation,
  eventStickerSide,
  eventTimelineVisual,
  seasonVisual,
} from "./visuals";
import type { SeasonKey } from "./types";

export function EventTimeline({
  item,
  labels,
  backgroundSrc,
}: {
  item: EventTimelineData | null;
  labels: {
    timeline_title: string;
    timeline_subtitle: string;
    timeline_seasons: Record<SeasonKey, { name: string; range: string }>;
  };
  backgroundSrc: string;
}) {
  if (!item || item.events.length === 0) return null;

  const chartHeight = GANTT_HEADER_HEIGHT + item.rowCount * GANTT_ROW_HEIGHT;

  return (
    <div className="space-y-2">
      <div className="px-1">
        <h3 className="text-[13px] font-semibold text-fg">
          {labels.timeline_title}
        </h3>
        <p className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">
          {labels.timeline_subtitle}
        </p>
      </div>
      <Timeline
        className="-mx-5 px-5 pb-2 pt-1 md:mx-0 md:px-1 xl:relative xl:left-1/2 xl:w-max xl:-translate-x-1/2 xl:px-0"
        aria-label={labels.timeline_title}
      >
        <TimelineItem
          className="min-w-full pr-5 md:pr-0"
          style={{ width: `${item.totalWidth}px` }}
        >
          <div
            className="relative overflow-hidden rounded-[22px] border border-divider/60 bg-surface"
            style={{
              height: `${chartHeight}px`,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <Image
              src={backgroundSrc}
              alt=""
              fill
              sizes="(max-width: 768px) 1200px, 1600px"
              className="object-cover opacity-100"
            />
            <div className="absolute inset-0 bg-white/6" aria-hidden="true" />

            <div
              className="absolute bottom-0"
              style={{
                left: 0,
                top: `${GANTT_HEADER_HEIGHT}px`,
                width: `${item.chartWidth}px`,
              }}
              aria-hidden="true"
            >
              {item.months.map((month) => {
                const visual = seasonVisual(month.season);
                return (
                  <div
                    key={month.key}
                    className={cn(
                      "absolute inset-y-0 border-r border-white/18 last:border-r-0",
                      visual.bg,
                    )}
                    style={{
                      left: `${month.left}px`,
                      width: `${month.width}px`,
                      opacity: 0.9,
                    }}
                  />
                );
              })}
            </div>

            <div
              className="absolute top-0 z-20 flex border-b border-divider/20 bg-white/95 backdrop-blur-[2px]"
              style={{
                left: 0,
                width: `${item.chartWidth}px`,
                height: `${GANTT_MONTH_HEADER_HEIGHT}px`,
              }}
            >
              {item.months.map((month) => (
                <div
                  key={month.key}
                  className="flex shrink-0 items-center justify-center border-r border-divider/20 text-[14px] font-semibold text-fg-secondary last:border-r-0"
                  style={{ width: `${month.width}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div
              className="absolute z-20 flex border-b border-divider/25 bg-white backdrop-blur-[2px]"
              style={{
                left: 0,
                top: `${GANTT_MONTH_HEADER_HEIGHT}px`,
                width: `${item.chartWidth}px`,
                height: `${GANTT_SEASON_HEADER_HEIGHT}px`,
              }}
            >
              {item.seasonBands.map((band) => {
                const visual = seasonVisual(band.key);
                const Icon = visual.Icon;
                return (
                  <div
                    key={`${band.key}-${band.left}`}
                    className={cn(
                      "flex items-center justify-center gap-2 border-r border-white/70 text-[14px] font-semibold last:border-r-0",
                      visual.headerBg,
                      visual.text,
                    )}
                    style={{ width: `${band.width}px` }}
                  >
                    {band.showLabel !== false ? (
                      <>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {labels.timeline_seasons[band.key].name}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <ul aria-label={labels.timeline_title}>
              {item.events.map((event) => {
                const visual = eventTimelineVisual(event.slug, event.eventType);
                const iconSrc = eventIconSrc(event.eventType, event.slug);
                const stickerRotation = eventStickerRotation(event.slug);
                const stickerSide = eventStickerSide(event.slug);
                const rowTop =
                  GANTT_HEADER_HEIGHT + event.row * GANTT_ROW_HEIGHT;
                return (
                  <li key={event.slug}>
                    <div
                      className="absolute left-0 right-0 border-b border-divider/20"
                      style={{
                        top: `${rowTop}px`,
                        height: `${GANTT_ROW_HEIGHT}px`,
                      }}
                      aria-hidden="true"
                    />
                    <Link
                      href={`#event-${event.slug}`}
                      aria-label={`${event.title}，${event.dateLabel}`}
                      title={`${event.title} · ${event.dateLabel}`}
                      className={cn(
                        "group absolute z-20 flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-bold shadow-[0_10px_18px_-12px_rgba(17,24,39,0.38)] transition-transform hover:scale-[1.02]",
                        visual.bar,
                      )}
                      style={{
                        left: `${event.left}px`,
                        top: `${rowTop + 11}px`,
                        width: `${event.width}px`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center drop-shadow-[0_3px_5px_rgba(0,0,0,0.18)]"
                        style={{
                          left: stickerSide === "left" ? "-46px" : undefined,
                          right: stickerSide === "right" ? "-46px" : undefined,
                          transform: `translateY(-50%) rotate(${stickerRotation}deg)`,
                        }}
                      >
                        <Image
                          src={iconSrc}
                          alt=""
                          width={52}
                          height={52}
                          className="h-[52px] w-[52px] object-contain transition-transform group-hover:scale-110"
                        />
                      </span>
                      <span className="min-w-0 truncate">{event.title}</span>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums opacity-75">
                        {event.dateLabel}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 z-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)] opacity-[0.07]"
              style={{
                left: 0,
                top: `${GANTT_HEADER_HEIGHT}px`,
                width: `${item.chartWidth}px`,
                backgroundSize: `${GANTT_MONTH_WIDTH}px 100%`,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 z-0 bg-[linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] opacity-[0.06]"
              style={{
                top: `${GANTT_HEADER_HEIGHT}px`,
                left: 0,
                right: 0,
                backgroundSize: `100% ${GANTT_ROW_HEIGHT}px`,
              }}
            />
          </div>
        </TimelineItem>
      </Timeline>
    </div>
  );
}
