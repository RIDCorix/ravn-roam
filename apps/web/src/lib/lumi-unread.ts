// Tracks which Day tabs the user hasn't yet seen since Lumi last touched
// them. LumiAssistant writes to the set when an edit comes back with a
// `days` payload; trip-detail-tabs renders a yellow dot for each unread
// index and clears it when the user picks that day.
//
// State lives in localStorage (per-trip) and changes are broadcast via a
// CustomEvent so the assistant (which lives in the storefront shell) and
// the trip page (which renders the tabs) stay in sync without prop
// drilling.

const KEY_PREFIX = "roam-trip-unread-days:";
export const UNREAD_CHANGED_EVENT = "roam-unread-days-changed";

function storageKey(tripId: string): string {
  return `${KEY_PREFIX}${tripId}`;
}

function readSet(tripId: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n): n is number => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function writeSet(tripId: string, set: Set<number>): void {
  if (typeof window === "undefined") return;
  try {
    if (set.size === 0) {
      window.localStorage.removeItem(storageKey(tripId));
    } else {
      window.localStorage.setItem(
        storageKey(tripId),
        JSON.stringify(Array.from(set).sort((a, b) => a - b)),
      );
    }
    window.dispatchEvent(
      new CustomEvent(UNREAD_CHANGED_EVENT, { detail: { tripId } }),
    );
  } catch {
    /* localStorage may be unavailable (private mode, quota) — non-fatal. */
  }
}

export function getUnreadDays(tripId: string): Set<number> {
  return readSet(tripId);
}

export function markDaysUnread(tripId: string, indices: number[]): void {
  const set = readSet(tripId);
  let changed = false;
  for (const i of indices) {
    if (!set.has(i)) {
      set.add(i);
      changed = true;
    }
  }
  if (changed) writeSet(tripId, set);
}

export function markDayRead(tripId: string, index: number): void {
  const set = readSet(tripId);
  if (set.delete(index)) writeSet(tripId, set);
}

export function clearTripUnread(tripId: string): void {
  writeSet(tripId, new Set());
}
