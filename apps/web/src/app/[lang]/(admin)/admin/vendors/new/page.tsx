import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { VendorForm } from "@/components/admin/vendor-form";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewVendorPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <Link
          href={`/${lang}/admin/vendors`}
          className="t-eyebrow text-fg-muted hover:text-fg"
        >
          ← {dict.admin.vendors.title}
        </Link>
        <h1 className="t-h3 mt-2">{dict.admin.vendors.create}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="t-h5">{dict.admin.vendors.create}</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorForm
            lang={lang}
            mode="create"
            dict={dict.admin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
