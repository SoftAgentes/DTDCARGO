import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustBar } from "@/components/TrustBar";
import { Stats } from "@/components/Stats";
import { PuertaAPuerta } from "@/components/PuertaAPuerta";
import { ShippingMark } from "@/components/ShippingMark";
import { ServicesGrid } from "@/components/ServicesGrid";
import { OperationGallery } from "@/components/OperationGallery";
import { HowWeWork } from "@/components/HowWeWork";
import { Philosophy } from "@/components/Philosophy";
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
        <TrustBar />
        <Stats />
        <PuertaAPuerta />
        <HowWeWork />
        <ShippingMark />
        <OperationGallery />
        <ServicesGrid />
        <Philosophy />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
