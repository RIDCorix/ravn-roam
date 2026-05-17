// Client-side cache for trip detail. Components subscribe via
// `useTripDetail(id)`; mutations (Lumi edits, companion CRUD,
// checklist toggles) call `refreshTrip(id)` to revalidate the SWR
// entry instead of doing `router.refresh()`. That keeps RSC out of the
// hot path so a Lumi edit only re-renders the trip body, not the
// whole storefront shell.

import useSWR, { mutate as globalMutate } from "swr";

import type { TripDetailPayload } from "./trips-api";

export const tripKey = (id: string): readonly [string, string] => ["trip", id];

async function fetchTrip(id: string): Promise<TripDetailPayload> {
  const res = await fetch(`/api/trips/${id}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetch trip ${id} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TripDetailPayload;
}

export function useTripDetail(id: string, initialData?: TripDetailPayload) {
  return useSWR<TripDetailPayload>(
    tripKey(id),
    () => fetchTrip(id),
    {
      fallbackData: initialData,
      // The server already gave us fresh data on first render; skip the
      // automatic revalidate-on-mount so we don't hit the API twice.
      revalidateOnMount: initialData ? false : true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  );
}

/** Trigger a re-fetch of trip(id). Returns the fresh payload. */
export function refreshTrip(
  id: string,
): Promise<TripDetailPayload | undefined> {
  return globalMutate(tripKey(id));
}
