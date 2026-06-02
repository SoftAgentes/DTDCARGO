import type { Metadata } from "next";
import { DownloadIcon } from "@/components/Icon";

/**
 * Visor del Brand Book DTD v3.1 — material de marca INTERNO (noindex).
 *
 * El archivo (`public/marca/brand-book-v3.1.html`) es un HTML autocontenido:
 * sus assets (logo, imágenes y 365 fuentes woff2) van embebidos en base64
 * dentro de un `<script type="__bundler/manifest">` y un runtime JS los hidrata
 * a blob:/data: en el browser. Para respetarlo TAL CUAL (regla del founder:
 * "no modifiques el contenido, colores, fuentes ni logo"), se sirve intacto y
 * se muestra a pantalla completa dentro de un <iframe>. El botón "Descargar"
 * vive en este marco, no dentro del archivo.
 *
 * La CSP/framing de `/marca/*` están relajados SOLO para ese prefijo en
 * next.config.ts (el doc necesita blob:/data: + unsafe-eval para hidratar sus
 * fuentes e imágenes). El resto del sitio mantiene la CSP estricta.
 */

const FILE = "/marca/brand-book-v3.1.html";

export const metadata: Metadata = {
  title: "Brand Book DTD v3.1",
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
        title="Brand Book DTD v3.1"
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
        download="Brand Book DTD v3.1.html"
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
