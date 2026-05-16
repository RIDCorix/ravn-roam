import { notFound } from "next/navigation";

import { PageHeader } from "@/components/storefront/home-sections";
import { TripCard } from "@/components/storefront/trips/trip-card";
import type { Trip } from "@/lib/mock/consumer";
import { ensureSeededTrips } from "@/lib/seed-trips";
import { apiToTrip } from "@/lib/trip-mapping";
import { getTrip } from "@/lib/trips-api";

import { getDictionary, hasLocale } from "../../dictionaries";

// Per-user data fetched fresh from the API on every request.
export const dynamic = "force-dynamic";

export default async function TripsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.trips;

  // Seed the user's account from the design mock on first sign-in, then
  // hydrate each trip's days + checklist so trip-card can render counts.
  const summaries = await ensureSeededTrips();
  const trips: Trip[] = await Promise.all(
    summaries.map(async (s) => {
      const detail = await getTrip(s.id);
      return apiToTrip(detail.trip, detail.days, detail.checklist);
    }),
  );

  const active = trips.filter((trip) => trip.status === "active");
  const upcoming = trips
    .filter((trip) => trip.status === "upcoming")
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = trips
    .filter((trip) => trip.status === "past")
    .sort((a, b) => b.start.localeCompare(a.start));

  const liveCount = active.length + upcoming.length;
  const subtitle = format(t.list.subtitle, { count: String(liveCount) });

  return (
    <div>
      <PageHeader title={t.list.title} subtitle={subtitle} />
      <div className="flex flex-col gap-6 px-5 pt-1 pb-6">
        {active.length > 0 && (
          <TripGroup
            label={t.groups.active}
            trips={active}
            lang={lang}
            t={t}
          />
        )}
        {upcoming.length > 0 && (
          <TripGroup
            label={t.groups.upcoming}
            trips={upcoming}
            lang={lang}
            t={t}
          />
        )}
        {past.length > 0 && (
          <TripGroup
            label={t.groups.past}
            trips={past}
            lang={lang}
            t={t}
          />
        )}
        {liveCount === 0 && past.length === 0 && (
          <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
            {t.list.empty}
          </div>
        )}
      </div>
    </div>
  );
}

function TripGroup({
  label,
  trips,
  lang,
  t,
}: {
  label: string;
  trips: Trip[];
  lang: string;
  t: TripsDict;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {label}
        </span>
        <span
          className="text-[12px] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {trips.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            href={`/${lang}/trips/${trip.id}`}
            tasksLabel={t.card.tasks_label}
            daysUnit={t.card.days_unit}
            activeBadgeLabel={t.card.active_badge}
          />
        ))}
      </div>
    </section>
  );
}

type TripsDict =
  Awaited<ReturnType<typeof getDictionary>>["storefront"]["trips"];

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
