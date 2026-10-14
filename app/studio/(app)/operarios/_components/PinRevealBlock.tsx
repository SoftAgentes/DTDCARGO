"use client";

/**
 * PinRevealBlock — el PIN en grande con «Copiar PIN» (SDD-0513, SDD-0515).
 *
 * Lo comparten el cajón de restablecer, el de alta y el diálogo «Ver PIN». El
 * PIN vive sólo en las props de este bloque: cuando el padre lo desmonta (al
 * cerrar), desaparece. No se copia a localStorage, sessionStorage, la URL ni la
 * consola; «Copiar PIN» lo pone en el portapapeles del sistema sólo cuando el
 * admin lo pide.
 */

import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";

type CopyState = "idle" | "copied" | "failed";

export function PinRevealBlock({ pin }: { pin: string }) {
  const [copy, setCopy] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <>
      <p
        style={{
          margin: 0,
          padding: "20px 32px",
          background: "var(--bg-elevated)",
          border: "2px dashed var(--wine)",
          borderRadius: "var(--r-md)",
          font: "900 38px/1 var(--f-mono)",
          color: "var(--wine-text)",
          letterSpacing: "0.16em",
        }}
      >
        {pin}
      </p>

      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        onClick={handleCopy}
      >
        {copy === "copied" ? Icon.check(14) : Icon.copy(14)}
        {copy === "copied" ? "Copiado" : "Copiar PIN"}
      </button>
      <span
        role="status"
        aria-live="polite"
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          minHeight: "1.4em",
        }}
      >
        {copy === "copied"
          ? "PIN copiado."
          : copy === "failed"
            ? "No se pudo copiar. Anótalo a mano."
            : ""}
      </span>
    </>
  );
}
