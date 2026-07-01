"use client";

import { useState } from "react";
import { CheckIcon, WhatsAppIcon } from "@/components/Icon";

/**
 * Acciones del código de referido (copiar + compartir por WhatsApp). Client por
 * `navigator.clipboard` y `window.open`. El mensaje de WhatsApp lleva el código,
 * el descuento del referido y el tagline de marca ("Con Confianza, …").
 *
 * Va embebido sobre el hero navy del header de Referidos → estilos sobre fondo
 * oscuro (texto cream/blanco), igual que el hero del Norte.
 */
export function ReferralShareActions({
  code,
  referredReward,
}: {
  code: string;
  referredReward: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el código queda visible para copiar a mano */
    }
  }

  const waText = `Importa de China con DTD Cargo y usa mi código ${code} para $${referredReward} de descuento en tu primer embarque. Con Confianza, de China a tu puerta.`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--hero-ink)_70%,transparent)]"
        style={{ background: "var(--hero-ink)", color: "var(--hero-from)" }}
      >
        {copied ? "Código copiado" : "Copiar código"}
        {copied ? <CheckIcon size={15} /> : null}
      </button>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-colors hover:bg-[color-mix(in_srgb,var(--hero-ink)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--hero-ink)_70%,transparent)]"
        style={{
          color: "var(--hero-ink)",
          border: "1px solid color-mix(in srgb, var(--hero-ink) 30%, transparent)",
        }}
      >
        <WhatsAppIcon size={15} /> Compartir
      </a>
    </div>
  );
}
