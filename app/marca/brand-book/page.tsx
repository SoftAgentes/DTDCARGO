import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowIcon, DownloadIcon } from "@/components/Icon";
import { hasBrandAccess } from "@/lib/marca/access";
import {
  BRAND_BOOK_DOWNLOAD_NAME,
  BRAND_BOOK_URL,
  BRAND_BOOK_VERSION,
} from "@/lib/marca/brand-book";

/**
 * Visor del Brand Book a pantalla completa.
 *
 * Acceso: el gate de `/marca` (SDD-0238) — sesión del ERP **o** el código de
 * acceso. Antes exigía `getUser()`, o sea que un diseñador externo con el código
 * veía el book embebido en `/marca` pero rebotaba acá; era la misma pieza con dos
 * puertas distintas. Sin autorización, se cae a `/marca`, que es donde está el
 * formulario del código (mandarlo al login del ERP le decía a un externo que
 * pidiera una cuenta que nadie le va a dar).
 *
 * El standalone ya NO vive en git (pesa 15-27 MB por versión, y en git eso es
 * permanente): está en el bucket privado `brand-assets` y lo sirve la ruta
 * autenticada `/marca/asset/brand-book`, que lo lee de Storage y lo transmite
 * desde nuestro origen. Acá solo lo enmarcamos; el `<iframe>` viaja con las
 * cookies del visitante.
 *
 * Versión y nombre del archivo maestro salen de `lib/marca/brand-book.ts` —
 * punto único para el NORTE-SYNC.
 *
 * La CSP de `/marca/*` (next.config) está relajada SOLO para el standalone
 * (data:/blob: + inline/eval + Google Fonts).
 */

export const metadata: Metadata = {
  title: `Brand Book DTD ${BRAND_BOOK_VERSION}`,
  description: "Material de marca de DTD Cargo.",
  // Triple noindex: este meta + X-Robots-Tag (next.config) + Disallow (robots.ts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const dynamic = "force-dynamic";

export default async function BrandBookPage() {
  if (!(await hasBrandAccess())) redirect("/marca");

  return (
    <div className="bg-paper" style={{ position: "fixed", inset: 0 }}>
      <iframe
        src={BRAND_BOOK_URL}
        title={`Brand Book DTD ${BRAND_BOOK_VERSION}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />

      <div
        className="flex flex-wrap gap-2"
        style={{
          position: "fixed",
          right: "clamp(16px, 3vw, 28px)",
          bottom: "clamp(16px, 3vw, 28px)",
          zIndex: 10,
        }}
      >
        {/* Sin esto se entra al visor y no hay forma de volver al catálogo salvo
            el botón atrás del navegador — el book ocupa el viewport entero. */}
        <a href="/marca" className="btn btn-ghost bg-white">
          <ArrowIcon /> Volver al centro de marca
        </a>
        <a
          href={BRAND_BOOK_URL}
          download={BRAND_BOOK_DOWNLOAD_NAME}
          className="btn btn-primary"
        >
          <DownloadIcon size={16} /> Descargar Brand Book
        </a>
      </div>
    </div>
  );
}
