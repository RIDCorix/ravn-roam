import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/storefront/coming-soon";

import { getDictionary, hasLocale } from "../../dictionaries";

export default async function MePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <ComingSoon
      title={dict.storefront.nav.me}
      body={dict.storefront.tabs.me_placeholder}
    />
  );
}
