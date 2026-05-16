import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { DEFAULT_LUMI_AVATAR_ID } from "@/components/storefront/lumi-avatar";
import { StorefrontShell } from "@/components/storefront/shell";
import { getLumiContext } from "@/lib/lumi-context";

import { getDictionary, hasLocale } from "../dictionaries";

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
    (user?.user_metadata?.lumi_avatar as string | undefined) ??
    DEFAULT_LUMI_AVATAR_ID;
  const lumiContext = user ? await getLumiContext() : null;
  const t = dict.storefront.trips;
  const lumiLabels = {
    name: t.lumi.name,
    placeholder: t.lumi.placeholder,
    open: t.lumi.open,
    close: t.lumi.close,
    send: t.lumi.send,
    thinking: t.lumi.thinking,
    no_trip_hint: t.lumi.no_trip_hint,
    history_title: t.lumi.history_title,
    new_chat: t.lumi.new_chat,
    delete_chat: t.lumi.delete_chat,
    empty_history: t.lumi.empty_history,
    draft_days_unit: t.lumi.draft_days_unit,
    draft_create: t.lumi.draft_create,
    draft_creating: t.lumi.draft_creating,
    draft_created: t.lumi.draft_created,
  };

  return (
    <StorefrontShell
      lang={lang}
      labels={dict.storefront.nav}
      lumiLabels={user ? lumiLabels : null}
      lumiAvatarId={lumiAvatarId}
      lumiContext={lumiContext}
    >
      {children}
    </StorefrontShell>
  );
}
