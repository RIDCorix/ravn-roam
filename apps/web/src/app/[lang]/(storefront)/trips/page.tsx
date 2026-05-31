import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { TripsListClient } from "@/components/storefront/trips/trips-list-client";

import { getDictionary, hasLocale } from "../../dictionaries";

// Keep the route per-request for auth-aware shell rendering, but do not
// block navigation on itinerary data. The client paints skeleton rows and
// hydrates from /api/storefront/trips.
export const dynamic = "force-dynamic";

export default async function TripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.trips;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/${lang}/trips${toSearch(sp)}`;
    redirect(`/${lang}/login?next=${encodeURIComponent(next)}`);
  }
  const initialDestination = pickString(sp.destination);

  return (
    <TripsListClient
      lang={lang}
      initialDestination={initialDestination}
      labels={{
        title: t.list.title,
        subtitle: t.list.subtitle,
        empty: t.list.empty,
        groups: t.groups,
        card: t.card,
        create: t.create,
      }}
    />
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

function toSearch(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) search.append(key, item);
      }
    } else if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
