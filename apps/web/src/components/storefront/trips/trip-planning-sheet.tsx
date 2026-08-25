"use client";

/**
 * R-301 — the trip planning bottom sheet.
 *
 * This is where D-1 and D-2 stop being data and become the screen. The arithmetic
 * lives in `@/lib/trip-planning-spatial` and the field contract in
 * `@/lib/trip-planning-depth`, both of which are unit-gated; this component is the
 * only thing that renders them, so a field that is not in the depth map cannot appear
 * on the sheet without the c-3 test contradicting it.
 *
 * D-1: opens at the mid detent, itinerary first, map keeping ~38%.
 * D-2: compact rows are universal; the full view expands by item type; closing it
 *      returns to the same day, the same item and the same detent.
 */

import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  type TripItemType,
  compactFieldsFor,
  fullViewFieldsFor,
  itemTypeForStopKind,
  ticketBookingStatus,
} from "@/lib/trip-planning-depth";
import {
  DETENT_SHEET_FRACTION,
  type SheetDetent,
  type TripSpatialState,
  initialSpatialState,
  motionProfile,
  projectRelease,
} from "@/lib/trip-planning-spatial";
import { cn } from "@/lib/utils";

export type PlanningSheetItem = {
  id: string;
  name: string;
  kind: string;
  arrivalTime?: string | null;
  durationMin?: number | null;
  note?: string | null;
  placeName?: string | null;
  attachmentCount: number;
  ticketRequired: boolean;
};

export type PlanningSheetDay = {
  id: string;
  date: string;
  city: string;
  items: PlanningSheetItem[];
};

export type PlanningDepthLabels = {
  fields: Record<string, string>;
  ticket_status: Record<string, string>;
  item_type: Record<string, string>;
  detent: Record<string, string>;
  more: string;
  back_to_itinerary: string;
};

/**
 * `prefers-reduced-motion`, read live. Not read once at mount: the user can flip the
 * OS setting while the page is open, and c-4 emulates it per test rather than per
 * page load.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  // useSyncExternalStore rather than useEffect+setState: the preference is external
  // state that exists before the first paint, so seeding it from an effect renders
  // one frame of the wrong motion profile — the exact frame c-4 is about.
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false, // server: assume full motion, then correct on hydration
  );
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function TripPlanningSheet({
  days,
  labels,
  initialDayId,
}: {
  days: PlanningSheetDay[];
  labels: PlanningDepthLabels;
  initialDayId?: string;
}) {
  const firstDayId = initialDayId ?? days[0]?.id ?? "";
  const [state, setState] = useState<TripSpatialState>(() => initialSpatialState(firstDayId));
  const [fullViewOpen, setFullViewOpen] = useState(false);
  /**
   * c-2's whole point. The full view is a different surface, so the triple it must
   * come back to is captured on the way in rather than reconstructed on the way out —
   * reconstructing it is how the detent gets lost while the day survives.
   */
  const restoreRef = useRef<TripSpatialState | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const profile = motionProfile(prefersReducedMotion);

  // Live drag. `dragFraction` is null except mid-gesture, so the sheet is driven by
  // the detent the rest of the time and a re-render cannot strand it off-detent.
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startFraction: number; lastY: number; lastT: number; velocity: number } | null>(null);

  const activeDay = useMemo(
    () => days.find((day) => day.id === state.dayId) ?? days[0],
    [days, state.dayId],
  );
  const activeItem = useMemo(
    () => activeDay?.items.find((item) => item.id === state.itemId) ?? null,
    [activeDay, state.itemId],
  );

  const fraction = dragFraction ?? DETENT_SHEET_FRACTION[state.detent];

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startY: event.clientY,
        startFraction: DETENT_SHEET_FRACTION[state.detent],
        lastY: event.clientY,
        lastT: event.timeStamp,
        velocity: 0,
      };
      setDragFraction(DETENT_SHEET_FRACTION[state.detent]);
    },
    [state.detent],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const height = window.innerHeight || 1;
    // 1:1 with the finger, measured from where the grab started rather than from the
    // detent — this is the "保留 grab offset" half of the contract. Dragging up grows
    // the sheet, so the sign is inverted against clientY.
    const delta = (drag.startY - event.clientY) / height;
    const next = Math.min(1, Math.max(0, drag.startFraction + delta));
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.velocity = ((drag.lastY - event.clientY) / height) / (dt / 1000);
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    setDragFraction(next);
  }, []);

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    const current = dragFraction ?? drag.startFraction;
    // Velocity is projected before the nearest detent is chosen. Picking the nearest
    // detent to the finger instead is what makes a flick feel ignored.
    const landed = projectRelease(current, drag.velocity);
    dragRef.current = null;
    setDragFraction(null);
    setState((prev) => ({ ...prev, detent: landed }));
  }, [dragFraction]);

  const openFullView = useCallback((itemId: string) => {
    setState((prev) => {
      const next = { ...prev, itemId };
      restoreRef.current = next;
      return next;
    });
    setFullViewOpen(true);
  }, []);

  const closeFullView = useCallback(() => {
    setFullViewOpen(false);
    const restore = restoreRef.current;
    if (restore) setState(restore);
  }, []);

  const selectDay = useCallback((dayId: string) => {
    setState((prev) => ({ ...prev, dayId, itemId: null }));
  }, []);

  if (!activeDay) return null;

  const itemType: TripItemType = activeItem ? itemTypeForStopKind(activeItem.kind) : "place";

  return (
    <div
      data-testid="trip-planning-sheet"
      data-detent={state.detent}
      data-day={state.dayId}
      data-item={state.itemId ?? ""}
      data-motion={profile.kind}
      data-full-view={fullViewOpen ? "open" : "closed"}
      className={cn(
        // The bottom nav is `fixed ... z-20` at `bottom: 16px + safe-area` and is 78px
        // tall (storefront/shell.tsx), and it is `md:hidden`. Anchoring the sheet at
        // bottom-0 put it ON TOP of the nav — a higher z-index does not "reserve"
        // anything, and capping the height at 0.92 reserved that space at the TOP of
        // the viewport where nothing needed it. The inset is a variable so the height
        // below is computed against the space that is actually free.
        "fixed inset-x-0 z-40 flex flex-col rounded-t-[22px] border-t border-divider bg-paper-raised shadow-[var(--shadow-xl)] xl:hidden",
        "[--roam-nav-inset:calc(94px+env(safe-area-inset-bottom))] md:[--roam-nav-inset:0px]",
        // Reduced transparency and higher contrast get their own treatment rather
        // than being folded into the default: the sheet is the only surface on this
        // screen that sits over the map, so it is the one that has to stay legible.
        "supports-[backdrop-filter]:bg-paper-raised/95 supports-[backdrop-filter]:backdrop-blur-xl",
        "[@media(prefers-reduced-transparency:reduce)]:bg-paper-raised [@media(prefers-reduced-transparency:reduce)]:backdrop-filter-none",
        "[@media(prefers-contrast:more)]:border-fg [@media(prefers-contrast:more)]:border-t-2",
        // Full motion: the height itself animates. Reduced motion: the height snaps
        // and the CONTENT cross-fades instead (see the keyed wrapper below). Going
        // inert would be a regression dressed up as an accommodation.
        dragFraction === null && !prefersReducedMotion && "transition-[height] ease-out",
        prefersReducedMotion && "transition-[height] duration-0",
      )}
      style={{
        bottom: "var(--roam-nav-inset)",
        // Fraction of the space ABOVE the nav, not of the viewport. This is what makes
        // D-1's "map keeps ~38%" a measurable claim rather than an aspiration.
        height: `calc(${fraction.toFixed(4)} * (100svh - var(--roam-nav-inset)))`,
        // Only the spring profile animates the HEIGHT. Under reduced motion the inline
        // duration was still 120ms and beat the `duration-0` class, so the sheet kept
        // sliding while claiming to cross-fade — the exact masking c-4 exists to catch.
        transitionDuration:
          dragFraction === null && profile.kind === "spring"
            ? `${profile.durationMs}ms`
            : "0s",
      }}
    >
      {/* Grab handle. Its own element so the drag target is the handle and the list
          below stays scrollable — a whole-sheet drag target eats the scroll. */}
      <div
        data-testid="trip-planning-sheet-handle"
        role="slider"
        tabIndex={0}
        aria-label={labels.detent[state.detent] ?? "sheet"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="shrink-0 cursor-grab touch-none py-3 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          // Keyboard parity: the detents are reachable without a pointer, which is
          // also what lets c-2 change detent deterministically.
          const order: SheetDetent[] = ["low", "mid", "full"];
          const index = order.indexOf(state.detent);
          if (event.key === "ArrowUp" && index < order.length - 1) {
            event.preventDefault();
            setState((prev) => ({ ...prev, detent: order[index + 1]! }));
          }
          if (event.key === "ArrowDown" && index > 0) {
            event.preventDefault();
            setState((prev) => ({ ...prev, detent: order[index - 1]! }));
          }
        }}
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-divider-strong" />
      </div>

      {/* Keyed on the state the height animation would otherwise have expressed. Under
          reduced motion the key change remounts this and replays a 120ms opacity
          cross-fade; under full motion the class is absent and the height transition
          above carries the change instead. */}
      <div
        key={prefersReducedMotion ? `${state.detent}-${fullViewOpen}` : "static"}
        data-testid="trip-planning-sheet-body"
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          prefersReducedMotion && "roam-sheet-crossfade",
        )}
      >
      {fullViewOpen && activeItem ? (
        <FullView
          item={activeItem}
          type={itemType}
          labels={labels}
          onBack={closeFullView}
        />
      ) : (
        <>
          <div
            data-testid="trip-planning-day-rail"
            className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-2"
          >
            {days.map((day) => (
              <button
                key={day.id}
                type="button"
                data-testid="trip-planning-day-chip"
                data-day-id={day.id}
                aria-pressed={day.id === state.dayId}
                onClick={() => selectDay(day.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold",
                  day.id === state.dayId
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-divider text-fg-secondary",
                )}
              >
                {day.city}
                <span className="ml-1.5 font-mono text-[10px] text-fg-muted">{day.date}</span>
              </button>
            ))}
          </div>

          <ul
            data-testid="trip-planning-item-list"
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
          >
            {activeDay.items.map((item) => (
              <CompactRow
                key={item.id}
                item={item}
                labels={labels}
                selected={item.id === state.itemId}
                onSelect={() => setState((prev) => ({ ...prev, itemId: item.id }))}
                onOpenFullView={() => openFullView(item.id)}
              />
            ))}
          </ul>
        </>
      )}
      </div>
    </div>
  );
}

/**
 * D-2's outer layer. Universal by construction: the fields come from
 * `compactFieldsFor`, which ignores the item type on purpose, so this component
 * cannot grow a type-specific branch without the contract changing first.
 */
function CompactRow({
  item,
  labels,
  selected,
  onSelect,
  onOpenFullView,
}: {
  item: PlanningSheetItem;
  labels: PlanningDepthLabels;
  selected: boolean;
  onSelect: () => void;
  onOpenFullView: () => void;
}) {
  const status = ticketBookingStatus(item.attachmentCount, item.ticketRequired);
  const fields = compactFieldsFor(itemTypeForStopKind(item.kind));

  return (
    <li
      data-testid="trip-planning-compact-item"
      data-item-id={item.id}
      data-selected={selected ? "true" : "false"}
      className={cn(
        "mb-2 rounded-2xl border px-3 py-3",
        selected ? "border-accent bg-accent/5" : "border-divider bg-paper",
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <p className="truncate text-[15px] font-semibold text-fg">{item.name}</p>
        <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {fields.map((field) => {
            if (field === "ticket_booking") return null;
            const value =
              field === "datetime" ? (item.arrivalTime ?? "—") : formatDuration(item.durationMin);
            return (
              <div key={field} className="flex items-baseline gap-1.5">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
                  {labels.fields[field]}
                </dt>
                <dd className="font-mono text-[12px] text-fg-secondary">{value}</dd>
              </div>
            );
          })}
        </dl>
      </button>

      {/* Ticket & booking is a visible row, not a More affordance. The spec is
          explicit that a museum ticket, a booking screenshot and a rail pass all need
          an entry point without opening the full view. */}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-divider pt-2">
        <span
          data-testid="trip-planning-ticket-status"
          data-status={status}
          className="flex items-center gap-1.5 text-[12px] text-fg-secondary"
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {labels.fields.ticket_booking}
          <span className="font-semibold text-fg">{labels.ticket_status[status]}</span>
        </span>
        <button
          type="button"
          data-testid="trip-planning-more"
          onClick={onOpenFullView}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-accent"
        >
          {labels.more}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/** D-2's inner layer — the only place that branches on item type. */
function FullView({
  item,
  type,
  labels,
  onBack,
}: {
  item: PlanningSheetItem;
  type: TripItemType;
  labels: PlanningDepthLabels;
  onBack: () => void;
}) {
  const status = ticketBookingStatus(item.attachmentCount, item.ticketRequired);
  return (
    <div
      data-testid="trip-planning-full-view"
      data-item-type={type}
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
    >
      <button
        type="button"
        data-testid="trip-planning-full-view-back"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-accent"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {labels.back_to_itinerary}
      </button>
      <p className="text-[11px] uppercase tracking-[0.14em] text-fg-muted">
        {labels.item_type[type]}
      </p>
      <h2 className="mt-1 text-[20px] font-semibold text-fg">{item.name}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {fullViewFieldsFor(type).map((field) => (
          <div key={field} data-testid="trip-planning-full-field" data-field={field}>
            <dt className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              {labels.fields[field]}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] text-fg">
              {field === "ticket_booking"
                ? labels.ticket_status[status]
                : field === "datetime"
                  ? (item.arrivalTime ?? "—")
                  : field === "duration"
                    ? formatDuration(item.durationMin)
                    : field === "place_anchor"
                      ? (item.placeName ?? item.name)
                      : field === "note"
                        ? (item.note ?? "—")
                        : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
