import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createSupabaseServerClient } from "@roam/shared";

import { getDictionary, hasLocale } from "../../../dictionaries";
import { findRegionBySlug } from "@/lib/storefront-regions";
import { ShopRegionClient } from "@/components/storefront/shop/shop-region-client";

export const dynamic = "force-dynamic";

export default async function ShopRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, region: regionSlug } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.shop;
  const region = findRegionBySlug(regionSlug);
  if (!region) notFound();
  const localeKey: "zh-TW" | "en" = lang === "en" ? "en" : "zh-TW";
  const sp = await searchParams;
  const initialDays = pickNum(sp.days);
  const initialGb = pickNum(sp.gb);
  const initialQuantity = pickNum(sp.qty);
  const tripId = pickString(sp.trip_id);
  const checklistItemId = pickString(sp.checklist_id);
  const initialCoverageSlugs = pickList(sp.coverage).filter((slug) =>
    Boolean(findRegionBySlug(slug)),
  );
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const checkoutProfile = user
    ? {
        email: user.email ?? "",
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          "",
      }
    : null;

  return (
    <div className="min-h-full">
      {/* Hero with region photo */}
      <header className="relative h-[180px] overflow-hidden">
        <Image
          src={region.cover}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 flex items-start px-4 pt-3">
          <Link
            href={`/${lang}/shop`}
            aria-label="back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-surface-hover"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 text-white">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] drop-shadow-sm">
            {region.name[localeKey]}
          </h1>
          <div className="mt-0.5 text-[12.5px] opacity-90">
            {region.destinations.length} {t.destinations}
            {" · "}
            {region.destinations.slice(0, 6).join(" · ")}
            {region.destinations.length > 6 ? "…" : ""}
          </div>
        </div>
      </header>

      <div className="pt-4">
        <ShopRegionClient
          lang={lang}
          region={region}
          labels={t}
          initialDays={initialDays}
          initialGb={initialGb}
          initialCoverageSlugs={initialCoverageSlugs}
          initialQuantity={initialQuantity}
          checkoutTripContext={
            tripId
              ? {
                  tripId,
                  checklistItemId,
                }
              : null
          }
          checkoutProfile={checkoutProfile}
        />
      </div>
    </div>
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

function pickNum(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pickList(v: string | string[] | undefined): string[] {
  const values = Array.isArray(v) ? v : v ? [v] : [];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}
