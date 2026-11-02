"use client";

/**
 * La parte de navegador de la Ficha DTD (SDD-0585, paso 2.4, E2-D30).
 *
 * Le pide el contexto al chat (`chatwoot-dashboard-app:fetch-info`, al origen
 * del chat y no a «*»), lo filtra con `leerContextoChatwoot` (mismo origen y la
 * ventana que la enmarca) y pide la ficha con SOLO los dos ids. Los datos del
 * contacto que trae el contexto se descartan acá.
 *
 * Chatwoot vuelve a mandar el contexto al mostrarse la pestaña o al cambiar de
 * tema; el mismo par de ids no se vuelve a pedir, y una respuesta vieja no pisa
 * la de una conversación más nueva.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { pedirFichaDtd } from "@/app/studio/(app)/bandeja/actions";
import { leerContextoChatwoot, PEDIR_CONTEXTO, type ContextoFicha } from "@/lib/studio/chatwoot/dashboard-app";
import { FichaDtdView, type EstadoFichaDtd } from "./FichaDtdView";

export function FichaDtdClient({
  origenChat,
  conSesion,
  loginUrl,
}: {
  origenChat: string;
  conSesion: boolean;
  loginUrl: string;
}) {
  const [estado, setEstado] = useState<EstadoFichaDtd>(
    conSesion ? { tipo: "esperando" } : { tipo: "sin_sesion", loginUrl },
  );
  const ultimo = useRef<ContextoFicha | null>(null);
  const turno = useRef(0);

  const cargar = useCallback(async (ctx: ContextoFicha) => {
    const mio = ++turno.current;
    setEstado({ tipo: "cargando" });
    let siguiente: EstadoFichaDtd;
    try {
      const r = await pedirFichaDtd(ctx.conversacionId, ctx.agenteId);
      siguiente = !r.ok
        ? { tipo: "error", error: r.error }
        : r.ficha
          ? { tipo: "ficha", ficha: r.ficha, costo: r.costo }
          : { tipo: "sin_ficha", costo: r.costo };
    } catch {
      siguiente = { tipo: "error", error: "service" };
    }
    if (mio === turno.current) setEstado(siguiente);
  }, []);

  useEffect(() => {
    if (!conSesion || window.parent === window) return;
    const alRecibir = (ev: MessageEvent) => {
      const ctx = leerContextoChatwoot(ev, origenChat, window.parent);
      if (!ctx) return;
      if (ctx.tema === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      const previo = ultimo.current;
      if (previo && previo.conversacionId === ctx.conversacionId && previo.agenteId === ctx.agenteId) return;
      ultimo.current = ctx;
      void cargar(ctx);
    };
    window.addEventListener("message", alRecibir);
    window.parent.postMessage(PEDIR_CONTEXTO, origenChat);
    return () => window.removeEventListener("message", alRecibir);
  }, [conSesion, origenChat, cargar]);

  const reintentar = useCallback(() => {
    if (ultimo.current) void cargar(ultimo.current);
  }, [cargar]);

  return <FichaDtdView estado={estado} onRetry={reintentar} />;
}
