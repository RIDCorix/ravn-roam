"use client";

// R-301 trip planning surface.
//
// One continuous space: the map gives position, the sheet carries the
// planning work, and the tools appear with the selection. The numbers the
// spec argues about live in `planner-model.ts`; this file renders them.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Paperclip, Sparkles, Ticket, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildChecklistEsimShopHref, buildShopHref } from "@/lib/shop-link";
import { cn } from "@/lib/utils";

import {
  DETENT_SHEET_FRACTION,
  DEFAULT_PLANNER_DETENT,
  PLANNER_DETENTS,
  buildOverviewRows,
  detentHeights,
  dragHeight,
  findItem,
  plannerShopFilter,
  resolveReleaseDetent,
  stayRowForDay,
  type PlannerDetent,
  type PlannerItem,
  type PlannerTrip,
} from "./planner-model";
import { fill, type PlannerLabels } from "./planner-labels";
import {
  PlannerFullView,
  type PlannerItemDraft,
} from "./planner-full-view";
import type { PlannerMapPlace, PlannerMapStop } from "./planner-map";

const PlannerMapDyn = dynamic(
  () => import("./planner-map").then((mod) => mod.PlannerMap),
  {
    ssr: false,
    loading: () => <div className="planner-map__placeholder" />,
  },
);

type EditMap = Record<string, PlannerItemDraft>;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function applyEdits(trip: PlannerTrip, edits: EditMap): PlannerTrip {
  if (Object.keys(edits).length === 0) return trip;
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const draft = edits[item.id];
        if (!draft) return item;
        return {
          ...item,
          title: draft.title,
          date: draft.date,
          startTime: draft.startTime,
          durationMin: draft.durationMin,
          ticket: { ...draft.ticket },
          fields: { ...item.fields, ...draft.fields },
        } as PlannerItem;
      }),
    })),
  };
}

export function PlannerWorkspace({
  lang,
  trip: baseTrip,
  labels,
}: {
  lang: string;
  trip: PlannerTrip;
  labels: PlannerLabels;
}) {
  const [edits, setEdits] = useState<EditMap>({});
  const [dayIndex, setDayIndex] = useState(0);
  const [detent, setDetent] = useState<PlannerDetent>(DEFAULT_PLANNER_DETENT);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [planningSpace, setPlanningSpace] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const trip = useMemo(() => applyEdits(baseTrip, edits), [baseTrip, edits]);
  const rows = useMemo(() => buildOverviewRows(trip.days), [trip.days]);
  const day = trip.days[dayIndex] ?? trip.days[0]!;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => baseTrip.days[0]?.items[0]?.id ?? null,
  );
  const selectedItem = findItem(trip, selectedItemId);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    startHeight: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);

  // ---- geometry ----------------------------------------------------------
  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const measure = () =>
      setPlanningSpace(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ---- the full view is a page, so hardware back closes it ---------------
  useEffect(() => {
    const onPopState = () => setFullViewOpen(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openFullView = useCallback(() => {
    window.history.pushState({ plannerFullView: true }, "", window.location.href);
    setFullViewOpen(true);
  }, []);

  const closeFullView = useCallback(() => {
    if (window.history.state?.plannerFullView) {
      window.history.back();
      return;
    }
    setFullViewOpen(false);
  }, []);

  // ---- drag: 1:1, interruptible, release velocity carries over -----------
  const onHandlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const sheet = sheetRef.current;
    if (!sheet || planningSpace <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // Reading the live box mid-animation is what makes the gesture
    // interruptible: we continue from where the sheet actually is.
    const height = sheet.getBoundingClientRect().height;
    sheet.classList.add("is-dragging");
    sheet.style.setProperty("--planner-sheet-height", `${height}px`);
    drag.current = {
      startHeight: height,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
    };
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const sheet = sheetRef.current;
    if (!state || !sheet) return;
    const heights = detentHeights(planningSpace);
    const next = dragHeight({
      startHeight: state.startHeight,
      startPointerY: state.startY,
      pointerY: event.clientY,
      minHeight: heights.map,
      maxHeight: heights.full,
    });
    sheet.style.setProperty("--planner-sheet-height", `${next}px`);
    const now = performance.now();
    const elapsed = Math.max(1, now - state.lastT);
    const instant = (state.lastY - event.clientY) / elapsed;
    state.velocity = state.velocity * 0.7 + instant * 0.3;
    state.lastY = event.clientY;
    state.lastT = now;
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const sheet = sheetRef.current;
    if (!state || !sheet) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const height = sheet.getBoundingClientRect().height;
    drag.current = null;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("--planner-sheet-height");
    setDetent(
      resolveReleaseDetent({ height, velocity: state.velocity, planningSpace }),
    );
  };

  const onHandleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const index = PLANNER_DETENTS.indexOf(detent);
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setDetent(PLANNER_DETENTS[Math.min(PLANNER_DETENTS.length - 1, index + 1)]!);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setDetent(PLANNER_DETENTS[Math.max(0, index - 1)]!);
    }
  };

  // ---- map ---------------------------------------------------------------
  const activeStay = stayRowForDay(rows, dayIndex + 1);
  const mapPlaces: PlannerMapPlace[] = trip.places.map((place, index) => ({
    key: place.key,
    name: place.name,
    order: index + 1,
    lat: place.lat,
    lng: place.lng,
    active: place.key === (activeStay?.placeKey ?? day.placeKey),
  }));
  const mapStops: PlannerMapStop[] = day.items.flatMap((item) =>
    typeof item.lat === "number" && typeof item.lng === "number"
      ? [{ id: item.id, name: item.title, lat: item.lat, lng: item.lng }]
      : [],
  );

  // ---- purchase handoff --------------------------------------------------
  const shopFilter = plannerShopFilter(trip);
  const lumiHref = buildShopHref(lang, shopFilter, { tripId: trip.id });
  const esimItem = trip.checklist.find((item) => item.kind === "esim");
  const esimHref = esimItem
    ? buildChecklistEsimShopHref(lang, esimItem, {
        tripId: trip.id,
        checklistItemId: esimItem.id,
      })
    : null;

  const selectDay = (index: number) => {
    setDayIndex(index);
    setSelectedItemId(trip.days[index]?.items[0]?.id ?? null);
  };

  const saveDraft = (draft: PlannerItemDraft) => {
    if (!selectedItemId) return;
    setEdits((prev) => ({ ...prev, [selectedItemId]: draft }));
  };

  return (
    <div
      className="planner"
      data-testid="planner"
      data-detent={detent}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-planning-space={Math.round(planningSpace)}
      style={
        {
          "--planner-sheet-fraction": String(DETENT_SHEET_FRACTION[detent]),
        } as React.CSSProperties
      }
    >
      <header
        className="planner-chrome planner-topbar"
        data-testid="planner-top-chrome"
      >
        <h1 className="planner-topbar__title" data-testid="planner-trip-title">
          {trip.title}
        </h1>
        <p className="planner-topbar__meta" data-testid="planner-trip-meta">
          {fill(labels.trip_meta, {
            days: trip.days.length,
            places: trip.places.length,
          })}
        </p>
      </header>

      <div className="planner-body" ref={bodyRef} data-testid="planner-body">
        <div className="planner-map" data-testid="planner-map">
          <PlannerMapDyn
            places={mapPlaces}
            stops={mapStops}
            activeKey={activeStay?.placeKey ?? day.placeKey}
          />
        </div>

        <section
          className="planner-sheet"
          ref={sheetRef}
          aria-label={labels.sheet.region}
          data-testid="planner-sheet"
        >
          <div className="planner-sheet__handle-row">
            <button
              type="button"
              className="planner-grabber"
              aria-label={labels.sheet.handle_aria}
              data-testid="planner-sheet-handle"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onHandleKeyDown}
            >
              <span aria-hidden className="planner-grabber__bar" />
            </button>
            <div className="planner-detents" role="group" aria-label={labels.sheet.region}>
              {PLANNER_DETENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="planner-detent"
                  data-active={value === detent}
                  data-testid={`planner-detent-${value}`}
                  aria-pressed={value === detent}
                  onClick={() => setDetent(value)}
                >
                  {value === "map"
                    ? labels.sheet.detent_map
                    : value === "plan"
                      ? labels.sheet.detent_plan
                      : labels.sheet.detent_full}
                </button>
              ))}
            </div>
          </div>

          <div
            className="planner-sheet__scroll"
            key={reducedMotion ? `detent-${detent}` : "sheet"}
            data-testid="planner-sheet-content"
          >
            <div
              className="planner-day-strip"
              role="group"
              aria-label={labels.sheet.region}
            >
              {trip.days.map((entry, index) => (
                <button
                  key={entry.date}
                  type="button"
                  className="planner-day-chip"
                  data-active={index === dayIndex}
                  data-testid="planner-day-chip"
                  data-day={index + 1}
                  aria-pressed={index === dayIndex}
                  onClick={() => selectDay(index)}
                >
                  <span className="planner-day-chip__n">
                    {fill(labels.day.label, { n: index + 1 })}
                  </span>
                  <span className="planner-day-chip__place">{entry.place}</span>
                </button>
              ))}
            </div>

            {selectedItem ? (
              <CompactItemCard
                item={selectedItem}
                labels={labels}
                onMore={openFullView}
              />
            ) : null}

            <ol className="planner-items" data-testid="planner-items">
              {day.items.length === 0 ? (
                <li className="planner-items__empty">{labels.day.empty}</li>
              ) : (
                day.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="planner-item-row"
                      data-testid="planner-item-row"
                      data-item-id={item.id}
                      data-item-type={item.type}
                      data-selected={item.id === selectedItemId}
                      aria-label={fill(labels.item.select_aria, {
                        title: item.title,
                      })}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span
                        className="planner-item-row__time"
                        data-testid="planner-item-time"
                      >
                        {item.startTime}
                      </span>
                      <span className="planner-item-row__body">
                        <span
                          className="planner-item-row__title"
                          data-testid="planner-item-title"
                        >
                          {item.title}
                        </span>
                        <span className="planner-item-row__meta">
                          {labels.item.types[item.type]} ·{" "}
                          {fill(labels.item.duration_value, {
                            minutes: item.durationMin,
                          })}
                        </span>
                      </span>
                      <ChevronRight
                        className="planner-item-row__chevron"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))
              )}
            </ol>

            <section className="planner-overview" data-testid="planner-overview">
              <h2 className="planner-section__heading">
                {labels.overview.title}
              </h2>
              <ol className="planner-overview__rows">
                {rows.map((row) =>
                  row.kind === "stay" ? (
                    <li
                      key={row.id}
                      className="planner-stay"
                      data-testid="planner-overview-row"
                      data-row-kind="stay"
                      data-place={row.placeKey}
                    >
                      <div className="planner-stay__head">
                        <span className="planner-stay__place">{row.place}</span>
                        <span className="planner-stay__range">
                          {row.dayNumbers.length === 1
                            ? fill(labels.overview.day_range_single, {
                                start: row.dayNumbers[0]!,
                              })
                            : fill(labels.overview.day_range, {
                                start: row.dayNumbers[0]!,
                                end: row.dayNumbers[row.dayNumbers.length - 1]!,
                              })}
                        </span>
                      </div>
                      <ul className="planner-stay__days">
                        {row.days.map((entry) => (
                          <li key={entry.date}>
                            <button
                              type="button"
                              className="planner-stay__day"
                              data-testid="planner-overview-day"
                              data-day={entry.dayNumber}
                              data-active={entry.dayNumber === dayIndex + 1}
                              onClick={() => selectDay(entry.dayNumber - 1)}
                            >
                              <span>
                                {fill(labels.day.label, { n: entry.dayNumber })}
                              </span>
                              <span className="planner-stay__summary">
                                {fill(labels.overview.day_summary, {
                                  stops: entry.stopCount,
                                  items: entry.itemCount,
                                })}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : (
                    <li
                      key={row.id}
                      className="planner-travel"
                      data-testid="planner-overview-row"
                      data-row-kind="travel"
                      data-day={row.dayNumber}
                    >
                      <button
                        type="button"
                        className="planner-travel__button"
                        data-active={row.dayNumber === dayIndex + 1}
                        onClick={() => selectDay(row.dayNumber - 1)}
                      >
                        <span className="planner-travel__label">
                          {labels.overview.travel_day}
                        </span>
                        <span className="planner-travel__route">
                          {fill(labels.overview.travel_route, {
                            from: row.from,
                            to: row.to,
                          })}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ol>
              <p className="planner-legend" data-testid="planner-legend">
                <span className="planner-legend__swatch is-active" aria-hidden />
                {labels.overview.legend_selected}
                <span className="planner-legend__swatch" aria-hidden />
                {labels.overview.legend_neutral}
              </p>
            </section>

            <section className="planner-lumi" data-testid="planner-lumi">
              <h2 className="planner-section__heading">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                {labels.lumi.title}
              </h2>
              <p className="planner-lumi__body">
                {fill(labels.lumi.body, {
                  days: trip.days.length,
                  country: trip.countryName,
                })}
              </p>
              <a
                className="planner-cta"
                href={lumiHref}
                data-testid="planner-lumi-cta"
              >
                {labels.lumi.cta}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
            </section>

            <section className="planner-checklist" data-testid="planner-checklist">
              <h2 className="planner-section__heading">
                {labels.checklist.title}
              </h2>
              <ul className="planner-checklist__rows">
                {trip.checklist.map((item) => (
                  <li key={item.id} className="planner-checklist__row">
                    <span
                      className="planner-checklist__text"
                      data-done={item.done}
                    >
                      {item.text}
                    </span>
                    {item.kind === "esim" && esimHref ? (
                      <a
                        className="planner-cta planner-cta--small"
                        href={esimHref}
                        data-testid="planner-checklist-esim-cta"
                      >
                        {labels.checklist.esim_cta}
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>

      {fullViewOpen && selectedItem ? (
        <PlannerFullView
          key={selectedItem.id}
          item={selectedItem}
          labels={labels}
          onSave={saveDraft}
          onClose={closeFullView}
        />
      ) : null}
    </div>
  );
}

const TICKET_ICON = {
  missing: Ticket,
  needed: Upload,
  attached: Paperclip,
} as const;

function CompactItemCard({
  item,
  labels,
  onMore,
}: {
  item: PlannerItem;
  labels: PlannerLabels;
  onMore: () => void;
}) {
  const TicketIcon = TICKET_ICON[item.ticket.state];
  return (
    <article
      className="planner-compact"
      data-testid="planner-compact-card"
      data-item-id={item.id}
      data-item-type={item.type}
    >
      <header className="planner-compact__head">
        <div className="planner-compact__headings">
          <span className="planner-compact__type">
            {labels.item.types[item.type]}
          </span>
          <h2
            className="planner-compact__title"
            data-testid="planner-compact-title"
          >
            {item.title}
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 shrink-0 rounded-full px-3")}
          onClick={onMore}
          data-testid="planner-more"
        >
          {labels.item.more}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </header>

      {/* Universal core only. Type-specific fields live in the full view. */}
      <dl className="planner-compact__core">
        <div className="planner-compact__cell" data-field="date">
          <dt>{labels.item.date}</dt>
          <dd>{item.date}</dd>
        </div>
        <div className="planner-compact__cell" data-field="startTime">
          <dt>{labels.item.start_time}</dt>
          <dd>{item.startTime}</dd>
        </div>
        <div className="planner-compact__cell" data-field="durationMin">
          <dt>{labels.item.duration}</dt>
          <dd>
            {fill(labels.item.duration_value, { minutes: item.durationMin })}
          </dd>
        </div>
      </dl>

      {/* Ticket & booking is never hidden behind More. */}
      <div
        className="planner-ticket"
        data-field="ticket"
        data-ticket-state={item.ticket.state}
        data-testid="planner-ticket-row"
      >
        <TicketIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="planner-ticket__title">{labels.ticket.title}</span>
        <span className="planner-ticket__state">
          {labels.ticket[item.ticket.state]}
        </span>
      </div>
    </article>
  );
}
