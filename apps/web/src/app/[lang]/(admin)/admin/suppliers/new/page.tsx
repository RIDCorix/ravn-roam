import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { SupplierForm } from "@/components/admin/supplier-form";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{dict.admin.suppliers.create}</h1>
        <Link
          href={`/${lang}/admin/suppliers`}
          className="text-sm text-fg-secondary hover:underline"
        >
          {dict.admin.suppliers.back}
        </Link>
      </header>
      <SupplierForm lang={lang} dict={dict} mode="create" />
    </div>
  );
}
