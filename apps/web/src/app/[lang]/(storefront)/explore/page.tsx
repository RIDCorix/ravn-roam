import { notFound } from "next/navigation";

import { ExploreSpotlight } from "@/components/storefront/explore/explore-spotlight";

import { hasLocale, getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function ExploreWorldPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  const { q } = await searchParams;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <ExploreSpotlight
      lang={lang}
      labels={dict.storefront.explore}
      initialQuery={q}
    />
  );
}
