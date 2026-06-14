import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DownloadIcon } from "@/components/Icon";
import { getUser } from "@/lib/auth/session";

/**
 * Visor del Brand Book DTD v4.2 — material de marca INTERNO, SOLO con login.
 *
 * Acceso: gateado con `getUser()` (decisión founder 2026-06-14). El standalone ya
 * NO vive en `public/` (era servible estático a cualquiera por URL): se movió a
 * `private/marca/brand-book-v4.2.html` y se sirve por la ruta autenticada
 * `/marca/asset/brand-book` (valida sesión). Acá solo lo enmarcamos a pantalla
 * completa; el `<iframe>` lo carga con la cookie de sesión del visitante logueado.
 *
 * Al llegar un book nuevo desde el Norte: reemplazar el standalone en
 * `private/marca/brand-book-vX.Y.html`, borrar el anterior y actualizar el mapa
 * `ASSETS` de `app/marca/asset/[name]/route.ts` (+ la const `BRAND_BOOK` del hub
 * en `app/interno/(app)/marca/page.tsx`).
 *
 * La CSP de `/marca/*` (next.config.ts) está relajada SOLO para ese prefijo
 * (data:/blob: + inline/eval + Google Fonts) y cubre la ruta autenticada.
 */

const FILE = "/marca/asset/brand-book";

export const metadata: Metadata = {
  title: "Brand Book DTD v4.2",
  description: "Material de marca interno de DTD Cargo.",
  // Triple noindex: este meta + X-Robots-Tag (next.config) + Disallow (robots.ts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function BrandBookPage() {
  // Brand Book = solo equipo logueado. Sin sesión → al login del Studio.
  const user = await getUser();
  if (!user) redirect("/studio/login?next=/marca/brand-book");

  return (
    <div className="bg-paper" style={{ position: "fixed", inset: 0 }}>
      <iframe
        src={FILE}
        title="Brand Book DTD v4.2"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
      <a
        href={FILE}
        download="Brand Book DTD v4.2.html"
        className="btn btn-primary"
        style={{
          position: "fixed",
          right: "clamp(16px, 3vw, 28px)",
          bottom: "clamp(16px, 3vw, 28px)",
          zIndex: 10,
        }}
      >
        <DownloadIcon size={16} /> Descargar Brand Book
      </a>
    </div>
  );
}
