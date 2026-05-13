import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { RoamNav } from "@/components/nav";
import { PovScene } from "@/components/pov-scene";
import { WalkScene } from "@/components/walk-scene";

export default function Home() {
  return (
    <>
      <RoamNav />
      <main>
        <Hero />
        <HowItWorks />
        <WalkScene />
        <PovScene />
        <Footer />
      </main>
    </>
  );
}
