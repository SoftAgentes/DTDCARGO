import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { ServicesGrid } from "@/components/ServicesGrid";
import { YiwuAdvantage } from "@/components/YiwuAdvantage";
import { Timeline } from "@/components/Timeline";
import { HowWeWork } from "@/components/HowWeWork";
import { TrackingPreview } from "@/components/TrackingPreview";
import { Philosophy } from "@/components/Philosophy";
import { JoinCTA } from "@/components/JoinCTA";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";

/**
 * Metadata propia del home — usa el `default` del layout pero permite
 * extender canonical y otros tags específicos del landing.
 * Title omitido → usa el "default" de layout.tsx (no se aplica el "template").
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <HowWeWork />
        <ServicesGrid />
        <YiwuAdvantage />
        <Timeline />
        <TrackingPreview />
        <Philosophy />
        <JoinCTA />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
