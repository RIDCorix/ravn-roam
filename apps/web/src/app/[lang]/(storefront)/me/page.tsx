import { notFound } from "next/navigation";

import { CollectionPage } from "@/components/storefront/collection/collection-page";

import { getDictionary, hasLocale } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function MePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return <CollectionPage lang={lang} labels={dict.storefront.collection} />;
}
