"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckIcon, WhatsAppIcon } from "@/components/Icon";

/**
 * "Compartir con tu proveedor" (SDD-0057 ext · Fase 1). Arma el link público
 * `/p/{token}` del proveedor (página sin login con la dirección de la bodega + las
 * etiquetas) y deja copiarlo o mandarlo por WhatsApp. El cliente comparte UN link
 * en vez de descargar y reenviar archivos. El origin se resuelve en el cliente
 * (evita mismatch de hidratación).
 */
export function ShareProviderButton({ token }: { token: string }) {
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);

  const url = origin ? `${origin}/p/${token}` : "";
  const waText = `我的货物标签和收货地址 / Etiquetas y dirección de mi pedido: ${url}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el link igual está visible para copiar a mano */
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {copied ? "¡Link copiado!" : "Copiar link del proveedor"}
          {copied && <CheckIcon size={15} />}
        </button>
        <a
          href={url ? waLink : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          className={`btn btn-ghost inline-flex items-center gap-2 ${
            url ? "" : "opacity-60 pointer-events-none"
          }`}
        >
          <WhatsAppIcon size={15} /> Enviar por WhatsApp
        </a>
      </div>
      {url ? (
        <p
          className="mt-2 text-[12px] text-grey-500 break-all"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {url}
        </p>
      ) : null}
    </div>
  );
}
