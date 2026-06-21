import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CotizadorFletes } from "@/components/CotizadorFletes";

export const metadata: Metadata = {
  title: "Flete marítimo China–Venezuela",
  description:
    "Estima el flete marítimo de contenedor completo (FCL) puerto a puerto desde China a Venezuela. Elige origen, destino y tipo de contenedor y mira un precio estimado al instante. Para cotización en firme, te atiende un asesor.",
  alternates: { canonical: "/cotizador-flete" },
  ...socialMeta({
    title: "Flete marítimo China–Venezuela · DTD Cargo",
    description:
      "Estima el flete marítimo de contenedor completo (FCL) puerto a puerto desde China a Venezuela. Precio estimado al instante.",
    path: "/cotizador-flete",
  }),
};

export default function CotizadorFletePage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Flete marítimo", path: "/cotizador-flete" },
        ]}
      />
      <main className="py-16 lg:py-24 bg-paper min-h-screen">
        <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
          <div>
            <span className="eyebrow">Flete marítimo</span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
              Tu flete marítimo,
              <br />
              <span style={{ color: "var(--color-wine)" }}>China a tu puerto.</span>
            </h1>
            <p className="lead mt-6">
              Elige tu ciudad o puerto de origen en China y tu destino, y mira un
              flete estimado al instante. Es un precio referencial para que te
              orientes; tu asesor lo cierra en firme con cupo y fecha.
            </p>
            <div className="mt-8 flex flex-col gap-4 text-[15px] text-grey-700">
              {[
                ["Contenedor completo (FCL).", "Estimado al instante en 40' High Cube; otras medidas con tu asesor."],
                ["Desde tu ciudad.", "Elige tu ciudad de China (Yiwu, Guangzhou, Shenzhen…) y calculamos desde su puerto."],
                ["¿Carga suelta (LCL)?", "Calcúlala en nuestra calculadora. ¿Puerta a puerta? Pídenos el DDP."],
              ].map(([t, d]) => (
                <div key={t} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--color-wine)" }}
                  />
                  <span>
                    <strong className="text-ink">{t}</strong> {d}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <CotizadorFletes />
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
