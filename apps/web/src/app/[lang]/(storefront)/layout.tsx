import { notFound } from "next/navigation";

import { StorefrontShell } from "@/components/storefront/shell";

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

  return (
    <StorefrontShell lang={lang} labels={dict.storefront.nav}>
      {children}
    </StorefrontShell>
  );
}
