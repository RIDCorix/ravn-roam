import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { cityToIso } from "@/components/storefront/me/city-to-iso";
import { EsimWallet } from "@/components/storefront/me/esim-wallet";
import {
  WorldFootprints,
  type FootprintEntry,
} from "@/components/storefront/me/world-footprints";
import { listTrips, TripApiError } from "@/lib/trips-api";

import { LumiAvatarPicker } from "./avatar-picker";
import { SignOutButton } from "./signout-button";

import { getDictionary, hasLocale } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function MePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.me;
  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/me`);

  const currentAvatarId =
    (user.user_metadata?.lumi_avatar as string | undefined) ?? null;

  const footprintEntries = await loadFootprintEntries();

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-4">
      <WorldFootprints
        entries={footprintEntries}
        localeKey={localeKey}
        labels={{
          title: t.footprints_title,
          summary: t.footprints_summary,
          upcoming: t.footprints_upcoming,
          empty: t.footprints_empty,
        }}
      />
      <EsimWallet
        labels={{
          title: t.esim_wallet_title,
          summary: t.esim_wallet_summary,
          empty: t.esim_wallet_empty,
          pending: t.esim_wallet_pending,
          ready: t.esim_wallet_ready,
          shared: t.esim_wallet_shared,
          sync: t.esim_wallet_sync,
          syncing: t.esim_wallet_syncing,
          share: t.esim_wallet_share,
          sharing: t.esim_wallet_sharing,
          select_trip: t.esim_wallet_select_trip,
          profiles: t.esim_wallet_profiles,
        }}
      />
      <section className="rounded-2xl bg-surface p-5 shadow-xs">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {t.account}
        </div>
        <div className="mt-2 text-[16px] font-semibold tracking-tight">
          {user.email ?? user.id}
        </div>
        <div className="mt-0.5 text-[12px] text-fg-muted">
          {t.signed_in}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
            {t.lumi_avatar}
          </div>
          <p className="text-[12.5px] text-fg-muted">
            {t.lumi_avatar_hint}
          </p>
        </div>
        <div className="mt-4">
          <LumiAvatarPicker initialId={currentAvatarId} labels={{ saving: t.saving }} />
        </div>
      </section>

      <SignOutButton label={t.sign_out} />
    </div>
  );
}

async function loadFootprintEntries(): Promise<FootprintEntry[]> {
  try {
    const trips = await listTrips();
    const today = new Date().toISOString().slice(0, 10);
    // ApiTrip doesn't expose a country column, so derive ISO from the
    // first city we can resolve. Dedupe by ISO; visited wins over
    // upcoming when the same country appears in both past and future.
    const byIso = new Map<string, boolean>();
    for (const trip of trips) {
      let iso: string | null = null;
      for (const city of trip.cities ?? []) {
        const candidate = cityToIso(city);
        if (candidate) {
          iso = candidate;
          break;
        }
      }
      if (!iso) continue;
      const visited = trip.end_date < today;
      const prev = byIso.get(iso);
      byIso.set(iso, prev === true ? true : visited);
    }
    return Array.from(byIso, ([iso, visited]) => ({ iso, visited }));
  } catch (err) {
    if (err instanceof TripApiError && err.status === 401) return [];
    return [];
  }
}
