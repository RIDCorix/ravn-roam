import Link from "next/link";
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
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">{dict.admin.heading}</h1>
      <p className="mt-2 text-sm text-fg-secondary">{dict.admin.tagline}</p>
      <div className="mt-8 grid gap-3">
        <Link
          href={`/${lang}/admin/products`}
          className="rounded border border-border bg-surface p-4 hover:border-border-strong"
        >
          <div className="font-medium">{dict.admin.nav.products}</div>
        </Link>
        <Link
          href={`/${lang}/admin/supplier-plans`}
          className="rounded border border-border bg-surface p-4 hover:border-border-strong"
        >
          <div className="font-medium">{dict.admin.nav.supplier_plans}</div>
        </Link>
      </div>
    </div>
  );
}
