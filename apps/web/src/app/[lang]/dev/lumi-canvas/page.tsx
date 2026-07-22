// Dev-only fixture for the Lumi journey drafting canvas. Lets us design and
// verify the planning screen without auth or a live OpenAI run.
// Not linked anywhere; returns 404 in production builds.

import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../dictionaries";
import { LumiCanvasFixture } from "./fixture";

export default async function LumiCanvasDevPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <LumiCanvasFixture lang={lang} labels={dict.storefront.trips.lumi} />;
}
