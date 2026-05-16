import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { AcceptInviteButton } from "./accept-button";

import { getDictionary, hasLocale } from "../../dictionaries";

export const dynamic = "force-dynamic";

interface InvitePreview {
  invite: {
    companion_id: string;
    display_name: string;
    color: string;
    trip_id: string;
    trip_title: string;
    start_date: string;
    end_date: string;
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang, token } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.trips.invite;

  // Hit the API directly with the same host's bridge; on the server we
  // can also talk to the Hono API directly. Use the bridge so cookies
  // ride along for any future auth checks.
  const apiBase = process.env.ROAM_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${apiBase}/invite/${token}`, { cache: "no-store" });
  if (!res.ok) {
    const reason = res.status === 409 ? t.already_joined : t.invalid;
    return <InviteError reason={reason} />;
  }
  const data = (await res.json()) as InvitePreview;
  const invite = data.invite;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;
  const nextPath = `/${lang}/invite/${token}`;

  const headerText = format(t.title_template, {
    name: invite.display_name,
    title: invite.trip_title,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-xs">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full text-[20px] font-bold text-white"
          style={{ background: invite.color }}
        >
          {invite.display_name.trim().charAt(0)}
        </span>
        <h1 className="mt-4 text-[18px] font-semibold tracking-tight">
          {headerText}
        </h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          {invite.start_date} → {invite.end_date}
        </p>

        <div className="mt-6">
          {signedIn ? (
            <AcceptInviteButton lang={lang} token={token} labels={t} />
          ) : (
            <a
              href={`/${lang}/login?next=${encodeURIComponent(nextPath)}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-fg text-[13px] font-semibold text-white"
            >
              {t.join_must_login}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InviteError({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="text-center text-[14px] text-fg-muted">{reason}</div>
    </div>
  );
}

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
