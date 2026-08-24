import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";
import { PublicJourneyHeader } from "@/components/storefront/public-journey-header";
import { StorefrontPageTransition } from "@/components/storefront/storefront-page-transition";
import { LumiAssistant } from "@/components/storefront/trips/lumi-assistant";

import { getDictionary, hasLocale } from "../dictionaries";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  // Anonymous public browsing must remain available when auth is unavailable.
  // Auth-only actions still validate at their own API boundary.
  let user: Awaited<ReturnType<Awaited<ReturnType<typeof createSupabaseServerClient>>["auth"]["getUser"]>>["data"]["user"] = null;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }
  const lumiAvatarId =
    typeof user?.user_metadata?.lumi_avatar === "string"
      ? user.user_metadata.lumi_avatar
      : undefined;

  return (
    <div className="relative min-h-screen">
      <PublicJourneyHeader lang={lang} labels={dict.storefront.home.landing} />
      <StorefrontPageTransition>{children}</StorefrontPageTransition>
      {user ? (
        <LumiAssistant
          labels={dict.storefront.trips.lumi}
          avatarId={lumiAvatarId}
        />
      ) : null}
    </div>
  );
}
