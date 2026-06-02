import type { Metadata } from "next";
import { DownloadIcon } from "@/components/Icon";

/**
 * Visor del Brand Book DTD v3.2 — material de marca INTERNO (noindex).
 *
 * El archivo (`public/marca/brand-book-v3.2.html`) embebe sus imágenes en base64
 * (`window.__DTD_ASSETS`), pero referencia `erp/tokens.css` (servido en
 * `public/marca/erp/tokens.css`) y carga las fuentes Archivo / Nunito Sans desde
 * Google Fonts (CDN). Se respeta TAL CUAL (regla del founder: "no modifiques
 * contenido, colores, fuentes ni logo"): se sirve intacto a pantalla completa en
 * un <iframe>; el botón "Descargar" vive en este marco, no en el archivo.
 *
 * La CSP de `/marca/*` (next.config.ts) está relajada SOLO para ese prefijo:
 * data:/blob: + inline/eval para los assets, y fonts.googleapis/gstatic para las
 * fuentes. El resto del sitio mantiene la CSP estricta.
 */

const FILE = "/marca/brand-book-v3.2.html";

export const metadata: Metadata = {
  title: "Brand Book DTD v3.2",
  description: "Material de marca interno de DTD Cargo.",
  // Triple noindex: este meta + X-Robots-Tag (next.config) + Disallow (robots.ts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function BrandBookPage() {
  return (
    <div className="bg-paper" style={{ position: "fixed", inset: 0 }}>
      <iframe
        src={FILE}
        title="Brand Book DTD v3.2"
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
        download="Brand Book DTD v3.2.html"
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
