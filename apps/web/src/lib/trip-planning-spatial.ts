/**
 * R-301 D-1 and the interaction contract — the sheet's spatial model, as arithmetic.
 *
 * D-1, settled: on mobile the sheet opens at the MIDDLE detent, itinerary first. The
 * traveler sees 2-3 stops on first paint and the map keeps roughly 38% of the screen.
 * Corix adopted the recommendation directly rather than walking the pages, and the
 * spec changelog says so — so the 38% is a settled number, not a preference this code
 * may quietly re-tune. If it turns out not to hold up, that is `blocked_on_spec`.
 *
 * Kept out of the component because the release-velocity projection is the part most
 * likely to be wrong and least likely to be noticed: a sheet that lands on the wrong
 * detent still looks fine in a screenshot.
 */

export type SheetDetent = "low" | "mid" | "full";

export const SHEET_DETENTS: readonly SheetDetent[] = ["low", "mid", "full"] as const;

/**
 * Fraction of the viewport height the SHEET occupies at each detent. The map gets
 * what is left, minus the chrome the sheet must never cover.
 */
export const DETENT_SHEET_FRACTION: Readonly<Record<SheetDetent, number>> = {
  low: 0.24,
  mid: 0.62,
  full: 0.92,
} as const;

/** D-1: first entry on mobile. Itinerary first. */
export const DEFAULT_MOBILE_DETENT: SheetDetent = "mid";

/**
 * The number D-1 was decided against. Derived, not typed twice — if the mid fraction
 * ever moves, this moves with it and the test that pins it to 0.38 fails loudly
 * rather than the two numbers drifting apart in silence.
 */
export const MID_DETENT_MAP_VISIBLE_RATIO = Number(
  (1 - DETENT_SHEET_FRACTION.mid).toFixed(2),
);

/**
 * c-1: the sheet must not cover the bottom nav at any detent. The full detent stops
 * at 0.92 for exactly this reason, so this is a guard against a future edit, not a
 * runtime clamp anyone hits today.
 */
export const BOTTOM_NAV_RESERVED_FRACTION = 0.08;

export function sheetCoversBottomNav(detent: SheetDetent): boolean {
  return DETENT_SHEET_FRACTION[detent] > 1 - BOTTOM_NAV_RESERVED_FRACTION;
}

/**
 * Release projection. The spec's contract for letting go: "承接 release velocity,
 * 投影後選最近 detent" — carry the velocity into a projected resting point, THEN pick
 * the nearest detent to that projection. Not the nearest detent to where the finger
 * happened to be, which is what makes a flick feel like it was ignored.
 *
 * @param fraction  where the sheet is right now, as a fraction of viewport height
 * @param velocity  fraction of viewport height per second, positive = growing sheet
 */
export function projectRelease(fraction: number, velocity: number): SheetDetent {
  // 0.2s of decay is the usual iOS-ish projection constant. Long enough that a flick
  // reaches the next detent, short enough that a slow drag stays where it was put.
  const projected = clamp01(fraction + velocity * 0.2);
  return nearestDetent(projected);
}

export function nearestDetent(fraction: number): SheetDetent {
  const target = clamp01(fraction);
  let best: SheetDetent = SHEET_DETENTS[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const detent of SHEET_DETENTS) {
    const distance = Math.abs(DETENT_SHEET_FRACTION[detent] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = detent;
    }
  }
  return best;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * c-2: the triple that must survive opening a full view and coming back. "返回原本
 * 工作位置" is three facts, and restoring two of them is the bug — coming back to the
 * right day with the sheet collapsed loses the place just as completely.
 */
export type TripSpatialState = {
  dayId: string;
  itemId: string | null;
  detent: SheetDetent;
};

export function initialSpatialState(dayId: string): TripSpatialState {
  return { dayId, itemId: null, detent: DEFAULT_MOBILE_DETENT };
}

export function spatialStateEquals(a: TripSpatialState, b: TripSpatialState): boolean {
  return a.dayId === b.dayId && a.itemId === b.itemId && a.detent === b.detent;
}

/**
 * c-4: reduced motion does not mean no feedback. The spec is explicit — displacement
 * and spring are replaced by a short cross-fade, the feedback itself stays.
 */
export type MotionProfile = {
  kind: "spring" | "crossfade";
  durationMs: number;
};

export const SPRING_PROFILE: MotionProfile = { kind: "spring", durationMs: 420 };
export const REDUCED_MOTION_PROFILE: MotionProfile = { kind: "crossfade", durationMs: 120 };

export function motionProfile(prefersReducedMotion: boolean): MotionProfile {
  return prefersReducedMotion ? REDUCED_MOTION_PROFILE : SPRING_PROFILE;
}
