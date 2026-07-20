import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";

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
          <p className="lead mx-auto mt-5">
            No encontramos la página que buscas. Vuelve al inicio o usa el
            buscador de tracking en la home.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Ir al inicio
            </Link>
            <Link href="/portal/login" className="btn btn-ghost">
              Rastrear envío
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
