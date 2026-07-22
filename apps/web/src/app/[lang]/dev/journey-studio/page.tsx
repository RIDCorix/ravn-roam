// Dev-only preview for the V2 journey studio. `?mode=live` exercises the
// real /api/lumi/journey/step pipeline (needs auth + OpenAI); the default
// demo mode replays a scripted scenario offline. 404s in production.

import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../dictionaries";
import { JourneyStudioFixture } from "./fixture";

export default async function JourneyStudioDevPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { mode } = await searchParams;
  const dict = await getDictionary(lang);
  return (
    <JourneyStudioFixture
      lang={lang}
      labels={dict.storefront.trips.journey_studio}
      live={mode === "live"}
    />
  );
}
