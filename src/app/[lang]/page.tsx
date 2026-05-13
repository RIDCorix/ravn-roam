import { notFound } from "next/navigation";

import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { RoamNav } from "@/components/nav";
import { PovScene } from "@/components/pov-scene";
import { WalkScene } from "@/components/walk-scene";

import { getDictionary, hasLocale } from "./dictionaries";

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
      <RoamNav dict={dict} currentLocale={lang} />
      <main>
        <Hero dict={dict.hero} mapDict={dict.map} />
        <HowItWorks dict={dict.howItWorks} />
        <WalkScene dict={dict.walk} />
        <PovScene dict={dict.pov} />
        <Footer dict={dict.footer} />
      </main>
    </>
  );
}
