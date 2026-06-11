import type { Metadata } from "next";
import { DownloadIcon } from "@/components/Icon";

/**
 * Visor del Brand Book DTD v3.7 — material de marca INTERNO (noindex).
 *
 * El archivo (`public/marca/brand-book-v3.7.html`, standalone de Cloud Design)
 * es autocontenido (imágenes en base64) y carga las fuentes Nunito Sans / Sora /
 * Archivo desde Google Fonts (CDN). Se sirve TAL CUAL (regla del founder: "no
 * modifiques contenido, colores, fuentes ni logo") a pantalla completa en un
 * <iframe>; el botón "Descargar" vive en este marco, no en el archivo. Únicos
 * deltas vs el origen (NORTE-SYNC 2026-06-10): RIF unificado `J-50648869-8`,
 * 1 voseo→tuteo y el href de descarga del isólogo reapuntado a `/brand/`.
 *
 * La CSP de `/marca/*` (next.config.ts) está relajada SOLO para ese prefijo:
 * data:/blob: + inline/eval para los assets, y fonts.googleapis/gstatic para las
 * fuentes. El resto del sitio mantiene la CSP estricta.
 */

const FILE = "/marca/brand-book-v3.7.html";

export const metadata: Metadata = {
  title: "Brand Book DTD v3.7",
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
        title="Brand Book DTD v3.7"
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
        download="Brand Book DTD v3.7.html"
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
