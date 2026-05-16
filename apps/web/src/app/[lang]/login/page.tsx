import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { lang } = await params;
  const { next, error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? `/${lang}/trips`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-[18px] font-bold text-white shadow-md">
            R
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight">
            {lang === "zh-TW" ? "登入 Roam" : "Sign in to Roam"}
          </h1>
          <p className="text-[13px] text-fg-muted">
            {lang === "zh-TW"
              ? "用 Email 登入，沒有帳號會自動建立。"
              : "Sign in with email — a new account is created automatically."}
          </p>
        </div>
        <LoginForm lang={lang} next={next} initialError={error} />
      </div>
    </div>
  );
}
