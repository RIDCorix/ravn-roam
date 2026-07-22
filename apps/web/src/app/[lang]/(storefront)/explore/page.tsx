import { notFound } from "next/navigation";

import { ExploreSpotlight } from "@/components/storefront/explore/explore-spotlight";

import { hasLocale, getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function ExploreWorldPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return <ExploreSpotlight lang={lang} labels={dict.storefront.explore} />;
}
