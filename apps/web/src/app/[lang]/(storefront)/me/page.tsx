import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

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
  await getDictionary(lang);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/me`);

  const currentAvatarId =
    (user.user_metadata?.lumi_avatar as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-4">
      <section className="rounded-2xl bg-surface p-5 shadow-xs">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {lang === "zh-TW" ? "帳號" : "Account"}
        </div>
        <div className="mt-2 text-[16px] font-semibold tracking-tight">
          {user.email ?? user.id}
        </div>
        <div className="mt-0.5 text-[12px] text-fg-muted">
          {lang === "zh-TW" ? "已登入" : "Signed in"}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
            {lang === "zh-TW" ? "Lumi 頭像" : "Lumi avatar"}
          </div>
          <p className="text-[12.5px] text-fg-muted">
            {lang === "zh-TW"
              ? "選一個你喜歡的 Lumi 樣子。"
              : "Pick the Lumi look you like best."}
          </p>
        </div>
        <div className="mt-4">
          <LumiAvatarPicker initialId={currentAvatarId} lang={lang} />
        </div>
      </section>

      <SignOutButton lang={lang} />
    </div>
  );
}
