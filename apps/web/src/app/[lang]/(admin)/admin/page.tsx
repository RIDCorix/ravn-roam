import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold">{dict.admin.heading}</h1>
      <p className="mt-3 text-base" style={{ color: "var(--fg-secondary)" }}>
        {dict.admin.tagline}
      </p>
    </main>
  );
}
