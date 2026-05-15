import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../../dictionaries";

import { SupplierForm } from "@/components/admin/supplier-form";
import { ApiError, getSupplier } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let supplier;
  try {
    ({ supplier } = await getSupplier(id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {dict.admin.suppliers.detail.edit}{" "}
          <span className="font-mono text-base text-fg-secondary">
            {supplier.code}
          </span>
        </h1>
        <Link
          href={`/${lang}/admin/suppliers/${id}`}
          className="text-sm text-fg-secondary hover:underline"
        >
          {dict.admin.common.back}
        </Link>
      </header>
      <SupplierForm lang={lang} dict={dict} mode="edit" initial={supplier} />
    </div>
  );
}
