import { Coverage } from "@/components/coverage";
import { CtaBanner } from "@/components/cta-banner";
import { FAQ } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Testimonials } from "@/components/testimonials";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <Coverage />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CtaBanner />
      </main>
      <SiteFooter />
    </>
  );
}
