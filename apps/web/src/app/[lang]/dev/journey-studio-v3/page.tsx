// Dev-only frontend prototype for the reimagined Lumi journey studio (V3).
// Pure client-side mock — no backend calls. 404s in production.

import { notFound } from "next/navigation";

import { JourneyStudioV3Prototype } from "./prototype";

export default async function JourneyStudioV3Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  await params;
  return <JourneyStudioV3Prototype />;
}
