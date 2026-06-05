"use client";

import { useEffect } from "react";

/**
 * Botón "Descargar PDF" del brochure. Dispara `window.print()` — el PDF sale
 * del MISMO /brochure vía `@media print` (una sola fuente: web y PDF nunca
 * divergen).
 *
 * Antes de imprimir abre TODOS los `<details.brochure-group>` para que el PDF
 * salga con los 16 servicios visibles (no se puede clickear un PDF en papel).
 * El listener `beforeprint` cubre tanto el click del botón como Ctrl+P.
 */
export function DownloadPdfButton({ dark = false }: { dark?: boolean }) {
  useEffect(() => {
    const openAll = () => {
      document
        .querySelectorAll<HTMLDetailsElement>("details.brochure-group")
        .forEach((d) => {
          d.open = true;
        });
    };
    window.addEventListener("beforeprint", openAll);
    return () => window.removeEventListener("beforeprint", openAll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide
      className="btn btn-ghost"
      style={
        dark
          ? {
              background: "transparent",
              color: "var(--color-white)",
              border: "1.5px solid rgba(255,255,255,0.4)",
            }
          : undefined
      }
    >
      Descargar PDF
    </button>
  );
}
