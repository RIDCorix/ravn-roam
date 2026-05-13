import { notFound } from "next/navigation";

import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { PovScene } from "@/components/pov-scene";
import { WalkScene } from "@/components/walk-scene";

import { getDictionary, hasLocale } from "../dictionaries";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <Hero dict={dict.hero} mapDict={dict.map} />
      <HowItWorks dict={dict.howItWorks} />
      <WalkScene dict={dict.walk} />
      <PovScene dict={dict.pov} />
    </>
  );
}
