import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

import { apiToTrip } from "@/lib/trip-mapping";
import { listTrips } from "@/lib/trips-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  /* Keep the list endpoint cheap. Trip detail currently geocodes cities
     and stops, which is useful for the detail map but far too expensive
     for a tab switch. The list uses trip headers only; the detail page
     fetches days/checklist/map data after the user opens one trip. */
  const summaries = await listTrips();
  const trips = summaries.map((summary) => apiToTrip(summary));

  return NextResponse.json({ trips });
}
