import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowIcon, DownloadIcon } from "@/components/Icon";
import { hasBrandAccess } from "@/lib/marca/access";
import {
  BRAND_BOOK_DOWNLOAD_NAME,
  BRAND_BOOK_URL,
  BRAND_BOOK_VERSION,
} from "@/lib/marca/brand-book";
import { PROYECTO_URL } from "@/lib/marca/proyecto";

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
 * DOS PIEZAS, UN VISOR:
 *   · **Lo que se NAVEGA** es el sistema completo (`/marca/doc/…`): 35
 *     documentos que se enlazan entre sí con rutas relativas. Se sirve como
 *     sitio, así que `<a href="Logo Oficial.html">` abre de verdad.
 *   · **Lo que se DESCARGA** es el standalone autocontenido
 *     (`/marca/asset/brand-book`): un archivo de 15-27 MB con todo embebido,
 *     para trabajar sin internet.
 *
 * Antes el iframe mostraba el standalone, y sus ~78 enlaces internos no iban a
 * ningún lado — el empaquetador los mandaba a `/marca` a falta de algo mejor.
 * El founder lo reportó el 2026-08-02: "si le doy a abrir los logos oficiales,
 * debería poder descargarlos, pero no abre el link".
 *
 * El standalone ya NO vive en git (pesa 15-27 MB por versión, y en git eso es
 * permanente): está en el bucket privado `brand-assets` y lo sirven rutas
 * autenticadas que lo leen de Storage y lo transmiten desde nuestro origen.
 * Acá solo lo enmarcamos; el `<iframe>` viaja con las cookies del visitante.
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
      {/* El navegable, no el standalone: es lo que hace que los enlaces
          internos del book lleven a alguna parte. */}
      <iframe
        src={PROYECTO_URL}
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
        {/* `btn-ghost-solid` y no `bg-white`: este archivo de CSS va sin
            `@layer`, así que `.btn-ghost { background: transparent }` le ganaba
            a la utilidad de Tailwind y el botón quedaba transparente sobre el
            book. */}
        <a href="/marca" className="btn btn-ghost btn-ghost-solid">
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
