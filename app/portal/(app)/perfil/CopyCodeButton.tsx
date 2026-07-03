"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/Icon";

/**
 * "Copiar código" del card TU CÓDIGO (Norte PortalProfile · SDD-0145). Copia el
 * Shipping Mark al portapapeles con feedback transitorio "Copiado" (1.8s, como
 * el Norte). Si el clipboard está bloqueado no rompemos — el código queda
 * visible arriba para copiarlo a mano.
 */
export function CopyCodeButton({ markbox }: { markbox: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markbox);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard bloqueado: el código sigue visible arriba */
        }
      }}
      className="btn btn-ghost mt-4 w-full inline-flex items-center justify-center gap-2"
    >
      {/* role="status": el lector de pantalla anuncia el "Copiado" */}
      <span role="status" className="inline-flex items-center gap-2">
        {copied ? (
          <>
            <CheckIcon size={16} /> Copiado
          </>
        ) : (
          "Copiar código"
        )}
      </span>
    </button>
  );
}
