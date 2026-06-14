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
import { jetbrainsMono } from "@/lib/fonts";

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

// Revalidación mensual (~30 días): la home es estática, pero así el servidor
// recomputa la fecha → el KPI "X AÑOS" (aniosComercioChina) sube solo en enero,
// sin redeploy. Diario sería overkill (el número cambia 1 vez al año).
export const revalidate = 2592000;

export default function HomePage() {
  return (
    <>
      <Nav />
      {/* jetbrainsMono.variable monta --font-mono (JetBrains) para que FONT_MONO
          de <ShippingMark/> (el MARKBOX) renderice en la mono de marca, no en
          mono de sistema. Otras páginas con FONT_MONO lo montan igual. */}
      <main className={jetbrainsMono.variable}>
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
