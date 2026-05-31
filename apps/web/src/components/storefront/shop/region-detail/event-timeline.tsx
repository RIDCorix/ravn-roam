import * as React from "react";
import type { CSSProperties } from "react";
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
  GANTT_ROW_HEIGHT,
  type EventTimelineData,
} from "./timeline-data";
import {
  eventIconSrc,
  eventTimelineVisual,
  seasonCardImageSrc,
  seasonVisual,
} from "./visuals";
import type { SeasonKey } from "./types";

const SEASON_ORDER: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

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
  const timelineRef = React.useRef<HTMLOListElement>(null);
  const [activeSeason, setActiveSeason] = React.useState<SeasonKey | null>(null);

  const syncActiveSeasonFromScroll = React.useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline || !item) return;

    const scale = timeline.scrollWidth / item.totalWidth;
    const visibleLeft = timeline.scrollLeft / scale + 16;
    const currentMonth = [...item.months]
      .reverse()
      .find((month) => month.left <= visibleLeft);

    if (currentMonth) setActiveSeason(currentMonth.season);
  }, [item]);

  if (!item || item.events.length === 0) return null;

  const eventTopOffset = 34;
  const chartHeight =
    GANTT_HEADER_HEIGHT + eventTopOffset + item.rowCount * GANTT_ROW_HEIGHT + 48;
  const chartStyle = {
    "--timeline-chart-height": `${chartHeight}px`,
    "--timeline-total-width": `${item.totalWidth}px`,
  } as CSSProperties;
  const currentActiveSeason = activeSeason ?? item.months[0]?.season ?? "spring";
  const scrollToSeason = (season: SeasonKey) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const targetMonth = item.months.find((month) => month.season === season);
    if (!targetMonth) return;

    setActiveSeason(season);
    const scale = timeline.scrollWidth / item.totalWidth;
    timeline.scrollTo({
      left: Math.max(0, targetMonth.left * scale - 8),
      behavior: "smooth",
    });
  };
  const scrollToEventCard = (
    event: React.MouseEvent<HTMLAnchorElement>,
    slug: string,
  ) => {
    event.preventDefault();

    const targetId = `event-${slug}`;
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.history.pushState(null, "", `#${targetId}`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2 pb-1">
        {SEASON_ORDER.map((season) => {
          const visual = seasonVisual(season);
          const seasonLabel = labels.timeline_seasons[season];
          return (
            <button
              key={season}
              type="button"
              onClick={() => scrollToSeason(season)}
              className={cn(
                "relative h-[76px] min-w-0 overflow-hidden rounded-[18px] border bg-surface px-3 py-3 text-left shadow-[0_10px_24px_-18px_rgba(17,24,39,0.42)] transition-transform active:scale-[0.98]",
                currentActiveSeason === season
                  ? cn("ring-2", visual.activeRing)
                  : "border-divider/80",
                visual.text,
              )}
            >
              <Image
                src={seasonCardImageSrc(season)}
                alt=""
                fill
                sizes="126px"
                className="object-cover opacity-90"
              />
              <div
                className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/22 to-white/72"
                aria-hidden="true"
              />
              <div className="relative z-10 flex h-full flex-col justify-end">
                <div>
                  <div className="text-[14px] font-bold leading-tight">
                    {seasonLabel.name}
                  </div>
                  <div className="mt-0.5 text-[12px] font-semibold text-fg-secondary">
                    {seasonLabel.range}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <Timeline
        ref={timelineRef}
        onScroll={syncActiveSeasonFromScroll}
        className="mx-0 max-w-full pb-2 pt-1"
        aria-label={labels.timeline_title}
      >
        <TimelineItem
          className="min-w-full [--timeline-scale:0.72] min-[420px]:[--timeline-scale:0.78] sm:[--timeline-scale:0.86] md:[--timeline-scale:1]"
          style={{
            ...chartStyle,
            width: "calc(var(--timeline-total-width) * var(--timeline-scale))",
          }}
        >
          <div
            className="relative"
            style={{
              height:
                "calc(var(--timeline-chart-height) * var(--timeline-scale))",
              width:
                "calc(var(--timeline-total-width) * var(--timeline-scale))",
            }}
          >
            <div
              className="relative origin-top-left overflow-hidden rounded-[22px] bg-transparent"
              style={{
                height: `${chartHeight}px`,
                width: `${item.totalWidth}px`,
                transform: "scale(var(--timeline-scale))",
              }}
            >
              <Image
                src={backgroundSrc}
                alt=""
                fill
                sizes="(max-width: 768px) 1200px, 1600px"
                className="object-cover object-bottom opacity-[0.72] contrast-110 saturate-110"
              />
              <div className="absolute inset-0 bg-white/10" aria-hidden="true" />
              <div
                className="absolute z-0"
                style={{
                  left: 0,
                  top: `${GANTT_MONTH_HEADER_HEIGHT}px`,
                  width: `${item.chartWidth}px`,
                  bottom: 0,
                }}
                aria-hidden="true"
              >
                {item.months.map((month) => {
                  const visual = seasonVisual(month.season);
                  return (
                    <div
                      key={`${month.key}-season-bg`}
                      className={cn(
                        "absolute top-0 h-full border-r border-white/55 last:border-r-0",
                        visual.bg,
                      )}
                      style={{
                        left: `${month.left}px`,
                        width: `${month.width}px`,
                        opacity: 0.36,
                      }}
                    />
                  );
                })}
              </div>
              <div
                className="absolute z-0"
                style={{
                  left: 0,
                  top: `${GANTT_MONTH_HEADER_HEIGHT}px`,
                  width: `${item.chartWidth}px`,
                  height: "min(238px, 52%)",
                }}
                aria-hidden="true"
              >
                {item.months.map((month) => {
                  const visual = seasonVisual(month.season);
                  return (
                    <div
                      key={`${month.key}-season-top-bg`}
                      className={cn(
                        "absolute top-0 h-full border-r border-white/45 last:border-r-0",
                        visual.bg,
                      )}
                      style={{
                        left: `${month.left}px`,
                        width: `${month.width}px`,
                        opacity: 0.95,
                        maskImage:
                          "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                      }}
                    />
                  );
                })}
              </div>
              <div
                className="absolute z-0"
                style={{
                  left: 0,
                  top: `${GANTT_MONTH_HEADER_HEIGHT}px`,
                  width: `${item.chartWidth}px`,
                  bottom: 0,
                }}
                aria-hidden="true"
              >
                {item.months.flatMap((month) =>
                  month.tickLabels.map((tick) => (
                    <div
                      key={`${month.key}-${tick.key}`}
                      className="absolute top-0 h-full border-l border-dashed border-rose-200/60"
                      style={{ left: `${month.left + tick.left}px` }}
                    />
                  )),
                )}
              </div>

              {item.todayX != null ? (
                <div
                  className="absolute z-10 w-px bg-rose-400"
                  style={{
                    left: `${item.todayX}px`,
                    top: `${GANTT_MONTH_HEADER_HEIGHT - 3}px`,
                    bottom: 28,
                  }}
                  aria-hidden="true"
                />
              ) : null}

              <div className="absolute left-0 top-0 z-20 h-[54px]">
                <div
                  className="absolute top-[31px] h-px bg-rose-300"
                  style={{ left: 0, width: `${item.chartWidth}px` }}
                />
                {item.months.map((month) => (
                  <div
                    key={month.key}
                    className="absolute top-0 h-full"
                    style={{ left: `${month.left}px`, width: `${month.width}px` }}
                  >
                    <div className="text-[16px] font-semibold text-fg">
                      {month.label}
                    </div>
                    {month.tickLabels.map((tick) => (
                      <span
                        key={tick.key}
                        className={cn(
                          "absolute top-[38px] text-[11px] font-medium text-fg-muted",
                          tick.edge === "start"
                            ? "translate-x-0"
                            : tick.edge === "end"
                              ? "-translate-x-full"
                              : "-translate-x-1/2",
                        )}
                        style={{ left: `${tick.left}px` }}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              <ul aria-label={labels.timeline_title}>
                {item.events.map((event, index) => {
                  const visual = eventTimelineVisual(index);
                  const iconSrc = eventIconSrc(event.eventType, event.slug);
                  const rowTop =
                    GANTT_HEADER_HEIGHT +
                    eventTopOffset +
                    event.row * GANTT_ROW_HEIGHT;
                  return (
                    <li key={event.slug}>
                      <Link
                        href={`#event-${event.slug}`}
                        onClick={(clickEvent) =>
                          scrollToEventCard(clickEvent, event.slug)
                        }
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
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center"
                        >
                          <Image
                            src={iconSrc}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 object-contain transition-transform group-hover:scale-110"
                          />
                        </span>
                        <span className="min-w-0 truncate">{event.title}</span>
                        <span className="absolute left-[calc(100%+8px)] top-1/2 shrink-0 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold tabular-nums text-fg-secondary">
                          {event.dateLabel}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </TimelineItem>
      </Timeline>
    </div>
  );
}
