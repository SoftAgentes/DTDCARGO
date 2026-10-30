"use client";

/**
 * Cierra la sesión del panel de Chatwoot en ESTE navegador al salir de Studio
 * (SDD-0585, paso 2.7, E2-D13).
 *
 * Abre `/app/login` del chat en un marco oculto. Cuando carga, le manda
 * {"evento":"dtd:cerrar-sesion"} al origen del chat (no a «*»). El script del
 * panel (`infra/chatwoot/panel/dashboard-scripts.html`, en `DASHBOARD_SCRIPTS`)
 * llama al logout de Chatwoot y contesta {"evento":"dtd:sesion-cerrada"}. Con
 * la respuesta, o a los 4 s si no llega (el script todavía no está desplegado,
 * el chat no responde), sigue al login de Studio: salir nunca se traba.
 */

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";

export const PEDIR_CIERRE = JSON.stringify({ evento: "dtd:cerrar-sesion" });
export const ESPERA_MS = 4000;
const irPorDefecto = (url: string) => window.location.replace(url);

export function CerrarChatClient({
  origenChat,
  destino,
  irA = irPorDefecto,
}: {
  origenChat: string;
  destino: string;
  irA?: (url: string) => void;
}) {
  const t = useT();
  const marco = useRef<HTMLIFrameElement>(null);
  const salio = useRef(false);

  useEffect(() => {
    const salir = () => {
      if (salio.current) return;
      salio.current = true;
      irA(destino);
    };
    const alResponder = (e: MessageEvent) => {
      if (e.origin !== origenChat || e.source !== marco.current?.contentWindow) return;
      let datos: unknown = e.data;
      try {
        if (typeof datos === "string") datos = JSON.parse(datos);
      } catch {
        return;
      }
      if ((datos as { evento?: unknown } | null)?.evento === "dtd:sesion-cerrada") salir();
    };
    window.addEventListener("message", alResponder);
    const reloj = window.setTimeout(salir, ESPERA_MS);
    return () => {
      window.removeEventListener("message", alResponder);
      window.clearTimeout(reloj);
    };
  }, [origenChat, destino, irA]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-base)] p-6 font-[family-name:var(--f-sans)] text-[var(--ink-soft)]">
      <p role="status">{t("bandeja.salir.cerrando")}</p>
      <iframe
        ref={marco}
        title={t("bandeja.salir.marco")}
        src={`${origenChat}/app/login`}
        hidden
        onLoad={() => marco.current?.contentWindow?.postMessage(PEDIR_CIERRE, origenChat)}
      />
    </main>
  );
}
