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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
