import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";

export const metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="py-24 bg-paper min-h-[60vh] grid place-items-center">
        <div className="wrap max-w-[640px] text-center">
          <div
            className="text-[120px] leading-none"
            style={{
              fontFamily: "var(--font-archivo-black)",
              color: "var(--color-wine)",
            }}
          >
            404
          </div>
          <h1 className="h-section mt-4">
            Esta ruta se perdió
            <br />
            en el océano.
          </h1>
          {/* SDD-0521 · el texto hablaba de un «buscador de tracking en la
              home» que ya no existe: se corrige siempre, con el interruptor en
              cualquier posición. El botón, en cambio, sólo deja de prometer
              rastreo mientras el seguimiento esté en construcción (SDD-0514). */}
          <p className="lead mx-auto mt-5">
            No encontramos la página que buscas. Vuelve al inicio o entra a tu
            portal.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Ir al inicio
            </Link>
            <Link href="/entrar" className="btn btn-ghost">
              {TRACKING_EN_CONSTRUCCION ? "Entrar a mi portal" : "Rastrear envío"}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
