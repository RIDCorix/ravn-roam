import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { BackendTripsPage } from "@/components/storefront/trips/backend-trips-page";

import { getDictionary, hasLocale } from "../../dictionaries";

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

  return <BackendTripsPage lang={lang} labels={t.local} />;
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
