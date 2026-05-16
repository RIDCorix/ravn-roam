import { notFound } from "next/navigation";

import { AiCopilot } from "@/components/ai-copilot";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { ReviewsSection } from "@/components/reviews-section";
import { TravelLog } from "@/components/travel-log";
import { UsageHighlight } from "@/components/usage-highlight";
import { WorldMapLazy } from "@/components/world-map-lazy";

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
      <Hero dict={dict.hero} currentLocale={lang} />
      <section
        id="coverage"
        style={{
          position: "relative",
          padding: "32px 0 64px",
          overflow: "hidden",
        }}
      >
        <div className="r-map-scroll">
          <div className="r-map-inner">
            <WorldMapLazy dict={dict.map} />
          </div>
        </div>
        <div aria-hidden className="r-map-fade" />
      </section>
      <HowItWorks dict={dict.howItWorks} />
      <AiCopilot dict={dict.ai} />
      <UsageHighlight dict={dict.usage} />
      <TravelLog dict={dict.journey} />
      <ReviewsSection dict={dict.reviews} />
    </>
  );
}
