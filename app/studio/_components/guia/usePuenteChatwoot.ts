"use client";

/**
 * usePuenteChatwoot · la guía de Studio llega dentro del panel de Chatwoot
 * (SDD-0589, paso 9.4).
 *
 * Lo usa la Bandeja, que enmarca el panel. Registra un *ubicador* para el motor:
 * las anclas de Chatwoot (`bandeja.composer`, `bandeja.nota-privada`…) no están
 * en el DOM de Studio, así que el motor se las pregunta a este hook, que las
 * conoce por el script del panel (`infra/chatwoot/panel/guia-panel.html`).
 *
 * - Solo con una guía abierta le pide al script que mida (`dtd:guia:mirar`); al
 *   cerrarla le dice que pare. Sin guía, el panel no observa nada.
 * - Acepta mensajes solo del origen del chat y del `contentWindow` de su marco.
 * - Sin el script en `DASHBOARD_SCRIPTS` no llega ninguna caja: el motor pone la
 *   tarjeta en el marco (`bandeja.marco`), como pide el guion.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { Caja } from "@/lib/studio/guia/posicion";
import {
  cajaEnPagina,
  leerMensajePanel,
  pedidoMirar,
  pedidoMostrar,
  PEDIDO_PARAR,
  SELECTORES_CHATWOOT,
} from "@/lib/studio/guia/puente-chatwoot";
import { avisarCambioUbicadores, registrarUbicador } from "@/lib/studio/guia/ubicadores";
import { useGuiaAbierta } from "./GuiaMotor";

/** Origen de una URL, o `null` si no es válida. */
export function origenDe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function usePuenteChatwoot(marcoRef: RefObject<HTMLIFrameElement | null>, origenChat: string | null): void {
  const abierta = useGuiaAbierta();
  const abiertaRef = useRef(abierta);
  const cajas = useRef(new Map<string, Caja | null>());

  useEffect(() => {
    abiertaRef.current = abierta;
  }, [abierta]);

  // Ubicador para el motor.
  useEffect(() => {
    if (!origenChat) return;
    const enviar = (mensaje: unknown) => {
      const ventana = marcoRef.current?.contentWindow;
      if (!ventana) return;
      try {
        ventana.postMessage(JSON.stringify(mensaje), origenChat);
      } catch {
        // El marco cambió de página a mitad: el próximo «listo» repite el pedido.
      }
    };
    const quitar = registrarUbicador({
      caja(ancla) {
        // `undefined`: el panel no la tiene (o no la midió). `null`: la tiene, pero
        // fuera de la parte visible del marco.
        const interna = cajas.current.get(ancla);
        if (!interna) return undefined;
        const marco = marcoRef.current;
        if (!marco) return null;
        const r = marco.getBoundingClientRect();
        return cajaEnPagina(interna, {
          top: r.top + marco.clientTop,
          left: r.left + marco.clientLeft,
          width: marco.clientWidth,
          height: marco.clientHeight,
        });
      },
      mostrar(ancla, { suave }) {
        enviar(pedidoMostrar(ancla, suave));
      },
    });

    const onMensaje = (e: MessageEvent) => {
      if (e.origin !== origenChat) return;
      const marco = marcoRef.current;
      if (!marco || e.source !== marco.contentWindow) return;
      const mensaje = leerMensajePanel(e.data);
      if (!mensaje) return;
      if (mensaje.tipo === "listo") {
        // El panel cargó (o recargó): si la guía ya estaba abierta, se repite el pedido.
        cajas.current = new Map();
        avisarCambioUbicadores();
        if (abiertaRef.current) enviar(pedidoMirar(SELECTORES_CHATWOOT));
        return;
      }
      cajas.current = mensaje.cajas;
      avisarCambioUbicadores();
    };
    window.addEventListener("message", onMensaje);
    return () => {
      window.removeEventListener("message", onMensaje);
      quitar();
      cajas.current = new Map();
    };
  }, [marcoRef, origenChat]);

  // Mirar solo con la guía abierta.
  useEffect(() => {
    if (!origenChat) return;
    const ventana = () => marcoRef.current?.contentWindow ?? null;
    const enviar = (mensaje: unknown) => {
      try {
        ventana()?.postMessage(JSON.stringify(mensaje), origenChat);
      } catch {
        // Sin marco o en otra página: no hay a quién avisar.
      }
    };
    if (abierta) {
      enviar(pedidoMirar(SELECTORES_CHATWOOT));
      return;
    }
    enviar(PEDIDO_PARAR);
    if (cajas.current.size > 0) {
      cajas.current = new Map();
      avisarCambioUbicadores();
    }
  }, [abierta, marcoRef, origenChat]);
}
