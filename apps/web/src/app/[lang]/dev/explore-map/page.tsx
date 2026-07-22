// Dev-only isolated repro for the explore-mode map (hover ring + locality
// polygon highlight + click select). No auth required. 404s in production.

import { notFound } from "next/navigation";

import { ExploreMapFixture } from "./fixture";

export default async function ExploreMapDevPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  await params;
  return <ExploreMapFixture />;
}
