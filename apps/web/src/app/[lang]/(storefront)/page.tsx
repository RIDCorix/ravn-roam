import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@roam/shared";

import { getDictionary, hasLocale } from "../dictionaries";

// System surfaces are per-user (auth, cart, etc.). Opt out of SSG so build
// never evaluates Supabase env at prerender time.
export const dynamic = "force-dynamic";

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Server-side placeholder: prove the @roam/shared workspace dep wires
  // through without actually querying the DB.
  await createSupabaseServerClient();

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold">{dict.storefront.heading}</h1>
      <p className="mt-3 text-base" style={{ color: "var(--fg-secondary)" }}>
        {dict.storefront.tagline}
      </p>
    </main>
  );
}
