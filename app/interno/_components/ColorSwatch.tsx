"use client";

import { useState } from "react";

type Props = {
  /** Nombre del token, ej. `wine`, `ink`, `grey-500`. */
  token: string;
  /** Valor hex que se copia al portapapeles. */
  hex: string;
  /** Rol corto del color, ej. "Acento primario". */
  role: string;
};

/**
 * Swatch de color del kit de marca: muestra el color, el token y el hex.
 * Al hacer click copia el hex al portapapeles (touch-friendly: el estado
 * "Copiar / Copiado" es siempre visible, sin depender de hover).
 */
export function ColorSwatch({ token, hex, role }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard no disponible (http, permisos) — no-op silencioso */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar ${token} ${hex}`}
      className="group block w-full text-left rounded-[14px] border border-grey-200 bg-white overflow-hidden transition-shadow hover:shadow-[0_10px_24px_-12px_rgba(15,30,61,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <span
        className="block h-[76px]"
        style={{
          background: hex,
          boxShadow: "inset 0 0 0 1px rgba(15,30,61,0.06)",
        }}
      />
      <span className="block p-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-bold text-ink">{token}</span>
          <span className="text-[11px] text-grey-500 text-right leading-tight line-clamp-2">
            {role}
          </span>
        </span>
        <span className="mt-2 flex items-center justify-between gap-2">
          <span
            className="text-[12.5px] text-grey-700 uppercase tracking-wide"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            {hex}
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: copied ? "var(--color-status-success)" : "var(--color-wine)" }}
          >
            {copied ? "Copiado" : "Copiar"}
          </span>
        </span>
      </span>
    </button>
  );
}
